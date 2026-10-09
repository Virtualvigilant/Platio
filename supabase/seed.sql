-- Demo data for local development only (`supabase db reset` loads it). Not for production.
-- Restaurants, menus and hours, but no people: sign up in the app, then make yourself staff with
-- the snippet at the bottom.

insert into public.restaurants (id, slug, display_name, description, cuisine_tags, service_area, address, directions,
  status, accepting_orders, pickup_instructions, brand_color, brand_on_color) values
  ('6f1c1f5e-0000-4000-8000-000000000001', 'mama-oliech-kitchen', 'Mama Oliech Kitchen',
   'Home-style Kenyan food cooked to order.', '{Kenyan,Fish,Rice}', 'Kabarak University', 'Next to the library',
   'Side window facing the library steps.', 'published', true,
   'Collect from the side window next to the library entrance. Have your pickup code ready.', '#7a2e12', '#ffffff'),
  ('6f1c1f5e-0000-4000-8000-000000000002', 'campus-grill', 'Campus Grill',
   'Burgers, chips and grilled chicken.', '{Burgers,Chips}', 'Kabarak University', 'Student centre, ground floor',
   null, 'published', true, 'Pick up at the counter marked "Online orders".', null, null),
  ('6f1c1f5e-0000-4000-8000-000000000003', 'bean-and-leaf-cafe', 'Bean & Leaf Café',
   'Coffee, tea and pastries.', '{Coffee,Pastries}', 'Kabarak University', 'Admin block',
   null, 'paused', false, null, null, null);

insert into public.restaurant_hours (restaurant_id, weekday, opens_at, closes_at)
select r.id, d, '07:30', '21:00'
from (values ('6f1c1f5e-0000-4000-8000-000000000001'::uuid), ('6f1c1f5e-0000-4000-8000-000000000002'::uuid),
             ('6f1c1f5e-0000-4000-8000-000000000003'::uuid)) as r (id),
     generate_series(1, 6) as d;

insert into public.menu_categories (id, restaurant_id, name, sort_order) values
  ('6f1c1f5e-0000-4000-9000-000000000011', '6f1c1f5e-0000-4000-8000-000000000001', 'Main dishes', 1),
  ('6f1c1f5e-0000-4000-9000-000000000012', '6f1c1f5e-0000-4000-8000-000000000001', 'Drinks', 2),
  ('6f1c1f5e-0000-4000-9000-000000000021', '6f1c1f5e-0000-4000-8000-000000000002', 'Burgers', 1),
  ('6f1c1f5e-0000-4000-9000-000000000031', '6f1c1f5e-0000-4000-8000-000000000003', 'Coffee', 1);

insert into public.menu_items (restaurant_id, category_id, name, description, price_minor, prep_minutes, tags, availability, sort_order) values
  ('6f1c1f5e-0000-4000-8000-000000000001', '6f1c1f5e-0000-4000-9000-000000000011', 'Pilau with kachumbari',
   'Spiced rice with beef, served with fresh tomato and onion salad.', 35000, 15, '{}', 'available', 1),
  ('6f1c1f5e-0000-4000-8000-000000000001', '6f1c1f5e-0000-4000-9000-000000000011', 'Githeri bowl',
   'Maize and beans stewed with onion and dhania.', 22000, 10, '{Vegetarian}', 'available', 2),
  ('6f1c1f5e-0000-4000-8000-000000000001', '6f1c1f5e-0000-4000-9000-000000000011', 'Beef samosa (2 pcs)',
   'Fried to order.', 10000, 8, '{}', 'unavailable', 3),
  ('6f1c1f5e-0000-4000-8000-000000000001', '6f1c1f5e-0000-4000-9000-000000000012', 'Passion juice',
   'Fresh, no added sugar.', 8000, null, '{}', 'available', 1),
  ('6f1c1f5e-0000-4000-8000-000000000002', '6f1c1f5e-0000-4000-9000-000000000021', 'Beef burger',
   'Grilled beef patty, lettuce, tomato.', 45000, 12, '{}', 'available', 1),
  ('6f1c1f5e-0000-4000-8000-000000000002', '6f1c1f5e-0000-4000-9000-000000000021', 'Chicken burger',
   'Grilled chicken thigh, slaw.', 42000, 12, '{}', 'available', 2),
  ('6f1c1f5e-0000-4000-8000-000000000003', '6f1c1f5e-0000-4000-9000-000000000031', 'Flat white',
   null, 25000, 5, '{}', 'available', 1);

-- After signing up locally, make yourself owner of the first restaurant and a platform admin:
--   insert into public.restaurant_memberships (restaurant_id, user_id, role)
--   select '6f1c1f5e-0000-4000-8000-000000000001', id, 'owner' from auth.users where email = 'you@example.com';
--   insert into public.platform_staff (user_id, role)
--   select id, 'super_admin' from auth.users where email = 'you@example.com';
