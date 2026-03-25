alter table public.user_financial_profiles
  add column if not exists cash_available_for_investment numeric(14,2);

alter table public.user_financial_profiles
  drop constraint if exists user_financial_profiles_cash_available_for_investment_non_negative;

alter table public.user_financial_profiles
  add constraint user_financial_profiles_cash_available_for_investment_non_negative
    check (
      cash_available_for_investment is null
      or cash_available_for_investment >= 0
    );

comment on column public.user_financial_profiles.cash_available_for_investment is
  'Cash available for investment. Nullable; frontend treats null as 0 unless explicitly provided.';
