// Fixed IDs so tests can refer to the same people, restaurants and orders.
export const U = {
  ownerA: "00000000-0000-4000-a000-00000000000a",
  staffA: "00000000-0000-4000-a000-00000000005a",
  ownerB: "00000000-0000-4000-a000-00000000000b",
  revokedA: "00000000-0000-4000-a000-0000000000e0",
  customer1: "00000000-0000-4000-a000-0000000000c1",
  customer2: "00000000-0000-4000-a000-0000000000c2",
  admin: "00000000-0000-4000-a000-0000000000ad",
  support: "00000000-0000-4000-a000-0000000000a5",
} as const;

export const R = {
  a: "00000000-0000-4000-b000-00000000000a",
  b: "00000000-0000-4000-b000-00000000000b",
  draft: "00000000-0000-4000-b000-00000000000d",
  suspended: "00000000-0000-4000-b000-000000000005",
} as const;

export const ITEM = {
  a: "00000000-0000-4000-c000-00000000000a",
  b: "00000000-0000-4000-c000-00000000000b",
  draft: "00000000-0000-4000-c000-00000000000d",
} as const;

export const ORDER = {
  /** customer1 at A, paid, waiting for the restaurant. */
  aPaid: "00000000-0000-4000-d000-0000000000a1",
  /** customer1 at A, payment not yet confirmed. */
  aPending: "00000000-0000-4000-d000-0000000000a0",
  /** customer2 at B, pay at pickup, ready for collection. */
  bReady: "00000000-0000-4000-d000-0000000000b1",
} as const;

export const PICKUP = { aPaid: "K7A4", bReady: "MX39" } as const;

export const FIXTURES_SQL = /* sql */ `
insert into auth.users (id, email) values
  ('${U.ownerA}', 'owner-a@example.test'),
  ('${U.staffA}', 'staff-a@example.test'),
  ('${U.ownerB}', 'owner-b@example.test'),
  ('${U.revokedA}', 'revoked-a@example.test'),
  ('${U.customer1}', 'customer1@example.test'),
  ('${U.customer2}', 'customer2@example.test'),
  ('${U.admin}', 'admin@example.test'),
  ('${U.support}', 'support@example.test');

insert into public.platform_staff (user_id, role) values
  ('${U.admin}', 'super_admin'),
  ('${U.support}', 'support');

insert into public.restaurants (id, slug, display_name, status, accepting_orders) values
  ('${R.a}', 'mama-oliech-kitchen', 'Mama Oliech Kitchen', 'published', true),
  ('${R.b}', 'campus-grill', 'Campus Grill', 'published', true),
  ('${R.draft}', 'bean-and-leaf-cafe', 'Bean & Leaf Café', 'draft', false),
  ('${R.suspended}', 'closed-kiosk', 'Closed Kiosk', 'suspended', false);

insert into public.restaurant_private (restaurant_id, legal_name, contact_phone) values
  ('${R.a}', 'Oliech Foods Ltd', '+254700000001'),
  ('${R.b}', 'Campus Grill Ventures', '+254700000002');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('${R.a}', '${U.ownerA}', 'owner', 'active'),
  ('${R.a}', '${U.staffA}', 'staff', 'active'),
  ('${R.a}', '${U.revokedA}', 'staff', 'revoked'),
  ('${R.b}', '${U.ownerB}', 'owner', 'active');

insert into public.menu_categories (id, restaurant_id, name) values
  ('00000000-0000-4000-e000-00000000000a', '${R.a}', 'Main dishes'),
  ('00000000-0000-4000-e000-00000000000b', '${R.b}', 'Burgers'),
  ('00000000-0000-4000-e000-00000000000d', '${R.draft}', 'Coffee');

insert into public.menu_items (id, restaurant_id, category_id, name, price_minor, prep_minutes) values
  ('${ITEM.a}', '${R.a}', '00000000-0000-4000-e000-00000000000a', 'Pilau with kachumbari', 35000, 15),
  ('${ITEM.b}', '${R.b}', '00000000-0000-4000-e000-00000000000b', 'Beef burger', 45000, 12),
  ('${ITEM.draft}', '${R.draft}', '00000000-0000-4000-e000-00000000000d', 'Flat white', 25000, 5);

insert into public.orders (id, customer_id, restaurant_id, order_mode, payment_method, order_status, payment_status,
  item_subtotal_minor, fee_minor, total_minor, customer_note, idempotency_key) values
  ('${ORDER.aPaid}', '${U.customer1}', '${R.a}', 'pickup', 'online', 'awaiting_restaurant', 'confirmed',
    70000, 3000, 73000, 'No chilli, please', 'fixture-a-paid'),
  ('${ORDER.aPending}', '${U.customer1}', '${R.a}', 'pickup', 'online', 'pending_payment', 'pending',
    35000, 3000, 38000, null, 'fixture-a-pending'),
  ('${ORDER.bReady}', '${U.customer2}', '${R.b}', 'pickup', 'pay_at_pickup', 'ready_for_collection', 'pay_at_pickup',
    45000, 0, 45000, null, 'fixture-b-ready');

insert into public.order_items (order_id, restaurant_id, menu_item_id, item_name_snapshot, unit_price_minor, quantity, line_total_minor) values
  ('${ORDER.aPaid}', '${R.a}', '${ITEM.a}', 'Pilau with kachumbari', 35000, 2, 70000),
  ('${ORDER.aPending}', '${R.a}', '${ITEM.a}', 'Pilau with kachumbari', 35000, 1, 35000),
  ('${ORDER.bReady}', '${R.b}', '${ITEM.b}', 'Beef burger', 45000, 1, 45000);

insert into public.order_pickup_codes (order_id, code) values
  ('${ORDER.aPaid}', '${PICKUP.aPaid}'),
  ('${ORDER.bReady}', '${PICKUP.bReady}');
`;
