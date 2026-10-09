// Brief §17.1: an owner or staff member of Restaurant A cannot read or change Restaurant B's
// private data by guessing IDs, and public endpoints never reveal private data.
import { describe, expect, it } from "vitest";
import { asAnon, asSystem, asUser, attempt } from "./db";
import { ITEM, ORDER, R, U } from "./fixtures";

const PERMISSION_DENIED = "42501";

describe("anonymous visitors", () => {
  it("see published and paused restaurants only", async () => {
    const rows = await asAnon((q) => q("select id from public.restaurants order by slug"));
    expect(rows.rows.map((r) => r.id).sort()).toEqual([R.a, R.b].sort());
  });

  it("see menus of visible restaurants only", async () => {
    const rows = await asAnon((q) => q("select id from public.menu_items"));
    expect(rows.rows.map((r) => r.id).sort()).toEqual([ITEM.a, ITEM.b].sort());
  });

  it("cannot read orders, private details, memberships or audit logs at all", async () => {
    await asAnon(async (q) => {
      for (const table of [
        "orders",
        "order_items",
        "restaurant_private",
        "restaurant_memberships",
        "audit_logs",
        "order_pickup_codes",
      ]) {
        expect(await attempt(q, `select * from public.${table}`), table).toBe(PERMISSION_DENIED);
      }
    });
  });

  it("cannot call order commands", async () => {
    await asAnon(async (q) => {
      expect(
        await attempt(q, "select public.transition_order($1, 'collected', 0)", [ORDER.bReady]),
      ).toBe(PERMISSION_DENIED);
    });
  });
});

describe("restaurant staff stay inside their own restaurant", () => {
  it("owner A reads A's private details but not B's", async () => {
    const rows = await asUser(U.ownerA, (q) =>
      q("select restaurant_id from public.restaurant_private"),
    );
    expect(rows.rows.map((r) => r.restaurant_id)).toEqual([R.a]);
  });

  it("counter staff cannot read private details even for their own restaurant", async () => {
    const rows = await asUser(U.staffA, (q) => q("select * from public.restaurant_private"));
    expect(rows.rowCount).toBe(0);
  });

  it("staff A sees A's actionable order but not A's unpaid order or anything at B", async () => {
    const rows = await asUser(U.staffA, (q) => q("select id from public.orders"));
    expect(rows.rows.map((r) => r.id)).toEqual([ORDER.aPaid]);
  });

  it("owner A gets nothing back when asking for B's order, items or timeline by ID", async () => {
    await asUser(U.ownerA, async (q) => {
      expect((await q("select * from public.orders where id = $1", [ORDER.bReady])).rowCount).toBe(
        0,
      );
      expect(
        (await q("select * from public.order_items where order_id = $1", [ORDER.bReady])).rowCount,
      ).toBe(0);
      expect(
        (await q("select * from public.order_status_events where order_id = $1", [ORDER.bReady]))
          .rowCount,
      ).toBe(0);
      expect(
        (await q("select * from public.payment_attempts where order_id = $1", [ORDER.bReady]))
          .rowCount,
      ).toBe(0);
    });
  });

  it("owner A cannot change B's menu, and B's price stays the same", async () => {
    await asUser(U.ownerA, async (q) => {
      const res = await q("update public.menu_items set price_minor = 1 where id = $1", [ITEM.b]);
      expect(res.rowCount).toBe(0);
    });
    const price = await asSystem((q) =>
      q("select price_minor from public.menu_items where id = $1", [ITEM.b]),
    );
    expect(price.rows[0].price_minor).toBe(45000);
  });

  it("owner A cannot add items to B's menu", async () => {
    await asUser(U.ownerA, async (q) => {
      const code = await attempt(
        q,
        `insert into public.menu_items (restaurant_id, category_id, name, price_minor)
         values ($1, '00000000-0000-4000-e000-00000000000b', 'Injected', 100)`,
        [R.b],
      );
      expect(code).toBe(PERMISSION_DENIED);
    });
  });

  it("owner A cannot file an item of A under one of B's categories", async () => {
    await asUser(U.ownerA, async (q) => {
      const code = await attempt(
        q,
        `insert into public.menu_items (restaurant_id, category_id, name, price_minor)
         values ($1, '00000000-0000-4000-e000-00000000000b', 'Cross-tenant', 100)`,
        [R.a],
      );
      expect(code).toBe("23503"); // foreign key: category belongs to another restaurant
    });
  });

  it("owner A edits A's own menu", async () => {
    const res = await asUser(U.ownerA, (q) =>
      q("update public.menu_items set price_minor = 36000 where id = $1", [ITEM.a]),
    );
    expect(res.rowCount).toBe(1);
  });

  it("counter staff can mark items unavailable but cannot edit prices", async () => {
    await asUser(U.staffA, async (q) => {
      expect(
        (await q("update public.menu_items set price_minor = 1 where id = $1", [ITEM.a])).rowCount,
      ).toBe(0);
      expect(
        await attempt(q, "select public.set_menu_item_availability($1, 'unavailable')", [ITEM.a]),
      ).toBeNull();
      expect(
        await attempt(q, "select public.set_menu_item_availability($1, 'unavailable')", [ITEM.b]),
      ).toBe("P0002");
    });
  });

  it("staff A cannot move B's order", async () => {
    await asUser(U.ownerA, async (q) => {
      expect(
        await attempt(q, "select public.transition_order($1, 'collected', 0)", [ORDER.bReady]),
      ).toBe("P0002");
      expect(await attempt(q, "select public.verify_pickup_code($1, 'MX39')", [ORDER.bReady])).toBe(
        "P0002",
      );
    });
  });

  it("a revoked member loses access immediately", async () => {
    const rows = await asUser(U.revokedA, (q) => q("select id from public.orders"));
    expect(rows.rowCount).toBe(0);
  });
});

