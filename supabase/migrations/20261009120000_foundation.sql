-- DineFlow foundation schema (brief §10, §12).
--
-- Security model:
--   * Every restaurant-owned row carries restaurant_id, and row-level security (RLS) is enabled on
--     every table. Tenant isolation is enforced here, not in the UI.
--   * anon/authenticated get no table privileges by default; each table grants exactly what its
--     policies are written for.
--   * Order and payment state only change through security-definer functions that validate the
--     transition and append an audit event. Nobody can UPDATE orders directly.

-- ---------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------

create type public.order_status as enum (
  'pending_payment', 'awaiting_restaurant', 'accepted', 'preparing', 'ready_for_collection',
  'collected', 'rejected', 'cancelled', 'expired', 'failed'
);
create type public.payment_status as enum (
  'pending', 'confirmed', 'failed', 'pay_at_pickup', 'refund_initiated', 'refund_completed'
);
create type public.order_actor as enum ('customer', 'restaurant', 'platform_admin', 'system');
create type public.order_mode as enum ('pickup', 'dine_in');
create type public.payment_method as enum ('online', 'pay_at_pickup');
create type public.restaurant_status as enum (
  'draft', 'ready_for_review', 'published', 'paused', 'suspended', 'archived'
);
create type public.restaurant_role as enum ('owner', 'manager', 'staff');
create type public.platform_role as enum ('support', 'super_admin');
create type public.membership_status as enum ('invited', 'active', 'revoked');
create type public.item_availability as enum ('available', 'unavailable');

-- Start from zero privileges for API roles, whatever the platform's defaults are.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- ---------------------------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  phone text check (char_length(phone) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Platform roles are granted only by an existing super-admin (or a migration/seed), never self-granted.
create table public.platform_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.platform_role not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Restaurants (tenants)
-- ---------------------------------------------------------------------------------------------

-- Everything in this table is safe to show publicly once the restaurant is published.
-- Internal details live in restaurant_private.
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  display_name text not null check (char_length(display_name) between 1 and 80),
  description text check (char_length(description) <= 500),
  cuisine_tags text[] not null default '{}',
  logo_path text,
  cover_path text,
  brand_color text check (brand_color ~ '^#[0-9a-f]{6}$'),
  brand_on_color text check (brand_on_color ~ '^#[0-9a-f]{6}$'),
  service_area text,
  address text,
  directions text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  timezone text not null default 'Africa/Nairobi',
  status public.restaurant_status not null default 'draft',
  accepting_orders boolean not null default false,
  pause_reason text check (char_length(pause_reason) <= 200),
  pickup_enabled boolean not null default true,
  dine_in_enabled boolean not null default false,
  pickup_instructions text check (char_length(pickup_instructions) <= 500),
  prep_presets smallint[] not null default '{5,10,15,20,30}',
  default_prep_minutes smallint not null default 10 check (default_prep_minutes between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((brand_color is null) = (brand_on_color is null)),
  check (pickup_enabled or dine_in_enabled)
);
create index restaurants_status_idx on public.restaurants (status);
create trigger restaurants_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();

create table public.restaurant_private (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  legal_name text,
  contact_email text,
  contact_phone text,
  onboarding_notes text,
  updated_at timestamptz not null default now()
);
create trigger restaurant_private_updated_at before update on public.restaurant_private
  for each row execute function public.set_updated_at();

create table public.restaurant_memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.restaurant_role not null,
  status public.membership_status not null default 'active',
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index restaurant_memberships_one_live
  on public.restaurant_memberships (restaurant_id, user_id) where status <> 'revoked';
create index restaurant_memberships_user_idx on public.restaurant_memberships (user_id) where status = 'active';
create trigger restaurant_memberships_updated_at before update on public.restaurant_memberships
  for each row execute function public.set_updated_at();

create table public.restaurant_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  opens_at time not null,
  closes_at time not null,
  check (closes_at > opens_at) -- overnight hours are out of scope for the MVP
);
create index restaurant_hours_restaurant_idx on public.restaurant_hours (restaurant_id, weekday);

