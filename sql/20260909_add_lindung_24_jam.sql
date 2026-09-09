-- Lindung 24 Jam (SKBBK / Skim Keselamatan Bencana Bukan Kerja)
-- Voluntary for Malaysian employees, mandatory for foreign employees.
-- Employee-only contribution, so this is a per-employee opt-in flag.
alter table public.payroll
  add column if not exists lindung_24_jam boolean not null default false;

comment on column public.payroll.lindung_24_jam is
  'Employee has opted in to PERKESO Lindung 24 Jam (SKBBK). Employee-only contribution, auto-calculated from basic salary.';
