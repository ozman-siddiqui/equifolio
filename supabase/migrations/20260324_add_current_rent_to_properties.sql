alter table public.properties
  add column if not exists current_rent_amount numeric(12,2),
  add column if not exists current_rent_frequency text;

alter table public.properties
  drop constraint if exists properties_current_rent_amount_non_negative,
  drop constraint if exists properties_current_rent_frequency_valid;

alter table public.properties
  add constraint properties_current_rent_amount_non_negative
    check (current_rent_amount is null or current_rent_amount >= 0),
  add constraint properties_current_rent_frequency_valid
    check (
      current_rent_frequency is null
      or current_rent_frequency in ('weekly', 'fortnightly', 'monthly', 'annual')
    );

comment on column public.properties.current_rent_amount is
  'Current rent amount for the property. Stored separately from transactions as the clean current-rent source.';
comment on column public.properties.current_rent_frequency is
  'Frequency for current rent amount: weekly, fortnightly, monthly, or annual.';
