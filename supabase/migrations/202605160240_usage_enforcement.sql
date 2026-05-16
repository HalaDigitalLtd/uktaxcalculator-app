-- Production-grade billing usage enforcement architecture

create table if not exists public.billing_limit_warnings (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  warning_type text not null,
  usage_value numeric not null default 0,
  limit_value numeric not null default 0,
  percentage_used numeric not null default 0,
  acknowledged boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_limit_warnings_firm_idx
on public.billing_limit_warnings(firm_id, created_at desc);

alter table public.firm_subscriptions
add column if not exists enforcement_enabled boolean not null default true,
add column if not exists soft_limit_mode boolean not null default false,
add column if not exists warning_threshold_percent numeric not null default 80,
add column if not exists hard_stop_threshold_percent numeric not null default 100;

alter table public.billing_usage_events
add column if not exists billing_month text null,
add column if not exists usage_category text null,
add column if not exists exceeds_limit boolean not null default false;

create index if not exists billing_usage_events_firm_month_idx
on public.billing_usage_events(firm_id, billing_month);

alter table public.billing_limit_warnings enable row level security;
