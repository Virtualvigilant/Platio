-- Phase 2: the admin restaurant builder (brief §4.3, §6.3, §6.4, §7.2, §7.3, §7.4).
--
--   * Restaurant status changes only through transition_restaurant(), which checks the lifecycle
--     table, the caller's platform permission, an audit reason where required, and (to publish)
--     the readiness checklist.
--   * Owners and managers may edit only the fields their role allows; slugs lock once published.
--   * Owners and staff join through verifiable, expiring, revocable invitations.
--   * Images live in the public "restaurant-assets" bucket under <restaurant_id>/...

-- ---------------------------------------------------------------------------------------------
-- Restaurant columns
-- ---------------------------------------------------------------------------------------------

alter table public.restaurants
  add column public_phone text check (char_length(public_phone) <= 20),
  add column storefront_layout text not null default 'standard'
    check (storefront_layout in ('standard', 'cover')),
  add column first_published_at timestamptz,
  add column created_by uuid references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------------------------
-- Platform permissions (mirrors PLATFORM_GRANTS in src/domain/access.ts; a test keeps them equal)
-- ---------------------------------------------------------------------------------------------

create function public.platform_can(p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.platform_staff ps
    where ps.user_id = (select auth.uid())
      and (
        ps.role = 'super_admin'
        or (ps.role = 'support' and p_permission = any (array[
          'restaurants.read', 'restaurants.onboard', 'orders.read', 'payments.read', 'audit.read'
        ]))
      )
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Lifecycle (mirrors RESTAURANT_TRANSITIONS in src/domain/restaurants/lifecycle.ts)
-- ---------------------------------------------------------------------------------------------

create table public.restaurant_status_transitions (
  from_status public.restaurant_status not null,
  to_status public.restaurant_status not null,
  permission text not null
    check (permission in ('restaurants.onboard', 'restaurants.publish', 'restaurants.suspend')),
  requires_reason boolean not null,
  primary key (from_status, to_status)
);

insert into public.restaurant_status_transitions (from_status, to_status, permission, requires_reason) values
  ('draft', 'ready_for_review', 'restaurants.onboard', false),
  ('draft', 'published', 'restaurants.publish', false),
  ('draft', 'archived', 'restaurants.suspend', true),
  ('ready_for_review', 'draft', 'restaurants.onboard', false),
  ('ready_for_review', 'published', 'restaurants.publish', false),
  ('ready_for_review', 'archived', 'restaurants.suspend', true),
  ('published', 'paused', 'restaurants.publish', true),
  ('published', 'suspended', 'restaurants.suspend', true),
  ('published', 'draft', 'restaurants.publish', true),
  ('published', 'archived', 'restaurants.suspend', true),
  ('paused', 'published', 'restaurants.publish', true),
  ('paused', 'suspended', 'restaurants.suspend', true),
  ('paused', 'draft', 'restaurants.publish', true),
  ('paused', 'archived', 'restaurants.suspend', true),
  ('suspended', 'published', 'restaurants.suspend', true),
  ('suspended', 'draft', 'restaurants.suspend', true),
  ('suspended', 'archived', 'restaurants.suspend', true),
  ('archived', 'draft', 'restaurants.suspend', true);

alter table public.restaurant_status_transitions enable row level security;
grant select on public.restaurant_status_transitions to authenticated;
create policy restaurant_transitions_select on public.restaurant_status_transitions
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------------------------
-- Payment settings. Methods and onboarding state only; provider secrets live in managed secret
-- storage, never in tables (§6.4, §7.2 step 6).
-- ---------------------------------------------------------------------------------------------

create table public.restaurant_payment_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  pay_at_pickup_enabled boolean not null default true,
  online_enabled boolean not null default false,
  provider text check (char_length(provider) <= 40),
  merchant_reference text check (char_length(merchant_reference) <= 60),
  onboarding_status text not null default 'not_started'
    check (onboarding_status in ('not_started', 'in_progress', 'ready')),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (not online_enabled or onboarding_status = 'ready')
);
create trigger restaurant_payment_settings_updated_at before update on public.restaurant_payment_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_payment_settings enable row level security;
grant select on public.restaurant_payment_settings to authenticated;
grant update (pay_at_pickup_enabled, online_enabled, provider, merchant_reference, onboarding_status)
  on public.restaurant_payment_settings to authenticated;
