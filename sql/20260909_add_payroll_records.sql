-- Saved monthly payroll records.
--
-- payroll_runs holds one row per finalized month; payroll_run_items holds a
-- frozen snapshot of every employee's figures for that month. The figures are
-- copied rather than referenced so that later changes to an employee's salary,
-- name or Lindung 24 Jam opt-in never rewrite history.

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  finalized_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_runs_period_unique unique (year, month)
);

create table if not exists public.payroll_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs (id) on delete cascade,
  -- kept for traceability, but nulled rather than cascaded if the employee is
  -- later deleted: the snapshot below is what the record is for
  employee_id uuid references public.payroll (id) on delete set null,
  employee_name text not null,
  basic_salary numeric not null default 0,
  epf_employee numeric not null default 0,
  epf_employer numeric not null default 0,
  socso_employee numeric not null default 0,
  socso_employer numeric not null default 0,
  eis_employee numeric not null default 0,
  eis_employer numeric not null default 0,
  lindung_24_jam numeric not null default 0,
  pcb numeric not null default 0,
  cp38 numeric not null default 0,
  net_salary numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payroll_run_items_run_id_idx on public.payroll_run_items (run_id);
create index if not exists payroll_runs_period_idx on public.payroll_runs (year desc, month desc);

-- The app talks to Supabase with the anon key and enforces its own role check
-- in the router, matching how the existing tables are reached.
alter table public.payroll_runs enable row level security;
alter table public.payroll_run_items enable row level security;

drop policy if exists "payroll_runs_all" on public.payroll_runs;
create policy "payroll_runs_all" on public.payroll_runs for all using (true) with check (true);

drop policy if exists "payroll_run_items_all" on public.payroll_run_items;
create policy "payroll_run_items_all" on public.payroll_run_items for all using (true) with check (true);

-- Realtime, so the history page stays in sync like the other stores
alter publication supabase_realtime add table public.payroll_runs;
alter publication supabase_realtime add table public.payroll_run_items;

-- Saving a period replaces its items. Done in one plpgsql function so the
-- delete and re-insert are a single transaction: a failure part way through
-- must not leave the previously saved record destroyed.
create or replace function public.save_payroll_run(
  p_year integer,
  p_month integer,
  p_items jsonb
)
returns public.payroll_runs
language plpgsql
as $$
declare
  v_run public.payroll_runs;
begin
  insert into public.payroll_runs (year, month, finalized_at, updated_at)
  values (p_year, p_month, now(), now())
  on conflict (year, month)
    do update set finalized_at = now(), updated_at = now()
  returning * into v_run;

  delete from public.payroll_run_items where run_id = v_run.id;

  insert into public.payroll_run_items (
    run_id, employee_id, employee_name, basic_salary,
    epf_employee, epf_employer, socso_employee, socso_employer,
    eis_employee, eis_employer, lindung_24_jam, pcb, cp38, net_salary
  )
  select
    v_run.id,
    nullif(item ->> 'employee_id', '')::uuid,
    item ->> 'employee_name',
    coalesce((item ->> 'basic_salary')::numeric, 0),
    coalesce((item ->> 'epf_employee')::numeric, 0),
    coalesce((item ->> 'epf_employer')::numeric, 0),
    coalesce((item ->> 'socso_employee')::numeric, 0),
    coalesce((item ->> 'socso_employer')::numeric, 0),
    coalesce((item ->> 'eis_employee')::numeric, 0),
    coalesce((item ->> 'eis_employer')::numeric, 0),
    coalesce((item ->> 'lindung_24_jam')::numeric, 0),
    coalesce((item ->> 'pcb')::numeric, 0),
    coalesce((item ->> 'cp38')::numeric, 0),
    coalesce((item ->> 'net_salary')::numeric, 0)
  from jsonb_array_elements(p_items) as item;

  return v_run;
end;
$$;
