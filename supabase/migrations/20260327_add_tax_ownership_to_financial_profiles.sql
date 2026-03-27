alter table public.user_financial_profiles
  add column if not exists ownership_structure text not null default 'individual',
  add column if not exists ownership_split_user_pct numeric(5,2) not null default 100,
  add column if not exists ownership_split_partner_pct numeric(5,2) not null default 0;

alter table public.user_financial_profiles
  drop constraint if exists user_financial_profiles_ownership_structure_valid,
  drop constraint if exists user_financial_profiles_ownership_split_user_non_negative,
  drop constraint if exists user_financial_profiles_ownership_split_partner_non_negative,
  drop constraint if exists user_financial_profiles_ownership_split_total_valid;

alter table public.user_financial_profiles
  add constraint user_financial_profiles_ownership_structure_valid
    check (ownership_structure in ('individual', 'joint')),
  add constraint user_financial_profiles_ownership_split_user_non_negative
    check (ownership_split_user_pct >= 0),
  add constraint user_financial_profiles_ownership_split_partner_non_negative
    check (ownership_split_partner_pct >= 0),
  add constraint user_financial_profiles_ownership_split_total_valid
    check (round((ownership_split_user_pct + ownership_split_partner_pct)::numeric, 2) = 100.00);

update public.user_financial_profiles
set
  ownership_structure = coalesce(ownership_structure, 'individual'),
  ownership_split_user_pct = case
    when ownership_structure = 'joint' then coalesce(ownership_split_user_pct, 50)
    else 100
  end,
  ownership_split_partner_pct = case
    when ownership_structure = 'joint' then coalesce(ownership_split_partner_pct, 50)
    else 0
  end;

comment on column public.user_financial_profiles.ownership_structure is
  'Tax ownership structure for V1.1 tax allocation. Supports individual and joint only.';

comment on column public.user_financial_profiles.ownership_split_user_pct is
  'Percentage of property ownership allocated to the user for tax calculation.';

comment on column public.user_financial_profiles.ownership_split_partner_pct is
  'Percentage of property ownership allocated to the partner for tax calculation.';