create table public.restaurant_closures (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index restaurant_closures_restaurant_idx on public.restaurant_closures (restaurant_id, end_at);

-- ---------------------------------------------------------------------------------------------
-- Menus
-- ---------------------------------------------------------------------------------------------

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text check (char_length(description) <= 200),
  sort_order integer not null default 0,
  active boolean not null default true,
  unique (id, restaurant_id)
);
create index menu_categories_restaurant_idx on public.menu_categories (restaurant_id, sort_order);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 300),
  image_path text,
  price_minor integer not null check (price_minor >= 0),
  currency char(3) not null default 'KES',
  prep_minutes smallint check (prep_minutes between 1 and 120),
  tags text[] not null default '{}',
  active boolean not null default true,
  availability public.item_availability not null default 'available',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id),
  -- An item can only sit in a category of its own restaurant.
  foreign key (category_id, restaurant_id)
    references public.menu_categories (id, restaurant_id) on delete restrict
);
create index menu_items_restaurant_idx on public.menu_items (restaurant_id, category_id, sort_order);
create trigger menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  required boolean not null default false,
  min_select smallint not null default 0 check (min_select >= 0),
  max_select smallint not null default 1 check (max_select >= 1),
  sort_order integer not null default 0,
  unique (id, restaurant_id),
  check (min_select <= max_select),
  check (not required or min_select >= 1)
);

create table public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  modifier_group_id uuid not null,
  name text not null check (char_length(name) between 1 and 60),
  price_delta_minor integer not null default 0 check (price_delta_minor >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  foreign key (modifier_group_id, restaurant_id)
    references public.modifier_groups (id, restaurant_id) on delete cascade
);
create index modifier_options_group_idx on public.modifier_options (modifier_group_id, sort_order);

create table public.menu_item_modifier_groups (
  restaurant_id uuid not null,
  menu_item_id uuid not null,
  modifier_group_id uuid not null,
  sort_order integer not null default 0,
  primary key (menu_item_id, modifier_group_id),
  foreign key (menu_item_id, restaurant_id)
    references public.menu_items (id, restaurant_id) on delete cascade,
  foreign key (modifier_group_id, restaurant_id)
    references public.modifier_groups (id, restaurant_id) on delete cascade
);

-- ---------------------------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------------------------

create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  public_order_number bigint not null unique default nextval('public.order_number_seq'),
  customer_id uuid not null references auth.users (id) on delete restrict,
  restaurant_id uuid not null references public.restaurants (id) on delete restrict,
  order_mode public.order_mode not null,
  payment_method public.payment_method not null,
  order_status public.order_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'pending',
  currency char(3) not null default 'KES',
  item_subtotal_minor integer not null check (item_subtotal_minor >= 0),
  fee_minor integer not null default 0 check (fee_minor >= 0),
  tax_minor integer not null default 0 check (tax_minor >= 0),
  total_minor integer not null check (total_minor >= 0),
  customer_note text check (char_length(customer_note) <= 280),
  eta_at timestamptz,
  eta_updated_at timestamptz,
  accepted_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  collected_at timestamptz,
  closed_at timestamptz,
  status_version integer not null default 0,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id),
  unique (customer_id, idempotency_key),
  check (total_minor = item_subtotal_minor + fee_minor + tax_minor),
  check (payment_status <> 'pay_at_pickup' or payment_method = 'pay_at_pickup')
);
create index orders_restaurant_queue_idx on public.orders (restaurant_id, order_status, created_at desc);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_payment_status_idx on public.orders (payment_status);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  restaurant_id uuid not null,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  item_name_snapshot text not null,
  unit_price_minor integer not null check (unit_price_minor >= 0),
  quantity integer not null check (quantity between 1 and 50),
  modifiers_snapshot jsonb not null default '[]',
  note text check (char_length(note) <= 140),
  line_total_minor integer not null check (line_total_minor >= 0),
  foreign key (order_id, restaurant_id) references public.orders (id, restaurant_id) on delete cascade
);
create index order_items_order_idx on public.order_items (order_id);

