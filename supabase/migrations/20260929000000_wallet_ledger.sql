-- Wallet ledger: append-only record of balance movements (Polar topups,
-- export charges, refunds). Balance is always derived by summing
-- amount_cents for a user, never stored as a mutable column, so a webhook
-- retry or a bug can never silently overwrite history - see
-- docs/guide/billing-free-pay-as-export.md ("every wallet movement is an
-- immutable ledger entry").
create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  amount_cents bigint not null check (amount_cents <> 0),
  currency text not null default 'usd',
  kind text not null check (kind in ('topup', 'export_charge', 'refund', 'adjustment')),
  -- Polar order id for a topup. Unique so a retried/duplicated webhook
  -- delivery can never credit the same order twice.
  external_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index wallet_ledger_external_ref_idx
  on public.wallet_ledger (external_ref)
  where external_ref is not null;

create index wallet_ledger_user_id_created_at_idx
  on public.wallet_ledger (user_id, created_at desc);

alter table public.wallet_ledger enable row level security;

grant select on table public.wallet_ledger to authenticated;

create policy "Users can read their own ledger entries"
  on public.wallet_ledger
  for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policy for anon/authenticated: only the
-- service-role webhook handler (which bypasses RLS) writes ledger rows.

create or replace function public.wallet_balance_cents(account_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(sum(amount_cents), 0)::bigint
  from public.wallet_ledger
  where user_id = account_id;
$function$;

grant execute on function public.wallet_balance_cents(uuid) to service_role;
