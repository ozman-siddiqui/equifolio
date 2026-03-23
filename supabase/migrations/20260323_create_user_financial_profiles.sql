create table if not exists public.user_financial_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_income_annual numeric(14,2),
  employment_income_annual numeric(14,2),
  other_income_annual numeric(14,2),
  living_expenses_monthly numeric(12,2),
  dependants integer,
  borrower_count integer default 1,
  employment_type text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_financial_profiles_household_income_non_negative
    check (household_income_annual is null or household_income_annual >= 0),
  constraint user_financial_profiles_employment_income_non_negative
    check (employment_income_annual is null or employment_income_annual >= 0),
  constraint user_financial_profiles_other_income_non_negative
    check (other_income_annual is null or other_income_annual >= 0),
  constraint user_financial_profiles_living_expenses_non_negative
    check (living_expenses_monthly is null or living_expenses_monthly >= 0),
  constraint user_financial_profiles_dependants_non_negative
    check (dependants is null or dependants >= 0),
  constraint user_financial_profiles_borrower_count_positive
    check (borrower_count is null or borrower_count > 0),
  constraint user_financial_profiles_employment_type_valid
    check (
      employment_type is null
      or employment_type in (
        'full_time',
        'part_time',
        'casual',
        'self_employed',
        'contract',
        'retired',
        'other'
      )
    )
);

create index if not exists user_financial_profiles_updated_at_idx
  on public.user_financial_profiles (updated_at desc);

alter table public.user_financial_profiles enable row level security;

drop policy if exists "Users can read own financial profile" on public.user_financial_profiles;
create policy "Users can read own financial profile"
  on public.user_financial_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own financial profile" on public.user_financial_profiles;
create policy "Users can insert own financial profile"
  on public.user_financial_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own financial profile" on public.user_financial_profiles;
create policy "Users can update own financial profile"
  on public.user_financial_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own financial profile" on public.user_financial_profiles;
create policy "Users can delete own financial profile"
  on public.user_financial_profiles
  for delete
  using (auth.uid() = user_id);

comment on table public.user_financial_profiles is
  'Borrower-level financial profile used for borrowing power and serviceability analysis.';