create policy payment_settings_select on public.restaurant_payment_settings for select to authenticated
  using (public.is_restaurant_member(restaurant_id, '{owner,manager}') or public.is_platform_staff());
create policy payment_settings_update on public.restaurant_payment_settings for update to authenticated
  using (public.platform_can('restaurants.onboard'))
  with check (public.platform_can('restaurants.onboard'));

-- Every restaurant gets its private record and payment settings, and its creation is audited.
create function public.handle_new_restaurant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.restaurant_private (restaurant_id) values (new.id) on conflict do nothing;
  insert into public.restaurant_payment_settings (restaurant_id) values (new.id) on conflict do nothing;
  perform public.write_audit('platform', new.id, 'restaurant.created', 'restaurant', new.id::text, null,
    jsonb_build_object('slug', new.slug));
  return new;
end;
$$;
create trigger restaurants_after_insert after insert on public.restaurants
  for each row execute function public.handle_new_restaurant();

create function public.set_restaurant_created_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_by := (select auth.uid());
  new.status := 'draft';
  new.first_published_at := null;
  return new;
end;
$$;
create trigger restaurants_before_insert before insert on public.restaurants
  for each row when (current_setting('role', true) = 'authenticated')
  execute function public.set_restaurant_created_by();

-- ---------------------------------------------------------------------------------------------
-- Who may change which restaurant fields
-- ---------------------------------------------------------------------------------------------

-- Status is no longer directly writable: it changes through transition_restaurant().
revoke update on public.restaurants from authenticated;
grant update (
  display_name, slug, description, cuisine_tags, logo_path, cover_path, brand_color, brand_on_color,
  storefront_layout, public_phone, service_area, address, directions, latitude, longitude,
  pickup_enabled, dine_in_enabled, pickup_instructions, prep_presets, default_prep_minutes
) on public.restaurants to authenticated;

