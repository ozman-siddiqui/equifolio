create table public.market_rate_benchmarks (
  id uuid primary key default gen_random_uuid(),
  occupancy_type text not null
    check (occupancy_type in ('investor', 'owner_occupier')),
  repayment_type text not null
    check (repayment_type in ('Principal and Interest', 'Interest Only')),
  lvr_band text not null
    check (lvr_band in ('<=80', '80-90')),
  benchmark_rate numeric(5,2) not null,
  source_name text default 'manual-admin',
  effective_date date not null,
  updated_at timestamptz default now()
);

insert into public.market_rate_benchmarks (
  occupancy_type,
  repayment_type,
  lvr_band,
  benchmark_rate,
  source_name,
  effective_date
)
values
  ('investor', 'Principal and Interest', '<=80', 5.89, 'manual-admin', current_date),
  ('investor', 'Interest Only', '<=80', 6.14, 'manual-admin', current_date),
  ('owner_occupier', 'Principal and Interest', '<=80', 5.69, 'manual-admin', current_date),
  ('owner_occupier', 'Interest Only', '<=80', 5.95, 'manual-admin', current_date);

alter table public.market_rate_benchmarks enable row level security;

create policy "Authenticated users can read market benchmarks"
  on public.market_rate_benchmarks
  for select
  to authenticated
  using (true);

create policy "Service role can manage market benchmarks"
  on public.market_rate_benchmarks
  for all
  to service_role
  using (true)
  with check (true);

create table public.ai_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users on delete cascade,
  property_id uuid
    references public.properties(id) on delete cascade,
  loan_id uuid
    references public.loans(id) on delete cascade,
  opportunity_type text not null
    check (opportunity_type in ('refinance', 'rent_gap')),
  title text not null,
  narrative text,
  annual_value_estimate numeric(12,2) not null,
  monthly_value_estimate numeric(12,2),
  break_even_months numeric(8,2),
  priority_score integer not null,
  confidence_level text not null
    check (confidence_level in ('high', 'medium', 'low')),
  status text not null default 'active'
    check (status in ('active', 'reviewing', 'acted', 'dismissed', 'expired')),
  data_hash text,
  new_rate_secured numeric(5,2),
  detected_at timestamptz default now(),
  last_evaluated_at timestamptz default now(),
  acted_at timestamptz,
  dismissed_at timestamptz,
  metadata jsonb
);

-- Manual verification note: public.loans RLS policies are not visible in this repo.
-- Confirm live public.loans policy behavior before relying on loan-linked joins beyond user_id ownership.

alter table public.ai_opportunities enable row level security;

create policy "Users can select own opportunities"
  on public.ai_opportunities
  for select
  using (user_id = auth.uid());

create policy "Users can insert own opportunities"
  on public.ai_opportunities
  for insert
  with check (user_id = auth.uid());

create policy "Users can update own opportunities"
  on public.ai_opportunities
  for update
  using (user_id = auth.uid());

create policy "Users can delete own opportunities"
  on public.ai_opportunities
  for delete
  using (user_id = auth.uid());

create table public.ai_value_tracker (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users on delete cascade,
  cumulative_opportunity_value numeric(12,2) default 0,
  acted_value numeric(12,2) default 0,
  total_opportunities_detected integer default 0,
  updated_at timestamptz default now(),
  constraint ai_value_tracker_user_id_key unique (user_id)
);

alter table public.ai_value_tracker enable row level security;

create policy "Users can select own tracker"
  on public.ai_value_tracker
  for select
  using (user_id = auth.uid());

create policy "Users can insert own tracker"
  on public.ai_value_tracker
  for insert
  with check (user_id = auth.uid());

create policy "Users can update own tracker"
  on public.ai_value_tracker
  for update
  using (user_id = auth.uid());
