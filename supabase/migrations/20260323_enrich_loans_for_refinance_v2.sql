alter table public.loans
  add column if not exists remaining_term_months integer,
  add column if not exists offset_balance numeric(14,2),
  add column if not exists refinance_cost_estimate numeric(12,2),
  add column if not exists fixed_variable text;

alter table public.loans
  alter column fixed_variable set default 'Variable';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'loans_remaining_term_months_positive'
  ) then
    alter table public.loans
      add constraint loans_remaining_term_months_positive
      check (remaining_term_months is null or remaining_term_months > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'loans_offset_balance_non_negative'
  ) then
    alter table public.loans
      add constraint loans_offset_balance_non_negative
      check (offset_balance is null or offset_balance >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'loans_refinance_cost_estimate_non_negative'
  ) then
    alter table public.loans
      add constraint loans_refinance_cost_estimate_non_negative
      check (refinance_cost_estimate is null or refinance_cost_estimate >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'loans_fixed_variable_valid'
  ) then
    alter table public.loans
      add constraint loans_fixed_variable_valid
      check (
        fixed_variable is null
        or fixed_variable in ('Variable', 'Fixed', 'Split')
      );
  end if;
end $$;

create index if not exists loans_user_id_idx on public.loans (user_id);
create index if not exists loans_property_id_idx on public.loans (property_id);

comment on column public.loans.remaining_term_months is
  'Loan term remaining in months. Used by refinance and borrowing power engines for repayment accuracy.';
comment on column public.loans.offset_balance is
  'Current offset account balance to reduce effective interest-bearing principal.';
comment on column public.loans.refinance_cost_estimate is
  'Estimated total switching cost for refinance analysis break-even calculations.';
comment on column public.loans.fixed_variable is
  'Explicit rate structure used for benchmark comparisons when loan_type is not enough.';
