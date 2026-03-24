alter table public.loans
  add column if not exists benchmark_rate numeric(6,3);

alter table public.loans
  drop constraint if exists loans_benchmark_rate_non_negative;

alter table public.loans
  add constraint loans_benchmark_rate_non_negative
    check (benchmark_rate is null or benchmark_rate >= 0);

comment on column public.loans.benchmark_rate is
  'Canonical benchmark refinance rate used as the preferred explicit comparison rate for refinance analysis.';
