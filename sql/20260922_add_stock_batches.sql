-- Stock batches with expiry dates.
--
-- Every stock in creates a batch (quantity received + optional expiry date).
-- Stock out consumes batches first-in-first-out by the date they were
-- received. inventory.quantity stays the displayed total and is recomputed
-- from the batches by every RPC below, so the two can never drift apart as
-- long as stock is moved through stock_in / stock_out / update_stock_batch.
--
-- The RPCs also write the stock_movements rows themselves, in the same
-- transaction as the quantity change. Previously the client inserted the
-- movement after the RPC returned, so a dropped connection could change stock
-- without a log entry.

create table if not exists public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_batches_item_fifo_idx
  on public.stock_batches (item_id, created_at, id);

alter table public.stock_batches enable row level security;

drop policy if exists "stock_batches_all" on public.stock_batches;
create policy "stock_batches_all" on public.stock_batches for all using (true) with check (true);

alter publication supabase_realtime add table public.stock_batches;

-- A movement remembers which batch it touched and that batch's expiry date
-- at the time, so the log still reads correctly after the batch is edited.
alter table public.stock_movements
  add column if not exists batch_id uuid references public.stock_batches (id) on delete set null,
  add column if not exists expiry_date date;

create index if not exists stock_movements_created_at_idx
  on public.stock_movements (created_at desc);

-- Editing an item's name must follow through to the movement and request
-- logs, which reference inventory.item_name directly.
alter table public.stock_movements drop constraint if exists stock_movements_item_name_fkey;
alter table public.stock_movements
  add constraint stock_movements_item_name_fkey
  foreign key (item_name) references public.inventory (item_name)
  on update cascade on delete cascade;

alter table public.stock_requests drop constraint if exists stock_requests_item_name_fkey;
alter table public.stock_requests
  add constraint stock_requests_item_name_fkey
  foreign key (item_name) references public.inventory (item_name)
  on update cascade on delete cascade;

-- Opening balance: one batch per item for the stock already on hand.
insert into public.stock_batches (item_id, quantity, expiry_date, created_at)
select i.id, i.quantity, null, i.created_at
from public.inventory i
where i.quantity > 0
  and not exists (select 1 from public.stock_batches b where b.item_id = i.id);

-- Replace every existing overload of the stock RPCs.
do $$
declare
  r record;
begin
  for r in
    select oid::regprocedure as signature
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('stock_in', 'stock_out', 'update_stock_batch')
  loop
    execute 'drop function ' || r.signature;
  end loop;
end
$$;

create or replace function public.stock_in(
  p_item_id uuid,
  p_quantity integer,
  p_clear_order_date boolean default true,
  p_not_track boolean default null,
  p_expiry_date date default null,
  p_remark text default ''
)
returns setof public.inventory
language plpgsql
as $$
declare
  v_item public.inventory;
  v_batch public.stock_batches;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select * into v_item from public.inventory where id = p_item_id for update;
  if not found then
    raise exception 'Item not found';
  end if;

  insert into public.stock_batches (item_id, quantity, expiry_date)
  values (p_item_id, p_quantity, p_expiry_date)
  returning * into v_batch;

  update public.inventory
  set quantity = (select coalesce(sum(quantity), 0) from public.stock_batches where item_id = p_item_id),
      order_date = case when p_clear_order_date then null else order_date end,
      back_order = case when p_clear_order_date then false else back_order end,
      not_track = coalesce(p_not_track, not_track),
      updated_at = now()
  where id = p_item_id
  returning * into v_item;

  insert into public.stock_movements (item_id, item_name, quantity, movement_type, remark, batch_id, expiry_date)
  values (p_item_id, v_item.item_name, p_quantity, 'stock_in', coalesce(p_remark, ''), v_batch.id, p_expiry_date);

  return next v_item;
end;
$$;

-- FIFO: the oldest received batch is consumed first. To switch to
-- first-expired-first-out, change the order by below to
-- `expiry_date asc nulls last, created_at, id`.
create or replace function public.stock_out(
  p_item_id uuid,
  p_quantity integer,
  p_remark text default ''
)
returns setof public.inventory
language plpgsql
as $$
declare
  v_item public.inventory;
  v_batch public.stock_batches;
  v_remaining integer := p_quantity;
  v_take integer;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select * into v_item from public.inventory where id = p_item_id for update;
  if not found then
    raise exception 'Item not found';
  end if;

  for v_batch in
    select * from public.stock_batches
    where item_id = p_item_id and quantity > 0
    order by created_at, id
    for update
  loop
    exit when v_remaining <= 0;

    v_take := least(v_batch.quantity, v_remaining);

    update public.stock_batches
    set quantity = quantity - v_take, updated_at = now()
    where id = v_batch.id;

    insert into public.stock_movements (item_id, item_name, quantity, movement_type, remark, batch_id, expiry_date)
    values (p_item_id, v_item.item_name, v_take, 'stock_out', coalesce(p_remark, ''), v_batch.id, v_batch.expiry_date);

    v_remaining := v_remaining - v_take;
  end loop;

  -- Asking for more than is on hand empties the item (the previous RPC
  -- clamped at zero the same way); only what was actually removed is logged.
  update public.inventory
  set quantity = (select coalesce(sum(quantity), 0) from public.stock_batches where item_id = p_item_id),
      updated_at = now()
  where id = p_item_id
  returning * into v_item;

  return next v_item;
end;
$$;

-- Edit a batch's remaining quantity and/or expiry date. A quantity change is
-- logged as a stock in / stock out against that batch so the movement history
-- still adds up to the current stock.
create or replace function public.update_stock_batch(
  p_batch_id uuid,
  p_quantity integer,
  p_expiry_date date default null,
  p_remark text default 'Batch adjustment'
)
returns setof public.inventory
language plpgsql
as $$
declare
  v_batch public.stock_batches;
  v_item public.inventory;
  v_delta integer;
begin
  if p_quantity < 0 then
    raise exception 'Quantity cannot be negative';
  end if;

  select * into v_batch from public.stock_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Batch not found';
  end if;

  select * into v_item from public.inventory where id = v_batch.item_id for update;
  if not found then
    raise exception 'Item not found';
  end if;

  v_delta := p_quantity - v_batch.quantity;

  update public.stock_batches
  set quantity = p_quantity, expiry_date = p_expiry_date, updated_at = now()
  where id = p_batch_id;

  if v_delta <> 0 then
    insert into public.stock_movements (item_id, item_name, quantity, movement_type, remark, batch_id, expiry_date)
    values (
      v_item.id,
      v_item.item_name,
      abs(v_delta),
      case when v_delta > 0 then 'stock_in' else 'stock_out' end,
      coalesce(p_remark, ''),
      p_batch_id,
      p_expiry_date
    );
  end if;

  update public.inventory
  set quantity = (select coalesce(sum(quantity), 0) from public.stock_batches where item_id = v_item.id),
      updated_at = now()
  where id = v_item.id
  returning * into v_item;

  return next v_item;
end;
$$;
