-- Hala Digital billing hardening migration
-- Production-grade Stripe billing event integrity, auditability and replay safety

create table if not exists public.billing_event_receipts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid null references public.firms(id) on delete set null,
  stripe_event_id text not null,
  stripe_event_type text not null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  stripe_invoice_id text null,
  stripe_payment_intent_id text null,
  processing_status text not null default 'received',
  processing_attempts integer not null default 1,
  first_received_at timestamptz not null default now(),
  last_processed_at timestamptz null,
  processed_at timestamptz null,
  processing_error text null,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_event_receipts_stripe_event_id_uidx
on public.billing_event_receipts(stripe_event_id);

create index if not exists billing_event_receipts_firm_id_idx
on public.billing_event_receipts(firm_id);

create index if not exists billing_event_receipts_subscription_idx
on public.billing_event_receipts(stripe_subscription_id);

create index if not exists billing_event_receipts_status_idx
on public.billing_event_receipts(processing_status);

alter table public.billing_events
add column if not exists stripe_invoice_id text null,
add column if not exists stripe_payment_intent_id text null,
add column if not exists processing_status text null,
add column if not exists processed_at timestamptz null,
add column if not exists processing_error text null,
add column if not exists source text null;

create unique index if not exists billing_events_stripe_event_id_uidx
on public.billing_events(stripe_event_id)
where stripe_event_id is not null;

alter table public.firm_subscriptions
add column if not exists latest_invoice_id text null,
add column if not exists latest_invoice_status text null,
add column if not exists latest_payment_intent_id text null,
add column if not exists latest_payment_status text null,
add column if not exists last_payment_failed_at timestamptz null,
add column if not exists last_payment_succeeded_at timestamptz null,
add column if not exists trial_will_end_notified_at timestamptz null,
add column if not exists billing_lifecycle_state text null,
add column if not exists billing_state_changed_at timestamptz null;

create table if not exists public.billing_subscription_transitions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  stripe_subscription_id text null,
  from_status text null,
  to_status text not null,
  from_price_id text null,
  to_price_id text null,
  from_plan_id uuid null,
  to_plan_id uuid null,
  reason text null,
  stripe_event_id text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_subscription_transitions_firm_idx
on public.billing_subscription_transitions(firm_id, created_at desc);

create index if not exists billing_subscription_transitions_stripe_event_idx
on public.billing_subscription_transitions(stripe_event_id);

alter table public.billing_event_receipts enable row level security;
alter table public.billing_subscription_transitions enable row level security;
