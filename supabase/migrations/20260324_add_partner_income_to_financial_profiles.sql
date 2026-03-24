alter table public.user_financial_profiles
  add column if not exists partner_income_annual numeric(14,2) default 0;

alter table public.user_financial_profiles
  drop constraint if exists user_financial_profiles_partner_income_non_negative;

alter table public.user_financial_profiles
  add constraint user_financial_profiles_partner_income_non_negative
    check (partner_income_annual is null or partner_income_annual >= 0);

comment on column public.user_financial_profiles.partner_income_annual is
  'Annual partner income stored explicitly for borrowing power and serviceability analysis.';
