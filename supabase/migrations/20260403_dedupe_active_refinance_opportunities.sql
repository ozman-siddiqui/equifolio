with ranked_duplicates as (
  select
    id,
    user_id,
    loan_id,
    data_hash,
    row_number() over (
      partition by loan_id, data_hash
      order by detected_at desc nulls last,
               last_evaluated_at desc nulls last,
               id desc
    ) as duplicate_rank
  from public.ai_opportunities
  where status in ('active', 'reviewing')
    and loan_id is not null
    and data_hash is not null
),
expired_duplicates as (
  update public.ai_opportunities as opportunity
  set
    status = 'expired',
    last_evaluated_at = now()
  from ranked_duplicates
  where opportunity.id = ranked_duplicates.id
    and ranked_duplicates.duplicate_rank > 1
  returning opportunity.user_id
),
users_to_recalculate as (
  select distinct user_id
  from expired_duplicates
),
tracker_totals as (
  select
    opportunity.user_id,
    coalesce(
      sum(opportunity.annual_value_estimate)
        filter (where opportunity.status in ('active', 'reviewing', 'acted')),
      0
    ) as cumulative_opportunity_value,
    coalesce(
      sum(opportunity.annual_value_estimate)
        filter (where opportunity.status = 'acted'),
      0
    ) as acted_value
  from public.ai_opportunities as opportunity
  where opportunity.user_id in (select user_id from users_to_recalculate)
  group by opportunity.user_id
)
insert into public.ai_value_tracker (
  user_id,
  cumulative_opportunity_value,
  acted_value,
  updated_at
)
select
  tracker_totals.user_id,
  coalesce(tracker_totals.cumulative_opportunity_value, 0),
  coalesce(tracker_totals.acted_value, 0),
  now()
from tracker_totals
on conflict (user_id) do update
set
  cumulative_opportunity_value = excluded.cumulative_opportunity_value,
  acted_value = excluded.acted_value,
  updated_at = excluded.updated_at;

create unique index if not exists ai_opportunities_active_reviewing_unique
on public.ai_opportunities (loan_id, data_hash)
where status in ('active', 'reviewing');