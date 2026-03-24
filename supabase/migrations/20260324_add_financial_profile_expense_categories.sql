alter table public.user_financial_profiles
  add column if not exists groceries_household_monthly numeric(12,2),
  add column if not exists utilities_phone_internet_monthly numeric(12,2),
  add column if not exists transport_monthly numeric(12,2),
  add column if not exists insurance_monthly numeric(12,2),
  add column if not exists childcare_education_monthly numeric(12,2),
  add column if not exists medical_monthly numeric(12,2),
  add column if not exists entertainment_lifestyle_monthly numeric(12,2),
  add column if not exists other_non_debt_monthly numeric(12,2);

alter table public.user_financial_profiles
  drop constraint if exists user_financial_profiles_groceries_non_negative,
  drop constraint if exists user_financial_profiles_utilities_non_negative,
  drop constraint if exists user_financial_profiles_transport_non_negative,
  drop constraint if exists user_financial_profiles_insurance_non_negative,
  drop constraint if exists user_financial_profiles_childcare_non_negative,
  drop constraint if exists user_financial_profiles_medical_non_negative,
  drop constraint if exists user_financial_profiles_entertainment_non_negative,
  drop constraint if exists user_financial_profiles_other_non_debt_non_negative;

alter table public.user_financial_profiles
  add constraint user_financial_profiles_groceries_non_negative
    check (groceries_household_monthly is null or groceries_household_monthly >= 0),
  add constraint user_financial_profiles_utilities_non_negative
    check (utilities_phone_internet_monthly is null or utilities_phone_internet_monthly >= 0),
  add constraint user_financial_profiles_transport_non_negative
    check (transport_monthly is null or transport_monthly >= 0),
  add constraint user_financial_profiles_insurance_non_negative
    check (insurance_monthly is null or insurance_monthly >= 0),
  add constraint user_financial_profiles_childcare_non_negative
    check (childcare_education_monthly is null or childcare_education_monthly >= 0),
  add constraint user_financial_profiles_medical_non_negative
    check (medical_monthly is null or medical_monthly >= 0),
  add constraint user_financial_profiles_entertainment_non_negative
    check (entertainment_lifestyle_monthly is null or entertainment_lifestyle_monthly >= 0),
  add constraint user_financial_profiles_other_non_debt_non_negative
    check (other_non_debt_monthly is null or other_non_debt_monthly >= 0);

comment on column public.user_financial_profiles.groceries_household_monthly is
  'Monthly groceries and household essentials, excluding debt repayments.';
comment on column public.user_financial_profiles.utilities_phone_internet_monthly is
  'Monthly utilities, phone, and internet costs, excluding debt repayments.';
comment on column public.user_financial_profiles.transport_monthly is
  'Monthly transport costs, excluding loan repayments.';
comment on column public.user_financial_profiles.insurance_monthly is
  'Monthly insurance premiums, excluding debt repayments.';
comment on column public.user_financial_profiles.childcare_education_monthly is
  'Monthly childcare and education costs.';
comment on column public.user_financial_profiles.medical_monthly is
  'Monthly medical and health costs.';
comment on column public.user_financial_profiles.entertainment_lifestyle_monthly is
  'Monthly entertainment and lifestyle spending.';
comment on column public.user_financial_profiles.other_non_debt_monthly is
  'Other monthly non-debt living expenses.';