describe("roles cannot be escalated from the app", () => {
  it("a customer cannot make themselves platform staff", async () => {
    await asUser(U.customer1, async (q) => {
      expect(
        await attempt(
          q,
          "insert into public.platform_staff (user_id, role) values ($1, 'super_admin')",
          [U.customer1],
        ),
      ).toBe(PERMISSION_DENIED);
    });
  });

  it("a customer cannot join a restaurant's team", async () => {
    await asUser(U.customer1, async (q) => {
      expect(
        await attempt(
          q,
          "insert into public.restaurant_memberships (restaurant_id, user_id, role) values ($1, $2, 'staff')",
          [R.a, U.customer1],
        ),
      ).toBe(PERMISSION_DENIED);
    });
  });

  it("an owner can add staff but cannot create another owner", async () => {
    await asUser(U.ownerA, async (q) => {
      expect(
        await attempt(
          q,
          "insert into public.restaurant_memberships (restaurant_id, user_id, role) values ($1, $2, 'staff')",
          [R.a, U.customer2],
        ),
      ).toBeNull();
      expect(
        await attempt(
          q,
          "insert into public.restaurant_memberships (restaurant_id, user_id, role) values ($1, $2, 'owner')",
          [R.a, U.customer1],
        ),
      ).toBe(PERMISSION_DENIED);
    });
  });

  it("an owner cannot add people to another restaurant", async () => {
    await asUser(U.ownerA, async (q) => {
      expect(
        await attempt(
          q,
          "insert into public.restaurant_memberships (restaurant_id, user_id, role) values ($1, $2, 'staff')",
          [R.b, U.customer1],
        ),
      ).toBe(PERMISSION_DENIED);
    });
  });

  it("staff cannot promote themselves", async () => {
    const res = await asUser(U.staffA, (q) =>
      q("update public.restaurant_memberships set role = 'manager' where user_id = $1", [U.staffA]),
    );
    expect(res.rowCount).toBe(0);
  });

  it("owners cannot rename their address or change status; platform staff use the lifecycle", async () => {
    await asUser(U.ownerA, async (q) => {
      expect(
        await attempt(q, "update public.restaurants set slug = 'new-slug' where id = $1", [R.a]),
      ).toBe(PERMISSION_DENIED);
      expect(
        await attempt(
          q,
          "update public.restaurants set description = 'Fresh daily' where id = $1",
          [R.a],
        ),
      ).toBeNull();
    });
    await asUser(U.admin, async (q) => {
      // Status is never written directly, even by platform staff.
      expect(
        await attempt(q, "update public.restaurants set status = 'published' where id = $1", [
          R.draft,
        ]),
      ).toBe(PERMISSION_DENIED);
      expect(
        await attempt(q, "select public.transition_restaurant($1, 'ready_for_review')", [R.draft]),
      ).toBeNull();
      const audit = await q("select action from public.audit_logs where restaurant_id = $1", [
        R.draft,
      ]);
      expect(audit.rows.map((r) => r.action)).toContain("restaurant.status_changed");
    });
  });

  it("support staff can read everything but cannot change platform settings", async () => {
    await asUser(U.support, async (q) => {
      expect((await q("select id from public.orders")).rowCount).toBe(3);
      expect(
        await attempt(
          q,
          "insert into public.platform_settings (key, value) values ('fees.service_minor', '3000')",
        ),
      ).toBe(PERMISSION_DENIED);
    });
  });
});

describe("customers see only their own orders", () => {
  it("customer 1 sees both of their orders and nothing of customer 2's", async () => {
    const rows = await asUser(U.customer1, (q) => q("select id from public.orders order by id"));
    expect(rows.rows.map((r) => r.id).sort()).toEqual([ORDER.aPending, ORDER.aPaid].sort());
  });

  it("customers cannot edit totals or statuses directly", async () => {
    await asUser(U.customer1, async (q) => {
      expect(
        await attempt(q, "update public.orders set total_minor = 1 where id = $1", [ORDER.aPaid]),
      ).toBe(PERMISSION_DENIED);
      expect(
        await attempt(q, "update public.orders set order_status = 'collected' where id = $1", [
          ORDER.aPaid,
        ]),
      ).toBe(PERMISSION_DENIED);
    });
  });

  it("nobody can write to the audit log or the order timeline directly", async () => {
    for (const user of [U.customer1, U.ownerA, U.admin]) {
      await asUser(user, async (q) => {
        expect(
          await attempt(
            q,
            "insert into public.audit_logs (scope, action, target_type) values ('platform', 'x', 'y')",
          ),
        ).toBe(PERMISSION_DENIED);
        expect(await attempt(q, "delete from public.audit_logs")).toBe(PERMISSION_DENIED);
        expect(
          await attempt(
            q,
            `insert into public.order_status_events (order_id, restaurant_id, new_status, actor_kind)
             values ($1, $2, 'collected', 'system')`,
            [ORDER.aPaid, R.a],
          ),
        ).toBe(PERMISSION_DENIED);
      });
    }
  });
});
