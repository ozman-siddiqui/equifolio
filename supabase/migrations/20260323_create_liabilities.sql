create table if not exists public.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  name text not null,
  balance numeric(14,2),
  monthly_repayment numeric(12,2),
  credit_limit numeric(14,2),
  interest_rate numeric(6,3),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint liabilities_type_valid
    check (
      type in (
        'credit_card',
        'personal_loan',
        'car_loan',
        'student_loan',
        'buy_now_pay_later',
        'tax_debt',
        'other'
      )
    ),
  constraint liabilities_balance_non_negative
    check (balance is null or balance >= 0),
  constraint liabilities_monthly_repayment_non_negative
    check (monthly_repayment is null or monthly_repayment >= 0),
  constraint liabilities_credit_limit_non_negative
    check (credit_limit is null or credit_limit >= 0),
  constraint liabilities_interest_rate_non_negative
    check (interest_rate is null or interest_rate >= 0)
);

create index if not exists liabilities_user_id_idx on public.liabilities (user_id);
create index if not exists liabilities_type_idx on public.liabilities (type);

alter table public.liabilities enable row level security;

drop policy if exists "Users can read own liabilities" on public.liabilities;
create policy "Users can read own liabilities"
  on public.liabilities
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own liabilities" on public.liabilities;
create policy "Users can insert own liabilities"
  on public.liabilities
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own liabilities" on public.liabilities;
create policy "Users can update own liabilities"
  on public.liabilities
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own liabilities" on public.liabilities;
create policy "Users can delete own liabilities"
  on public.liabilities
  for delete
  using (auth.uid() = user_id);

comment on table public.liabilities is
  'User-level liabilities used for borrowing power, serviceability, and debt visibility.';