-- Replaces the Phase 1 guard. Owners edit their public profile and operations; managers edit
-- operations; identity, branding and the web address stay with platform staff (§6.4: "some
-- sensitive fields may require platform review").
create or replace function public.guard_restaurant_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_changed text[];
  v_allowed text[];
  v_owner text[] := array[
    'description', 'cuisine_tags', 'logo_path', 'cover_path', 'public_phone', 'service_area',
    'address', 'directions', 'latitude', 'longitude', 'pickup_enabled', 'dine_in_enabled',
    'pickup_instructions', 'prep_presets', 'default_prep_minutes', 'accepting_orders', 'pause_reason'
  ];
  v_manager text[] := array[
    'pickup_enabled', 'dine_in_enabled', 'pickup_instructions', 'prep_presets',
    'default_prep_minutes', 'accepting_orders', 'pause_reason'
  ];
begin
  select coalesce(array_agg(n.key order by n.key), '{}') into v_changed
  from jsonb_each(to_jsonb(new)) n
  where n.key <> 'updated_at' and n.value is distinct from (to_jsonb(old) -> n.key);

  if new.slug is distinct from old.slug and old.first_published_at is not null then
    raise exception 'A restaurant’s web address can’t change after it has been published'
      using errcode = '22023';
  end if;

  if (select auth.uid()) is not null and not public.is_platform_staff() then
    if public.is_restaurant_member(new.id, '{owner}') then
      v_allowed := v_owner;
    elsif public.is_restaurant_member(new.id, '{manager}') then
      v_allowed := v_manager;
    else
      v_allowed := '{}';
    end if;
    if not v_changed <@ v_allowed then
      raise exception 'Your role can’t change: %',
        array_to_string(array(select unnest(v_changed) except select unnest(v_allowed)), ', ')
        using errcode = '42501';
    end if;
  end if;

  -- Status changes are audited by transition_restaurant(); pause toggles by set_accepting_orders().
  v_changed := array(
    select f from unnest(v_changed) f
    where f <> all (array['status', 'first_published_at', 'accepting_orders', 'pause_reason'])
    order by f
  );
  if cardinality(v_changed) > 0 then
    perform public.write_audit('restaurant', new.id, 'restaurant.updated', 'restaurant', new.id::text,
      null, jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Readiness checklist (§7.2 step 8 "validation checklist"). Publishing requires every check.
-- Keys are mapped to wizard steps in src/domain/restaurants/readiness.ts.
-- ---------------------------------------------------------------------------------------------

create function public.restaurant_readiness(p_restaurant_id uuid)
returns table (check_key text, ok boolean, message text)
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.restaurants;
begin
  select * into r from public.restaurants where id = p_restaurant_id;
  if not found or not (public.is_platform_staff() or public.is_restaurant_member(p_restaurant_id, '{owner,manager}')) then
    raise exception 'Restaurant not found' using errcode = 'P0002';
  end if;

  return query values
    ('identity',
     coalesce(btrim(r.description), '') <> '' and cardinality(r.cuisine_tags) > 0,
     'Add a description and at least one cuisine label.'),
    ('location',
     coalesce(btrim(r.address), '') <> '' or coalesce(btrim(r.service_area), '') <> '',
     'Add an address or service area so customers can find the restaurant.'),
    ('hours',
     exists (select 1 from public.restaurant_hours h where h.restaurant_id = r.id),
     'Set opening hours for at least one day.'),
    ('operations',
     not r.pickup_enabled or coalesce(btrim(r.pickup_instructions), '') <> '',
     'Add pickup instructions so customers know where to collect.'),
    ('menu',
     exists (
       select 1 from public.menu_items i
       join public.menu_categories c on c.id = i.category_id
       where i.restaurant_id = r.id and i.active and c.active
     ),
     'Add at least one dish to an active menu category.'),
    ('payments',
     exists (
       select 1 from public.restaurant_payment_settings p
       where p.restaurant_id = r.id and (p.pay_at_pickup_enabled or p.online_enabled)
     ),
     'Turn on at least one way to pay.'),
    ('team',
     exists (
       select 1 from public.restaurant_memberships m
       where m.restaurant_id = r.id and m.role = 'owner' and m.status = 'active'
     ),
     'Invite an owner. Publishing waits until they accept, so someone can take orders.');
end;
$$;

create function public.transition_restaurant(
  p_restaurant_id uuid,
  p_to public.restaurant_status,
  p_reason text default null
) returns public.restaurants
language plpgsql security definer set search_path = '' as $$
declare
  v_r public.restaurants;
  v_rule public.restaurant_status_transitions;
  v_problems text;
begin
  select * into v_r from public.restaurants where id = p_restaurant_id for update;
  if not found or not public.is_platform_staff() then
    raise exception 'Restaurant not found' using errcode = 'P0002';
  end if;

  select * into v_rule from public.restaurant_status_transitions
  where from_status = v_r.status and to_status = p_to;
  if not found then
    raise exception 'A restaurant can’t move from % to %', v_r.status, p_to using errcode = '22023';
  end if;
  if not public.platform_can(v_rule.permission) then
    raise exception 'Your role can’t do this. Ask a super-admin.' using errcode = '42501';
  end if;
  if v_rule.requires_reason and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Give a reason for the audit log' using errcode = '22023';
  end if;

  if p_to = 'published' then
    select string_agg(message, ' ') into v_problems
    from public.restaurant_readiness(p_restaurant_id) where not ok;
    if v_problems is not null then
      raise exception 'This restaurant isn’t ready to publish. %', v_problems using errcode = '22023';
    end if;
  end if;

  update public.restaurants set
    status = p_to,
    first_published_at = case when p_to = 'published' then coalesce(first_published_at, now()) else first_published_at end,
    -- A first publish opens ordering; later moves keep the restaurant's own pause switch.
    accepting_orders = case when p_to = 'published' and first_published_at is null then true else accepting_orders end
  where id = p_restaurant_id
  returning * into v_r;

  perform public.write_audit('platform', v_r.id, 'restaurant.status_changed', 'restaurant', v_r.id::text,
    nullif(btrim(p_reason), ''), jsonb_build_object('from', v_rule.from_status, 'to', p_to));
  return v_r;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Opening hours: replaced as a whole week, atomically, with validation.
-- p_hours: [{"weekday": 1, "opens_at": "07:30", "closes_at": "21:00"}, ...]
-- ---------------------------------------------------------------------------------------------

create function public.set_restaurant_hours(p_restaurant_id uuid, p_hours jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if not (public.is_restaurant_member(p_restaurant_id, '{owner,manager}') or public.is_platform_staff()) then
    raise exception 'Restaurant not found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) > 21 then
    raise exception 'Send up to three opening periods for each day' using errcode = '22023';
  end if;

  delete from public.restaurant_hours where restaurant_id = p_restaurant_id;
  insert into public.restaurant_hours (restaurant_id, weekday, opens_at, closes_at)
  select p_restaurant_id, (h ->> 'weekday')::smallint, (h ->> 'opens_at')::time, (h ->> 'closes_at')::time
  from jsonb_array_elements(p_hours) h;

  select count(*) into v_count
  from public.restaurant_hours a
  join public.restaurant_hours b
    on a.restaurant_id = b.restaurant_id and a.weekday = b.weekday and a.id < b.id
   and a.opens_at < b.closes_at and b.opens_at < a.closes_at
  where a.restaurant_id = p_restaurant_id;
  if v_count > 0 then
    raise exception 'Opening periods on the same day can’t overlap' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.restaurant_hours where restaurant_id = p_restaurant_id
    group by weekday having count(*) > 3
  ) then
    raise exception 'Use at most three opening periods a day' using errcode = '22023';
  end if;

  perform public.write_audit('restaurant', p_restaurant_id, 'restaurant.hours_changed', 'restaurant',
    p_restaurant_id::text, null, jsonb_build_object('periods', jsonb_array_length(p_hours)));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Menu: ordering, and audit of price changes and archiving (§6.3, §12)
-- ---------------------------------------------------------------------------------------------

create function public.reorder_menu_categories(p_restaurant_id uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_restaurant_member(p_restaurant_id, '{owner,manager}') or public.is_platform_staff()) then
    raise exception 'Restaurant not found' using errcode = 'P0002';
  end if;
  update public.menu_categories c set sort_order = x.ord
  from unnest(p_ids) with ordinality as x (id, ord)
  where c.id = x.id and c.restaurant_id = p_restaurant_id;
end;
$$;

create function public.reorder_menu_items(p_category_id uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from public.menu_categories where id = p_category_id;
  if v_restaurant is null
     or not (public.is_restaurant_member(v_restaurant, '{owner,manager}') or public.is_platform_staff()) then
    raise exception 'Category not found' using errcode = 'P0002';
  end if;
  update public.menu_items i set sort_order = x.ord
  from unnest(p_ids) with ordinality as x (id, ord)
  where i.id = x.id and i.category_id = p_category_id;
end;
$$;

create function public.audit_menu_item_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.price_minor is distinct from old.price_minor then
    perform public.write_audit('restaurant', new.restaurant_id, 'menu_item.price_changed', 'menu_item',
      new.id::text, null, jsonb_build_object('name', new.name, 'from', old.price_minor, 'to', new.price_minor));
  end if;
  if new.active is distinct from old.active then
    perform public.write_audit('restaurant', new.restaurant_id,
      case when new.active then 'menu_item.restored' else 'menu_item.archived' end,
      'menu_item', new.id::text, null, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;
create trigger menu_items_audit after update on public.menu_items
  for each row execute function public.audit_menu_item_change();

-- ---------------------------------------------------------------------------------------------
-- Invitations (§3.1, §4.3 step 6, §6.4, §7.2 step 7): verifiable, expiring, revocable.
-- Only a SHA-256 hash of the token is stored; the token is shown once to whoever creates it.
-- ---------------------------------------------------------------------------------------------

alter table public.restaurant_memberships add column invitation_id uuid;

create table public.restaurant_invitations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.restaurant_role not null,
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  check (expires_at > created_at),
  check (accepted_at is null or revoked_at is null)
);
create unique index restaurant_invitations_one_pending
  on public.restaurant_invitations (restaurant_id, email)
  where accepted_at is null and revoked_at is null;

alter table public.restaurant_memberships
  add constraint restaurant_memberships_invitation_fk
  foreign key (invitation_id) references public.restaurant_invitations (id) on delete set null;

alter table public.restaurant_invitations enable row level security;
grant select (id, restaurant_id, email, role, invited_by, created_at, expires_at, accepted_at, accepted_by, revoked_at)
  on public.restaurant_invitations to authenticated;
create policy invitations_select on public.restaurant_invitations for select to authenticated
  using (public.is_platform_staff() or public.is_restaurant_member(restaurant_id, '{owner}'));

create function public.create_restaurant_invitation(
  p_restaurant_id uuid, p_email text, p_role public.restaurant_role
) returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_status public.restaurant_status;
  v_inv public.restaurant_invitations;
begin
  select status into v_status from public.restaurants where id = p_restaurant_id;
  if v_status is null
     or not (
       public.platform_can('restaurants.onboard')
       or (p_role <> 'owner' and public.is_restaurant_member(p_restaurant_id, '{owner}'))
     ) then
    raise exception 'Restaurant not found' using errcode = 'P0002';
  end if;
  if v_status = 'archived' then
    raise exception 'Reactivate this restaurant before inviting people' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter an email address like owner@example.com' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.restaurant_memberships m join auth.users u on u.id = m.user_id
    where m.restaurant_id = p_restaurant_id and m.status = 'active' and lower(u.email) = v_email
  ) then
    raise exception 'This person is already on the team' using errcode = '23505';
  end if;

  -- A new invitation replaces any pending one for the same person.
  update public.restaurant_invitations i
  set revoked_at = now(), revoked_by = (select auth.uid())
  where i.restaurant_id = p_restaurant_id and i.email = v_email
    and i.accepted_at is null and i.revoked_at is null;

  insert into public.restaurant_invitations (restaurant_id, email, role, token_hash, invited_by)
  values (p_restaurant_id, v_email, p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), (select auth.uid()))
  returning * into v_inv;

  perform public.write_audit('restaurant', p_restaurant_id, 'invitation.created', 'invitation', v_inv.id::text,
    null, jsonb_build_object('email', v_email, 'role', p_role));
  return query select v_inv.id, v_token, v_inv.expires_at;
end;
$$;

create function public.revoke_restaurant_invitation(p_invitation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.restaurant_invitations;
begin
  select * into v_inv from public.restaurant_invitations where id = p_invitation_id for update;
  if not found
     or not (
       public.platform_can('restaurants.onboard')
       or (v_inv.role <> 'owner' and public.is_restaurant_member(v_inv.restaurant_id, '{owner}'))
     ) then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'This invitation was already accepted. Remove the person from the team instead.'
      using errcode = '22023';
  end if;
  update public.restaurant_invitations set revoked_at = coalesce(revoked_at, now()), revoked_by = (select auth.uid())
  where id = p_invitation_id;
  perform public.write_audit('restaurant', v_inv.restaurant_id, 'invitation.revoked', 'invitation',
    v_inv.id::text, null, jsonb_build_object('email', v_inv.email, 'role', v_inv.role));
end;
$$;

-- What the invitation page shows before accepting. Holding the token is the proof; the email is
-- masked so a forwarded link reveals little.
create function public.get_restaurant_invitation(p_token text)
returns table (restaurant_name text, role public.restaurant_role, email_hint text, state text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.display_name,
         i.role,
         left(i.email, 2) || '•••' || substring(i.email from position('@' in i.email)),
         case
           when i.revoked_at is not null then 'revoked'
           when i.accepted_at is not null then 'accepted'
           when i.expires_at <= now() then 'expired'
           else 'valid'
         end,
         i.expires_at
  from public.restaurant_invitations i
  join public.restaurants r on r.id = i.restaurant_id
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

create function public.accept_restaurant_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.restaurant_invitations;
  v_email text;
  v_confirmed timestamptz;
begin
  if v_uid is null then
    raise exception 'Sign in to accept this invitation' using errcode = '42501';
  end if;
  select * into v_inv from public.restaurant_invitations
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;
  if not found then
    raise exception 'This invitation link isn’t valid' using errcode = 'P0002';
  end if;
  if v_inv.accepted_at is not null then
    if v_inv.accepted_by = v_uid then
      return v_inv.restaurant_id;
    end if;
    raise exception 'This invitation has already been used' using errcode = '22023';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'This invitation was withdrawn. Ask for a new one.' using errcode = '22023';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'This invitation has expired. Ask for a new one.' using errcode = '22023';
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_uid;
  if v_email is distinct from v_inv.email or v_confirmed is null then
    raise exception 'This invitation is for a different email address. Sign in with the address it was sent to.'
      using errcode = '42501';
  end if;
  if exists (
    select 1 from public.restaurant_memberships
    where restaurant_id = v_inv.restaurant_id and user_id = v_uid and status = 'active'
  ) then
    raise exception 'You’re already on this restaurant’s team' using errcode = '23505';
  end if;

  update public.restaurant_invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  -- An older invited/revoked row for this person would block the new active membership.
  delete from public.restaurant_memberships
  where restaurant_id = v_inv.restaurant_id and user_id = v_uid and status = 'invited';
  insert into public.restaurant_memberships (restaurant_id, user_id, role, status, invited_by, invitation_id)
  values (v_inv.restaurant_id, v_uid, v_inv.role, 'active', v_inv.invited_by, v_inv.id);

  perform public.write_audit('restaurant', v_inv.restaurant_id, 'invitation.accepted', 'invitation',
    v_inv.id::text, null, jsonb_build_object('role', v_inv.role));
  return v_inv.restaurant_id;
end;
$$;

-- Owners are created by platform staff or by accepting an owner invitation; a restaurant never
-- loses its last owner except by platform staff.
create or replace function public.guard_membership_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_platform boolean := public.is_platform_staff();
begin
  if new.role = 'owner' and (tg_op = 'INSERT' or old.role <> 'owner' or old.status <> 'active')
     and v_uid is not null and not v_platform
     and not exists (
       select 1 from public.restaurant_invitations i
       where i.id = new.invitation_id and i.role = 'owner' and i.restaurant_id = new.restaurant_id
         and i.accepted_by = new.user_id and i.accepted_at is not null
     ) then
    raise exception 'Only platform staff can assign an owner' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.role = 'owner' and old.status = 'active'
     and (new.role <> 'owner' or new.status <> 'active')
     and v_uid is not null and not v_platform
     and not exists (
       select 1 from public.restaurant_memberships m
       where m.restaurant_id = old.restaurant_id and m.id <> old.id and m.role = 'owner' and m.status = 'active'
     ) then
    raise exception 'A restaurant needs at least one owner. Ask platform support to transfer ownership.'
      using errcode = '22023';
  end if;

  perform public.write_audit('restaurant', new.restaurant_id, 'membership.' || lower(tg_op), 'membership',
    new.id::text, null, jsonb_build_object('user_id', new.user_id, 'role', new.role, 'status', new.status));
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Team and onboarding views for owners and platform staff
-- ---------------------------------------------------------------------------------------------

-- Members with their sign-in email (auth.users is not readable through the API). Owners see their
-- own team; platform staff see any team.
create function public.list_restaurant_team(p_restaurant_id uuid)
returns table (
  membership_id uuid, user_id uuid, email text, display_name text,
  role public.restaurant_role, status public.membership_status, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_platform_staff() or public.is_restaurant_member(p_restaurant_id, '{owner}')) then
    raise exception 'Restaurant not found' using errcode = 'P0002';
  end if;
  return query
    select m.id, m.user_id, u.email::text, p.display_name, m.role, m.status, m.created_at
    from public.restaurant_memberships m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    where m.restaurant_id = p_restaurant_id and m.status <> 'revoked'
    order by case m.role when 'owner' then 0 when 'manager' then 1 else 2 end, m.created_at;
end;
$$;

-- How far through the readiness checklist each listed restaurant is, for the admin list.
create function public.restaurant_readiness_summary(p_ids uuid[])
returns table (restaurant_id uuid, passed integer, total integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.is_platform_staff() then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  foreach v_id in array coalesce(p_ids[1:100], '{}') loop
    if exists (select 1 from public.restaurants where id = v_id) then
      return query
        select v_id, count(*) filter (where r.ok)::integer, count(*)::integer
        from public.restaurant_readiness(v_id) r;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Image storage (§6.3, §12): public bucket, 2 MB, PNG/JPEG/WebP. Object names are always
-- <restaurant_id>/<logo|cover|item>/<uuid>.<png|jpg|webp>, built by the server, never from file names.
-- Deletes go through the Storage API (.remove()), which needs the SELECT and DELETE policies.
-- ---------------------------------------------------------------------------------------------

create function public.can_manage_restaurant_asset(p_object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_first text := split_part(coalesce(p_object_name, ''), '/', 1);
begin
  if v_first !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_restaurant_member(v_first::uuid, '{owner,manager}') or public.platform_can('restaurants.onboard');
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('restaurant-assets', 'restaurant-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    execute $p$
      create policy restaurant_assets_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'restaurant-assets'
        and name ~ '^[0-9a-f-]{36}/(logo|cover|item)/[0-9a-f-]{36}\.(png|jpg|webp)$'
        and public.can_manage_restaurant_asset(name)
      )
    $p$;
    execute $p$
      create policy restaurant_assets_update on storage.objects for update to authenticated
      using (bucket_id = 'restaurant-assets' and public.can_manage_restaurant_asset(name))
      with check (
        bucket_id = 'restaurant-assets'
        and name ~ '^[0-9a-f-]{36}/(logo|cover|item)/[0-9a-f-]{36}\.(png|jpg|webp)$'
        and public.can_manage_restaurant_asset(name)
      )
    $p$;
    execute $p$
      create policy restaurant_assets_delete on storage.objects for delete to authenticated
      using (bucket_id = 'restaurant-assets' and public.can_manage_restaurant_asset(name))
    $p$;
    -- Needed by upsert and listing; downloads use the public URL and need no policy.
    execute $p$
      create policy restaurant_assets_select on storage.objects for select to authenticated
      using (bucket_id = 'restaurant-assets' and public.can_manage_restaurant_asset(name))
    $p$;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------------------------

revoke all on function public.platform_can(text) from public, anon;
revoke all on function public.handle_new_restaurant() from public, anon, authenticated;
revoke all on function public.set_restaurant_created_by() from public, anon, authenticated;
revoke all on function public.audit_menu_item_change() from public, anon, authenticated;
revoke all on function public.restaurant_readiness(uuid) from public, anon;
revoke all on function public.transition_restaurant(uuid, public.restaurant_status, text) from public, anon;
revoke all on function public.set_restaurant_hours(uuid, jsonb) from public, anon;
revoke all on function public.reorder_menu_categories(uuid, uuid[]) from public, anon;
revoke all on function public.reorder_menu_items(uuid, uuid[]) from public, anon;
revoke all on function public.create_restaurant_invitation(uuid, text, public.restaurant_role) from public, anon;
revoke all on function public.revoke_restaurant_invitation(uuid) from public, anon;
revoke all on function public.accept_restaurant_invitation(text) from public, anon;
revoke all on function public.can_manage_restaurant_asset(text) from public, anon;
revoke all on function public.list_restaurant_team(uuid) from public, anon;
revoke all on function public.restaurant_readiness_summary(uuid[]) from public, anon;

grant execute on function public.platform_can(text) to authenticated;
grant execute on function public.restaurant_readiness(uuid) to authenticated;
grant execute on function public.transition_restaurant(uuid, public.restaurant_status, text) to authenticated;
grant execute on function public.set_restaurant_hours(uuid, jsonb) to authenticated;
grant execute on function public.reorder_menu_categories(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_menu_items(uuid, uuid[]) to authenticated;
grant execute on function public.create_restaurant_invitation(uuid, text, public.restaurant_role) to authenticated;
grant execute on function public.revoke_restaurant_invitation(uuid) to authenticated;
grant execute on function public.get_restaurant_invitation(text) to anon, authenticated;
grant execute on function public.accept_restaurant_invitation(text) to authenticated;
grant execute on function public.can_manage_restaurant_asset(text) to authenticated;
grant execute on function public.list_restaurant_team(uuid) to authenticated;
grant execute on function public.restaurant_readiness_summary(uuid[]) to authenticated;