-- Append-only audit timeline of every status change.
create table public.order_status_events (
  id bigint generated always as identity primary key,
  order_id uuid not null,
  restaurant_id uuid not null,
  previous_status public.order_status,
  new_status public.order_status not null,
  actor_kind public.order_actor not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  reason text check (char_length(reason) <= 280),
  eta_at timestamptz,
  occurred_at timestamptz not null default now(),
  foreign key (order_id, restaurant_id) references public.orders (id, restaurant_id) on delete cascade
);
create index order_status_events_order_idx on public.order_status_events (order_id, occurred_at);

-- The pickup code is shown only to the customer and checked by staff through verify_pickup_code().
create table public.order_pickup_codes (
  order_id uuid primary key references public.orders (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{4,8}$'),
  failed_attempts smallint not null default 0,
  locked_until timestamptz,
  verified_at timestamptz,
  verified_by uuid references auth.users (id)
);

-- Mirrors ORDER_TRANSITIONS in src/domain/orders/state-machine.ts (a DB test keeps them equal).
create table public.order_status_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  actor public.order_actor not null,
  requires_reason boolean not null default false,
  requires_eta boolean not null default false,
  primary key (from_status, to_status, actor)
);

insert into public.order_status_transitions (from_status, to_status, actor, requires_reason, requires_eta) values
  ('pending_payment', 'awaiting_restaurant', 'system', false, false),
  ('pending_payment', 'cancelled', 'customer', false, false),
  ('pending_payment', 'cancelled', 'system', false, false),
  ('pending_payment', 'cancelled', 'platform_admin', false, false),
  ('pending_payment', 'expired', 'system', false, false),
  ('pending_payment', 'failed', 'system', false, false),
  ('awaiting_restaurant', 'accepted', 'restaurant', false, true),
  ('awaiting_restaurant', 'rejected', 'restaurant', true, false),
  ('awaiting_restaurant', 'rejected', 'platform_admin', true, false),
  ('awaiting_restaurant', 'cancelled', 'customer', false, false),
  ('awaiting_restaurant', 'cancelled', 'platform_admin', false, false),
  ('awaiting_restaurant', 'expired', 'system', false, false),
  ('accepted', 'preparing', 'restaurant', false, false),
  ('accepted', 'ready_for_collection', 'restaurant', false, false),
  ('accepted', 'cancelled', 'restaurant', true, false),
  ('accepted', 'cancelled', 'platform_admin', true, false),
  ('preparing', 'ready_for_collection', 'restaurant', false, false),
  ('preparing', 'cancelled', 'restaurant', true, false),
  ('preparing', 'cancelled', 'platform_admin', true, false),
  ('ready_for_collection', 'collected', 'restaurant', false, false),
  ('ready_for_collection', 'preparing', 'restaurant', true, false),
  ('ready_for_collection', 'preparing', 'platform_admin', true, false);

-- ---------------------------------------------------------------------------------------------
-- Payments, notifications, settings, audit
-- ---------------------------------------------------------------------------------------------

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  restaurant_id uuid not null,
  provider text not null,
  provider_reference text,
  merchant_reference text,
  amount_minor integer not null check (amount_minor >= 0),
  currency char(3) not null default 'KES',
  status text not null default 'initiated'
    check (status in ('initiated', 'pending', 'succeeded', 'failed', 'cancelled')),
  idempotency_key text not null unique,
  initiated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  foreign key (order_id, restaurant_id) references public.orders (id, restaurant_id) on delete restrict,
  unique (provider, provider_reference)
);
create index payment_attempts_order_idx on public.payment_attempts (order_id);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid references public.payment_attempts (id) on delete set null,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload_hash text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  unique (provider, provider_event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  restaurant_id uuid not null,
  payment_attempt_id uuid references public.payment_attempts (id) on delete restrict,
  amount_minor integer not null check (amount_minor > 0),
  reason text,
  provider_reference text,
  status text not null default 'requested'
    check (status in ('requested', 'initiated', 'completed', 'failed')),
  requested_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (order_id, restaurant_id) references public.orders (id, restaurant_id) on delete restrict
);
create trigger refunds_updated_at before update on public.refunds
  for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  channel text not null check (channel in ('in_app', 'sms', 'email', 'push', 'whatsapp')),
  template_key text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_ref text,
  error_code text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check (user_id is not null or restaurant_id is not null)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  scope text not null check (scope in ('platform', 'restaurant')),
  restaurant_id uuid references public.restaurants (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  safe_metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);
