-- Transactions insert guardrails for Equifolio.
-- Expected transaction columns used by the app:
-- id, user_id, property_id, type, category, amount, frequency, date
-- The app also writes description when available.

alter table public.transactions enable row level security;

drop policy if exists "transactions_insert_own_rows" on public.transactions;

create policy "transactions_insert_own_rows"
on public.transactions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.properties
    where properties.id = transactions.property_id
      and properties.user_id = auth.uid()
  )
);