create index audit_logs_restaurant_idx on public.audit_logs (restaurant_id, occurred_at desc);

-- ---------------------------------------------------------------------------------------------
-- Access helpers (security definer so policies can call them without recursing through RLS)
-- ---------------------------------------------------------------------------------------------

create function public.is_platform_staff(roles public.platform_role[] default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.platform_staff ps
    where ps.user_id = (select auth.uid())
      and (roles is null or ps.role = any (roles))
  );
$$;

create function public.is_restaurant_member(
  p_restaurant_id uuid,
  roles public.restaurant_role[] default '{owner,manager,staff}'
) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.restaurant_memberships m
    where m.restaurant_id = p_restaurant_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (roles)
  );
$$;

create function public.is_publicly_visible(p_restaurant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.status in ('published', 'paused')
  );
$$;

create function public.write_audit(
  p_scope text, p_restaurant_id uuid, p_action text, p_target_type text, p_target_id text,
  p_reason text default null, p_metadata jsonb default '{}'
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, scope, restaurant_id, action, target_type, target_id, reason, safe_metadata)
  values ((select auth.uid()), p_scope, p_restaurant_id, p_action, p_target_type, p_target_id, p_reason, p_metadata);
$$;

-- Only platform staff may change a restaurant's slug or lifecycle status.
create function public.guard_restaurant_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.slug is distinct from old.slug or new.status is distinct from old.status)
     and not public.is_platform_staff()
     and (select auth.uid()) is not null then
    raise exception 'Only platform staff can change a restaurant''s address or status'
      using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    perform public.write_audit('platform', new.id, 'restaurant.status_changed', 'restaurant', new.id::text,
      null, jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger restaurants_guard_update before update on public.restaurants
  for each row execute function public.guard_restaurant_update();

-- Membership changes are audited, and only platform staff can create owners.
create function public.guard_membership_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'owner' and (tg_op = 'INSERT' or old.role <> 'owner')
     and not public.is_platform_staff() and (select auth.uid()) is not null then
    raise exception 'Only platform staff can assign an owner' using errcode = '42501';
  end if;
  perform public.write_audit('restaurant', new.restaurant_id, 'membership.' || lower(tg_op), 'membership',
    new.id::text, null, jsonb_build_object('user_id', new.user_id, 'role', new.role, 'status', new.status));
  return new;
end;
$$;
create trigger restaurant_memberships_guard before insert or update on public.restaurant_memberships
  for each row execute function public.guard_membership_change();

-- ---------------------------------------------------------------------------------------------
-- Commands
-- ---------------------------------------------------------------------------------------------

-- Moves an order to a new status after checking who is asking, the transition table, the
-- caller's expected version (to catch two staff acting at once), and the reason/ETA rules.
create function public.transition_order(
  p_order_id uuid,
  p_to public.order_status,
  p_expected_version integer,
  p_reason text default null,
  p_eta_at timestamptz default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_actor public.order_actor;
  v_rule public.order_status_transitions;
  v_uid uuid := (select auth.uid());
  -- The role the request runs as. A security-definer function changes current_user, not this.
  v_db_role text := coalesce(nullif(current_setting('role', true), 'none'), session_user::text);
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_uid is null then
    if v_db_role in ('service_role', 'postgres', 'supabase_admin') then
      v_actor := 'system';
    else
      raise exception 'Sign in to change this order' using errcode = '42501';
    end if;
  elsif public.is_platform_staff('{super_admin,support}') then
    v_actor := 'platform_admin';
  elsif public.is_restaurant_member(v_order.restaurant_id) then
    v_actor := 'restaurant';
  elsif v_order.customer_id = v_uid then
    v_actor := 'customer';
  else
    -- Same message as a missing order, so IDs from other tenants reveal nothing.
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.status_version <> p_expected_version then
    raise exception 'This order changed since you loaded it. Reload to see the latest state.'
      using errcode = '40001';
  end if;

  select * into v_rule from public.order_status_transitions
  where from_status = v_order.order_status and to_status = p_to and actor = v_actor;
  if not found then
    raise exception 'An order cannot move from % to % (%)', v_order.order_status, p_to, v_actor
      using errcode = '22023';
  end if;
  if v_rule.requires_reason and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Give a reason for this change' using errcode = '22023';
  end if;
  if v_rule.requires_eta and p_eta_at is null then
    raise exception 'Confirm an estimated ready time' using errcode = '22023';
  end if;
  if p_to = 'accepted' and v_order.payment_status not in ('confirmed', 'pay_at_pickup') then
    raise exception 'Payment is not confirmed yet' using errcode = '22023';
  end if;

  update public.orders set
    order_status = p_to,
    status_version = status_version + 1,
    eta_at = case when p_eta_at is not null then p_eta_at else eta_at end,
    eta_updated_at = case when p_eta_at is not null then now() else eta_updated_at end,
    accepted_at = case when p_to = 'accepted' then now() else accepted_at end,
    preparing_at = case when p_to = 'preparing' and preparing_at is null then now() else preparing_at end,
    ready_at = case when p_to = 'ready_for_collection' then now() when p_to = 'preparing' then null else ready_at end,
    collected_at = case when p_to = 'collected' then now() else collected_at end,
    closed_at = case when p_to in ('collected', 'rejected', 'cancelled', 'expired', 'failed') then now() else closed_at end
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_events (order_id, restaurant_id, previous_status, new_status, actor_kind, actor_user_id, reason, eta_at)
  values (v_order.id, v_order.restaurant_id, v_rule.from_status, p_to, v_actor, v_uid, nullif(btrim(p_reason), ''), p_eta_at);

  -- Money already taken for an order that will not be fulfilled needs a refund. The payment
  -- adapter picks up 'requested' refunds; payment_status changes only when the provider confirms.
  if p_to in ('rejected', 'cancelled') and v_order.payment_status = 'confirmed' and v_order.total_minor > 0 then
    insert into public.refunds (order_id, restaurant_id, amount_minor, reason, requested_by)
    values (v_order.id, v_order.restaurant_id, v_order.total_minor, nullif(btrim(p_reason), ''), v_uid);
  end if;

  return v_order;
end;
$$;

-- Changes a confirmed estimate without changing status; records the previous and new value.
create function public.update_order_eta(
  p_order_id uuid, p_expected_version integer, p_eta_at timestamptz, p_reason text default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not (public.is_restaurant_member(v_order.restaurant_id) or public.is_platform_staff('{super_admin}')) then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status_version <> p_expected_version then
    raise exception 'This order changed since you loaded it. Reload to see the latest state.' using errcode = '40001';
  end if;
  if v_order.order_status not in ('accepted', 'preparing') then
    raise exception 'The estimate can only change while the order is accepted or preparing' using errcode = '22023';
  end if;

  update public.orders
  set eta_at = p_eta_at, eta_updated_at = now(), status_version = status_version + 1
  where id = p_order_id returning * into v_order;

  insert into public.order_status_events (order_id, restaurant_id, previous_status, new_status, actor_kind, actor_user_id, reason, eta_at)
  values (v_order.id, v_order.restaurant_id, v_order.order_status, v_order.order_status,
    case when public.is_restaurant_member(v_order.restaurant_id) then 'restaurant' else 'platform_admin' end::public.order_actor,
    (select auth.uid()), nullif(btrim(p_reason), ''), p_eta_at);
  return v_order;
end;
$$;

-- Staff check a code the customer shows. Five wrong attempts lock the order's code for 5 minutes.
-- The answer is only true/false; it never reveals the right code or another order's details.
create function public.verify_pickup_code(p_order_id uuid, p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_restaurant uuid;
  v_status public.order_status;
  v_pc public.order_pickup_codes;
  v_ok boolean;
begin
  select restaurant_id, order_status into v_restaurant, v_status from public.orders where id = p_order_id;
  if v_restaurant is null or not public.is_restaurant_member(v_restaurant) then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  select * into v_pc from public.order_pickup_codes where order_id = p_order_id for update;
  if not found or v_status <> 'ready_for_collection' then
    return false;
  end if;
  if v_pc.locked_until is not null and v_pc.locked_until > now() then
    raise exception 'Too many attempts. Try again in a few minutes.' using errcode = '54000';
  end if;

  v_ok := v_pc.code = upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  if v_ok then
    update public.order_pickup_codes
    set failed_attempts = 0, locked_until = null, verified_at = now(), verified_by = (select auth.uid())
    where order_id = p_order_id;
  else
    update public.order_pickup_codes
    set failed_attempts = failed_attempts + 1,
        locked_until = case when failed_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
    where order_id = p_order_id;
  end if;
  return v_ok;
end;
$$;

-- Any active staff member can mark an item unavailable or available again.
create function public.set_menu_item_availability(p_item_id uuid, p_availability public.item_availability)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from public.menu_items where id = p_item_id;
  if v_restaurant is null or not public.is_restaurant_member(v_restaurant) then
    raise exception 'Menu item not found' using errcode = 'P0002';
  end if;
  update public.menu_items set availability = p_availability where id = p_item_id;
end;
$$;

-- "Pause new orders" / "Resume orders". Existing orders are untouched.
create function public.set_accepting_orders(p_restaurant_id uuid, p_accepting boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_restaurant_member(p_restaurant_id, '{owner,manager}') or public.is_platform_staff()) then
    raise exception 'Restaurant not found' using errcode = 'P0002';
  end if;
  update public.restaurants
  set accepting_orders = p_accepting,
      pause_reason = case when p_accepting then null else nullif(btrim(p_reason), '') end
  where id = p_restaurant_id;
  perform public.write_audit('restaurant', p_restaurant_id,
    case when p_accepting then 'restaurant.resumed_orders' else 'restaurant.paused_orders' end,
    'restaurant', p_restaurant_id::text, p_reason);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.platform_staff enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_private enable row level security;
alter table public.restaurant_memberships enable row level security;
alter table public.restaurant_hours enable row level security;
alter table public.restaurant_closures enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.menu_item_modifier_groups enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_events enable row level security;
alter table public.order_pickup_codes enable row level security;
alter table public.order_status_transitions enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;
alter table public.notifications enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: your own, plus platform staff for support.
grant select, update (display_name, phone) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_platform_staff());
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Platform staff: you can see your own role; super-admins manage everyone.
grant select, insert, update, delete on public.platform_staff to authenticated;
create policy platform_staff_select on public.platform_staff for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_staff('{super_admin}'));
create policy platform_staff_write on public.platform_staff for all to authenticated
  using (public.is_platform_staff('{super_admin}'))
  with check (public.is_platform_staff('{super_admin}'));

-- Restaurants: published and paused profiles are public; members and platform staff see their own.
grant select on public.restaurants to anon, authenticated;
grant insert on public.restaurants to authenticated;
grant update (
  display_name, description, cuisine_tags, logo_path, cover_path, brand_color, brand_on_color,
  service_area, address, directions, latitude, longitude, pickup_enabled, dine_in_enabled,
  pickup_instructions, prep_presets, default_prep_minutes, slug, status
) on public.restaurants to authenticated;
create policy restaurants_public_select on public.restaurants for select to anon, authenticated
  using (status in ('published', 'paused'));
create policy restaurants_member_select on public.restaurants for select to authenticated
  using (public.is_restaurant_member(id) or public.is_platform_staff());
create policy restaurants_insert on public.restaurants for insert to authenticated
  with check (public.is_platform_staff());
create policy restaurants_update on public.restaurants for update to authenticated
  using (public.is_restaurant_member(id, '{owner,manager}') or public.is_platform_staff())
  with check (public.is_restaurant_member(id, '{owner,manager}') or public.is_platform_staff());

grant select, insert, update on public.restaurant_private to authenticated;
create policy restaurant_private_all on public.restaurant_private for all to authenticated
  using (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff())
  with check (public.is_restaurant_member(restaurant_id, '{owner}') or public.is_platform_staff());

-- Memberships: see your own and, as an owner, your team. Owners invite managers and staff.
grant select, insert, update (role, status) on public.restaurant_memberships to authenticated;
create policy memberships_select on public.restaurant_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_restaurant_member(restaurant_id, '{owner}')
    or public.is_platform_staff()
  );
create policy memberships_insert on public.restaurant_memberships for insert to authenticated
  with check (public.is_restaurant_member(restaurant_id, '{owner}') or public.is_platform_staff('{super_admin,support}'));
create policy memberships_update on public.restaurant_memberships for update to authenticated
  using (public.is_restaurant_member(restaurant_id, '{owner}') or public.is_platform_staff('{super_admin}'))
  with check (public.is_restaurant_member(restaurant_id, '{owner}') or public.is_platform_staff('{super_admin}'));

-- Hours, closures, menus: public for visible restaurants; owners/managers edit.
grant select on public.restaurant_hours, public.restaurant_closures, public.menu_categories,
  public.menu_items, public.modifier_groups, public.modifier_options, public.menu_item_modifier_groups
  to anon, authenticated;
grant insert, update, delete on public.restaurant_hours, public.restaurant_closures, public.menu_categories,
  public.menu_items, public.modifier_groups, public.modifier_options, public.menu_item_modifier_groups
  to authenticated;

create policy hours_select on public.restaurant_hours for select to anon, authenticated
  using (public.is_publicly_visible(restaurant_id) or public.is_restaurant_member(restaurant_id) or public.is_platform_staff());
create policy hours_write on public.restaurant_hours for all to authenticated
  using (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff())
  with check (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff());

create policy closures_select on public.restaurant_closures for select to anon, authenticated
  using (public.is_publicly_visible(restaurant_id) or public.is_restaurant_member(restaurant_id) or public.is_platform_staff());
create policy closures_write on public.restaurant_closures for all to authenticated
  using (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff())
  with check (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff());

create policy categories_select on public.menu_categories for select to anon, authenticated
  using ((active and public.is_publicly_visible(restaurant_id)) or public.is_restaurant_member(restaurant_id) or public.is_platform_staff());
create policy categories_write on public.menu_categories for all to authenticated
  using (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff())
  with check (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff());

create policy items_select on public.menu_items for select to anon, authenticated
  using ((active and public.is_publicly_visible(restaurant_id)) or public.is_restaurant_member(restaurant_id) or public.is_platform_staff());
create policy items_write on public.menu_items for all to authenticated
  using (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff())
  with check (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff());

create policy modifier_groups_select on public.modifier_groups for select to anon, authenticated
  using (public.is_publicly_visible(restaurant_id) or public.is_restaurant_member(restaurant_id) or public.is_platform_staff());
create policy modifier_groups_write on public.modifier_groups for all to authenticated
  using (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff())
  with check (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff());

create policy modifier_options_select on public.modifier_options for select to anon, authenticated
  using ((active and public.is_publicly_visible(restaurant_id)) or public.is_restaurant_member(restaurant_id) or public.is_platform_staff());
create policy modifier_options_write on public.modifier_options for all to authenticated
  using (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff())
  with check (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff());

create policy item_modifier_groups_select on public.menu_item_modifier_groups for select to anon, authenticated
  using (public.is_publicly_visible(restaurant_id) or public.is_restaurant_member(restaurant_id) or public.is_platform_staff());
create policy item_modifier_groups_write on public.menu_item_modifier_groups for all to authenticated
  using (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff())
  with check (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff());

-- Orders: read-only through the API. Customers see their own; restaurants see actionable orders
-- for their own tenant (never pending payment); platform staff see all. Writes go through functions.
grant select on public.orders, public.order_items, public.order_status_events to authenticated;
create policy orders_customer_select on public.orders for select to authenticated
  using (customer_id = (select auth.uid()));
create policy orders_restaurant_select on public.orders for select to authenticated
  using (order_status <> 'pending_payment' and public.is_restaurant_member(restaurant_id));
create policy orders_platform_select on public.orders for select to authenticated
  using (public.is_platform_staff());

create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy order_status_events_select on public.order_status_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- Pickup codes: only the customer, and only once the restaurant has accepted the order.
grant select on public.order_pickup_codes to authenticated;
create policy pickup_codes_customer_select on public.order_pickup_codes for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.customer_id = (select auth.uid())
      and o.order_status in ('accepted', 'preparing', 'ready_for_collection')
  ));

grant select on public.order_status_transitions to anon, authenticated;
create policy transitions_select on public.order_status_transitions for select to anon, authenticated using (true);

-- Payments: customers see their own attempts; owners/managers reconcile their restaurant; platform
-- staff see all. Provider events are platform-only. No API writes: the payment adapter uses the
-- service role.
grant select on public.payment_attempts, public.refunds, public.payment_events to authenticated;
create policy payment_attempts_select on public.payment_attempts for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()))
    or public.is_restaurant_member(restaurant_id, '{owner,manager}')
    or public.is_platform_staff()
  );
create policy refunds_select on public.refunds for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()))
    or public.is_restaurant_member(restaurant_id, '{owner,manager}')
    or public.is_platform_staff()
  );
create policy payment_events_select on public.payment_events for select to authenticated
  using (public.is_platform_staff());

grant select, update (read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or (user_id is null and public.is_restaurant_member(restaurant_id)));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update on public.platform_settings to authenticated;
create policy platform_settings_select on public.platform_settings for select to authenticated
  using (public.is_platform_staff());
create policy platform_settings_write on public.platform_settings for all to authenticated
  using (public.is_platform_staff('{super_admin}')) with check (public.is_platform_staff('{super_admin}'));

-- Audit log: append-only, written by functions and triggers. Readable by platform staff and by
-- owners for their own restaurant.
grant select on public.audit_logs to authenticated;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (
    public.is_platform_staff()
    or (scope = 'restaurant' and public.is_restaurant_member(restaurant_id, '{owner}'))
  );

-- ---------------------------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------------------------

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_platform_staff(public.platform_role[]) to anon, authenticated;
grant execute on function public.is_restaurant_member(uuid, public.restaurant_role[]) to anon, authenticated;
grant execute on function public.is_publicly_visible(uuid) to anon, authenticated;
grant execute on function public.transition_order(uuid, public.order_status, integer, text, timestamptz) to authenticated;
grant execute on function public.update_order_eta(uuid, integer, timestamptz, text) to authenticated;
grant execute on function public.verify_pickup_code(uuid, text) to authenticated;
grant execute on function public.set_menu_item_availability(uuid, public.item_availability) to authenticated;
grant execute on function public.set_accepting_orders(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Realtime: order changes stream to clients, filtered by the same RLS policies.
-- ---------------------------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders, public.order_status_events;
  end if;
end;
$$;
