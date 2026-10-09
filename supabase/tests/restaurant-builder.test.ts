// Phase 2: restaurant lifecycle, readiness, role-limited editing, hours, menu audit,
// invitations, payment settings and image storage — checked from each role's point of view.
import { describe, expect, it } from "vitest";
import { PLATFORM_PERMISSIONS, platformCan } from "../../src/domain/access";
import {
  RESTAURANT_STATUSES,
  RESTAURANT_TRANSITIONS,
} from "../../src/domain/restaurants/lifecycle";
import { asAnon, asSystem, asUser, attempt, switchUser, type Q } from "./db";
import { ITEM, ORDER, R, U } from "./fixtures";

const DENIED = "42501";
const INVALID = "22023";
const NOT_FOUND = "P0002";

/** Makes the draft fixture restaurant pass every readiness check, as an admin would. */
async function completeDraft(q: Q) {
  await q(
    `update public.restaurants set description = 'Coffee and pastries', cuisine_tags = '{Coffee}',
       address = 'Admin block', pickup_instructions = 'Counter by the door' where id = $1`,
    [R.draft],
  );
  await q(`select public.set_restaurant_hours($1, $2::jsonb)`, [
    R.draft,
    JSON.stringify([{ weekday: 1, opens_at: "07:30", closes_at: "17:00" }]),
  ]);
  await q(
    `insert into public.restaurant_memberships (restaurant_id, user_id, role) values ($1, $2, 'owner')`,
    [R.draft, U.invitee],
  );
}

async function readiness(q: Q, id: string) {
  const r = await q("select check_key, ok from public.restaurant_readiness($1)", [id]);
  return Object.fromEntries(r.rows.map((row) => [row.check_key, row.ok]));
}

describe("platform permissions", () => {
  it("are the same in TypeScript and the database for every role", async () => {
    for (const [user, role] of [
      [U.admin, "super_admin"],
      [U.support, "support"],
    ] as const) {
      await asUser(user, async (q) => {
        for (const permission of PLATFORM_PERMISSIONS) {
          const r = await q("select public.platform_can($1) as ok", [permission]);
          expect(r.rows[0].ok, `${role} ${permission}`).toBe(platformCan(role, permission));
        }
      });
    }
    await asUser(U.ownerA, async (q) => {
      const r = await q("select public.platform_can('restaurants.read') as ok");
      expect(r.rows[0].ok).toBe(false);
    });
  });
});

describe("restaurant lifecycle", () => {
  it("is the same in TypeScript and the database", async () => {
    const fromTs = RESTAURANT_STATUSES.flatMap((from) =>
      RESTAURANT_TRANSITIONS[from].map(
        (t) => `${from}→${t.to} ${t.permission} reason=${t.requiresReason}`,
      ),
    ).sort();
    const rows = await asSystem((q) =>
      q(
        "select from_status, to_status, permission, requires_reason from public.restaurant_status_transitions",
      ),
    );
    const fromDb = rows.rows
      .map((r) => `${r.from_status}→${r.to_status} ${r.permission} reason=${r.requires_reason}`)
      .sort();
    expect(fromDb).toEqual(fromTs);

    const statuses = await asSystem((q) =>
      q("select unnest(enum_range(null::public.restaurant_status))::text as s"),
    );
    expect(statuses.rows.map((r) => r.s)).toEqual([...RESTAURANT_STATUSES]);
  });

  it("creates new restaurants as drafts with their private and payment records, audited", async () => {
    await asUser(U.support, async (q) => {
      const r = await q(
        `insert into public.restaurants (slug, display_name, status, first_published_at)
         values ('kiosk-two', 'Kiosk Two', 'published', now()) returning id, status, first_published_at, created_by`,
      );
      expect(r.rows[0]).toMatchObject({
        status: "draft",
        first_published_at: null,
        created_by: U.support,
      });
      const id = r.rows[0].id;
      expect(
        (await q("select 1 from public.restaurant_private where restaurant_id = $1", [id]))
          .rowCount,
      ).toBe(1);
      expect(
        (
          await q(
            "select pay_at_pickup_enabled from public.restaurant_payment_settings where restaurant_id = $1",
            [id],
          )
        ).rows,
      ).toEqual([{ pay_at_pickup_enabled: true }]);
      const audit = await q("select action from public.audit_logs where restaurant_id = $1", [id]);
      expect(audit.rows.map((a) => a.action)).toContain("restaurant.created");
    });
  });

  it("refuses duplicate web addresses and lets nobody else create restaurants", async () => {
    await asUser(U.admin, async (q) => {
      expect(
        await attempt(
          q,
          "insert into public.restaurants (slug, display_name) values ('campus-grill', 'Copy')",
        ),
      ).toBe("23505");
    });
    for (const user of [U.ownerA, U.customer1]) {
      await asUser(user, async (q) => {
        expect(
          await attempt(
            q,
            "insert into public.restaurants (slug, display_name) values ('sneaky-one', 'Sneaky')",
          ),
        ).toBe(DENIED);
      });
    }
  });

  it("lists what is missing before a draft can be published", async () => {
    await asUser(U.admin, async (q) => {
      expect(await readiness(q, R.draft)).toEqual({
        identity: false,
        location: false,
        hours: false,
        operations: false,
        menu: true,
        payments: true,
        team: false,
      });
      const code = await attempt(q, "select public.transition_restaurant($1, 'published')", [
        R.draft,
      ]);
      expect(code).toBe(INVALID);
    });
  });

  it("publishes a complete draft, opens ordering, and locks the web address", async () => {
    await asUser(U.admin, async (q) => {
      await completeDraft(q);
      expect(Object.values(await readiness(q, R.draft)).every(Boolean)).toBe(true);
      const r = await q("select * from public.transition_restaurant($1, 'published')", [R.draft]);
      expect(r.rows[0].status).toBe("published");
      expect(r.rows[0].first_published_at).not.toBeNull();
      expect(r.rows[0].accepting_orders).toBe(true);

      expect(
        await attempt(q, "update public.restaurants set slug = 'bean-leaf' where id = $1", [
          R.draft,
        ]),
      ).toBe(INVALID);
      const audit = await q(
        "select action, safe_metadata from public.audit_logs where restaurant_id = $1 and action = 'restaurant.status_changed'",
        [R.draft],
      );
      expect(audit.rows[0].safe_metadata).toEqual({ from: "draft", to: "published" });

      await q("set local role anon");
      expect((await q("select 1 from public.restaurants where id = $1", [R.draft])).rowCount).toBe(
        1,
      );
    });
  });

  it("keeps publishing and suspending with super-admins, and reasons on the record", async () => {
    await asUser(U.support, async (q) => {
      expect(
        await attempt(q, "select public.transition_restaurant($1, 'ready_for_review')", [R.draft]),
      ).toBeNull();
      expect(
        await attempt(q, "select public.transition_restaurant($1, 'suspended', 'Complaints')", [
          R.a,
        ]),
      ).toBe(DENIED);
    });
    await asUser(U.admin, async (q) => {
      expect(await attempt(q, "select public.transition_restaurant($1, 'suspended')", [R.a])).toBe(
        INVALID,
      );
      expect(
        await attempt(
          q,
          "select public.transition_restaurant($1, 'suspended', 'Food safety check')",
          [R.a],
        ),
      ).toBeNull();
      const audit = await q(
        "select reason from public.audit_logs where restaurant_id = $1 and action = 'restaurant.status_changed'",
        [R.a],
      );
      expect(audit.rows[0].reason).toBe("Food safety check");
      // Suspension hides the storefront but keeps orders and their history.
      await switchUser(q, U.customer1);
      expect((await q("select 1 from public.orders where id = $1", [ORDER.aPaid])).rowCount).toBe(
        1,
      );
      await q("set local role anon");
      expect((await q("select 1 from public.restaurants where id = $1", [R.a])).rowCount).toBe(0);
      expect(
        (await q("select 1 from public.menu_items where restaurant_id = $1", [R.a])).rowCount,
      ).toBe(0);
    });
  });

  it("refuses moves that are not in the lifecycle and hides restaurants from non-staff", async () => {
    await asUser(U.admin, async (q) => {
      expect(
        await attempt(q, "select public.transition_restaurant($1, 'paused', 'x')", [R.draft]),
      ).toBe(INVALID);
    });
    await asUser(U.ownerA, async (q) => {
      expect(
        await attempt(q, "select public.transition_restaurant($1, 'paused', 'x')", [R.a]),
      ).toBe(NOT_FOUND);
      expect(await attempt(q, "select * from public.restaurant_readiness($1)", [R.b])).toBe(
        NOT_FOUND,
      );
    });
  });
});

describe("who may edit what", () => {
  it("lets owners edit their profile and operations but not identity or branding", async () => {
    await asUser(U.ownerA, async (q) => {
      expect(
        await attempt(
          q,
          "update public.restaurants set description = 'New', logo_path = $2 where id = $1",
          [R.a, `${R.a}/logo/a.png`],
        ),
      ).toBeNull();
      expect(
        await attempt(q, "update public.restaurants set display_name = 'Renamed' where id = $1", [
          R.a,
        ]),
      ).toBe(DENIED);
      expect(
        await attempt(
          q,
          "update public.restaurants set brand_color = '#000000', brand_on_color = '#ffffff' where id = $1",
          [R.a],
        ),
      ).toBe(DENIED);
      const audit = await q(
        "select safe_metadata from public.audit_logs where restaurant_id = $1 and action = 'restaurant.updated'",
        [R.a],
      );
      expect(audit.rows[0].safe_metadata).toEqual({ fields: ["description", "logo_path"] });
    });
  });

  it("lets managers edit operations only, and counter staff nothing", async () => {
    await asUser(U.managerA, async (q) => {
      expect(
        await attempt(
          q,
          "update public.restaurants set pickup_instructions = 'Back door' where id = $1",
          [R.a],
        ),
      ).toBeNull();
      expect(
        await attempt(q, "update public.restaurants set description = 'x' where id = $1", [R.a]),
      ).toBe(DENIED);
    });
    await asUser(U.staffA, async (q) => {
      const r = await q("update public.restaurants set pickup_instructions = 'x' where id = $1", [
        R.a,
      ]);
      expect(r.rowCount).toBe(0);
    });
  });

  it("lets owners read but never change payment settings", async () => {
    await asUser(U.ownerA, async (q) => {
      expect(
        (
          await q("select * from public.restaurant_payment_settings where restaurant_id = $1", [
            R.a,
          ])
        ).rowCount,
      ).toBe(1);
      expect(
        (
          await q("select * from public.restaurant_payment_settings where restaurant_id = $1", [
            R.b,
          ])
        ).rowCount,
      ).toBe(0);
      const r = await q(
        "update public.restaurant_payment_settings set online_enabled = false where restaurant_id = $1",
        [R.a],
      );
      expect(r.rowCount).toBe(0);
    });
    await asUser(U.staffA, async (q) => {
      expect((await q("select * from public.restaurant_payment_settings")).rowCount).toBe(0);
    });
    await asUser(U.admin, async (q) => {
      expect(
        await attempt(
          q,
          "update public.restaurant_payment_settings set online_enabled = true where restaurant_id = $1",
          [R.a],
        ),
      ).toBe("23514");
      expect(
        await attempt(
          q,
          `update public.restaurant_payment_settings set onboarding_status = 'ready', online_enabled = true,
             provider = 'M-Pesa', merchant_reference = '123456' where restaurant_id = $1`,
          [R.a],
        ),
      ).toBeNull();
    });
  });
});

describe("opening hours", () => {
  it("replace the whole week atomically and reject overlaps", async () => {
    await asUser(U.managerA, async (q) => {
      await q("select public.set_restaurant_hours($1, $2::jsonb)", [
        R.a,
        JSON.stringify([
          { weekday: 1, opens_at: "07:30", closes_at: "11:00" },
          { weekday: 1, opens_at: "12:00", closes_at: "21:00" },
        ]),
      ]);
      expect(
        (await q("select 1 from public.restaurant_hours where restaurant_id = $1", [R.a])).rowCount,
      ).toBe(2);
      const code = await attempt(q, "select public.set_restaurant_hours($1, $2::jsonb)", [
        R.a,
        JSON.stringify([
          { weekday: 2, opens_at: "07:30", closes_at: "12:30" },
          { weekday: 2, opens_at: "12:00", closes_at: "21:00" },
        ]),
      ]);
      expect(code).toBe(INVALID);
      // The failed call changed nothing.
      expect(
        (await q("select weekday from public.restaurant_hours where restaurant_id = $1", [R.a]))
          .rows,
      ).toEqual([{ weekday: 1 }, { weekday: 1 }]);
      expect(
        await attempt(q, "select public.set_restaurant_hours($1, $2::jsonb)", [
          R.a,
          JSON.stringify([{ weekday: 1, opens_at: "21:00", closes_at: "02:00" }]),
        ]),
      ).toBe("23514");
    });
  });

  it("are off limits to other restaurants and counter staff", async () => {
    await asUser(U.ownerA, async (q) => {
      expect(await attempt(q, "select public.set_restaurant_hours($1, '[]'::jsonb)", [R.b])).toBe(
        NOT_FOUND,
      );
    });
    await asUser(U.staffA, async (q) => {
      expect(await attempt(q, "select public.set_restaurant_hours($1, '[]'::jsonb)", [R.a])).toBe(
        NOT_FOUND,
      );
    });
  });
});

describe("menu", () => {
  it("records price changes and archiving in the audit log", async () => {
    await asUser(U.ownerA, async (q) => {
      await q("update public.menu_items set price_minor = 36000 where id = $1", [ITEM.a]);
      await q("update public.menu_items set active = false where id = $1", [ITEM.a]);
      const audit = await q(
        "select action, safe_metadata from public.audit_logs where target_id = $1 order by id",
        [ITEM.a],
      );
      expect(audit.rows).toEqual([
        {
          action: "menu_item.price_changed",
          safe_metadata: { name: "Pilau with kachumbari", from: 35000, to: 36000 },
        },
        { action: "menu_item.archived", safe_metadata: { name: "Pilau with kachumbari" } },
      ]);
    });
  });

  it("reorders only the caller's own categories and items", async () => {
    await asUser(U.ownerA, async (q) => {
      // B's category is in the list, but only A's own category moves.
      await q("select public.reorder_menu_categories($1, $2::uuid[])", [
        R.a,
        ["00000000-0000-4000-e000-00000000000b", "00000000-0000-4000-e000-00000000000a"],
      ]);
      expect(
        await attempt(q, "select public.reorder_menu_items($1, $2::uuid[])", [
          "00000000-0000-4000-e000-00000000000b",
          [ITEM.b],
        ]),
      ).toBe(NOT_FOUND);
      await q("reset role");
      const rows = await q(
        "select id, sort_order from public.menu_categories where id in ($1, $2) order by id",
        ["00000000-0000-4000-e000-00000000000a", "00000000-0000-4000-e000-00000000000b"],
      );
      expect(rows.rows).toEqual([
        { id: "00000000-0000-4000-e000-00000000000a", sort_order: 2 },
        { id: "00000000-0000-4000-e000-00000000000b", sort_order: 0 },
      ]);
    });
  });
});

describe("invitations", () => {
  async function invite(q: Q, restaurant: string, email: string, role: string) {
    const r = await q(
      "select * from public.create_restaurant_invitation($1, $2, $3::public.restaurant_role)",
      [restaurant, email, role],
    );
    return r.rows[0] as { invitation_id: string; token: string; expires_at: Date };
  }

  it("turn an owner invitation into an active owner for the invited, confirmed address", async () => {
    await asUser(U.admin, async (q) => {
      const inv = await invite(q, R.draft, " Invitee@Example.TEST ", "owner");
      expect(inv.token).toMatch(/^[0-9a-f]{64}$/);
      expect(await attempt(q, "select token_hash from public.restaurant_invitations")).toBe(DENIED);
      const stored = await q(
        "select email, role from public.restaurant_invitations where id = $1",
        [inv.invitation_id],
      );
      expect(stored.rows).toEqual([{ email: "invitee@example.test", role: "owner" }]);

      await q("set local role anon");
      const preview = await q("select * from public.get_restaurant_invitation($1)", [inv.token]);
      expect(preview.rows[0]).toMatchObject({
        restaurant_name: "Bean & Leaf Café",
        role: "owner",
        email_hint: "in•••@example.test",
        state: "valid",
      });
      expect((await q("select * from public.get_restaurant_invitation('nope')")).rowCount).toBe(0);
      expect(await attempt(q, "select public.accept_restaurant_invitation($1)", [inv.token])).toBe(
        DENIED,
      );

      await q("set local role authenticated");
      await switchUser(q, U.customer1);
      expect(await attempt(q, "select public.accept_restaurant_invitation($1)", [inv.token])).toBe(
        DENIED,
      );
      await switchUser(q, U.invitee);
      const accepted = await q("select public.accept_restaurant_invitation($1) as id", [inv.token]);
      expect(accepted.rows[0].id).toBe(R.draft);
      const membership = await q(
        "select role, status, invitation_id from public.restaurant_memberships where user_id = $1 and restaurant_id = $2",
        [U.invitee, R.draft],
      );
      expect(membership.rows).toEqual([
        { role: "owner", status: "active", invitation_id: inv.invitation_id },
      ]);
      // Accepting again is harmless; someone else can't reuse it.
      expect(
        (await q("select public.accept_restaurant_invitation($1) as id", [inv.token])).rows[0].id,
      ).toBe(R.draft);
      await switchUser(q, U.customer2);
      expect(await attempt(q, "select public.accept_restaurant_invitation($1)", [inv.token])).toBe(
        INVALID,
      );
    });
  });

  it("require a confirmed email address", async () => {
    await asUser(U.admin, async (q) => {
      const inv = await invite(q, R.draft, "unconfirmed@example.test", "staff");
      await switchUser(q, U.unconfirmed);
      expect(await attempt(q, "select public.accept_restaurant_invitation($1)", [inv.token])).toBe(
        DENIED,
      );
    });
  });

  it("expire, can be withdrawn, and are replaced by a newer invitation", async () => {
    await asUser(U.admin, async (q) => {
      const first = await invite(q, R.draft, "invitee@example.test", "staff");
      const second = await invite(q, R.draft, "invitee@example.test", "manager");
      const states = await q(
        "select id, revoked_at is not null as revoked from public.restaurant_invitations where email = 'invitee@example.test' order by created_at, id",
      );
      expect(Object.fromEntries(states.rows.map((r) => [r.id, r.revoked]))).toEqual({
        [first.invitation_id]: true,
        [second.invitation_id]: false,
      });
      await switchUser(q, U.invitee);
      expect(
        await attempt(q, "select public.accept_restaurant_invitation($1)", [first.token]),
      ).toBe(INVALID);

      await switchUser(q, U.admin);
      await q("select public.revoke_restaurant_invitation($1)", [second.invitation_id]);
      await switchUser(q, U.invitee);
      expect(
        await attempt(q, "select public.accept_restaurant_invitation($1)", [second.token]),
      ).toBe(INVALID);

      await switchUser(q, U.admin);
      const third = await invite(q, R.draft, "invitee@example.test", "staff");
      await q("reset role");
      await q(
        "update public.restaurant_invitations set created_at = now() - interval '8 days', expires_at = now() - interval '1 day' where id = $1",
        [third.invitation_id],
      );
      await q("set local role authenticated");
      await switchUser(q, U.invitee);
      expect(
        await attempt(q, "select public.accept_restaurant_invitation($1)", [third.token]),
      ).toBe(INVALID);
    });
  });

  it("let owners invite managers and staff to their own restaurant only", async () => {
    await asUser(U.ownerA, async (q) => {
      expect(
        await attempt(
          q,
          "select * from public.create_restaurant_invitation($1, 'x@example.test', 'owner')",
          [R.a],
        ),
      ).toBe(NOT_FOUND);
      expect(
        await attempt(
          q,
          "select * from public.create_restaurant_invitation($1, 'x@example.test', 'staff')",
          [R.b],
        ),
      ).toBe(NOT_FOUND);
      expect(
        await attempt(
          q,
          "select * from public.create_restaurant_invitation($1, 'x@example.test', 'staff')",
          [R.a],
        ),
      ).toBeNull();
      expect(
        await attempt(
          q,
          "select * from public.create_restaurant_invitation($1, 'staff-a@example.test', 'manager')",
          [R.a],
        ),
      ).toBe("23505");
      expect((await q("select email from public.restaurant_invitations")).rows).toEqual([
        { email: "x@example.test" },
      ]);
    });
    for (const user of [U.staffA, U.managerA, U.customer1]) {
      await asUser(user, async (q) => {
        expect(
          await attempt(
            q,
            "select * from public.create_restaurant_invitation($1, 'y@example.test', 'staff')",
            [R.a],
          ),
        ).toBe(NOT_FOUND);
      });
    }
  });

  it("can't be faked to create an owner", async () => {
    await asUser(U.ownerA, async (q) => {
      const staffInvite = await invite(q, R.a, "invitee@example.test", "staff");
      expect(
        await attempt(
          q,
          "insert into public.restaurant_memberships (restaurant_id, user_id, role, invitation_id) values ($1, $2, 'owner', $3)",
          [R.a, U.invitee, staffInvite.invitation_id],
        ),
      ).toBe(DENIED);
    });
  });

  it("keep at least one owner unless platform staff step in", async () => {
    await asUser(U.ownerB, async (q) => {
      expect(
        await attempt(
          q,
          "update public.restaurant_memberships set status = 'revoked' where user_id = $1",
          [U.ownerB],
        ),
      ).toBe(INVALID);
    });
    await asUser(U.admin, async (q) => {
      const r = await q(
        "update public.restaurant_memberships set status = 'revoked' where user_id = $1",
        [U.ownerB],
      );
      expect(r.rowCount).toBe(1);
    });
  });
});

describe("team and onboarding views", () => {
  it("list a team with emails for its owners and platform staff only", async () => {
    await asUser(U.ownerA, async (q) => {
      const r = await q("select email, role from public.list_restaurant_team($1)", [R.a]);
      expect(r.rows).toEqual([
        { email: "owner-a@example.test", role: "owner" },
        { email: "manager-a@example.test", role: "manager" },
        { email: "staff-a@example.test", role: "staff" },
      ]);
      expect(await attempt(q, "select * from public.list_restaurant_team($1)", [R.b])).toBe(
        NOT_FOUND,
      );
    });
    for (const user of [U.managerA, U.staffA, U.customer1]) {
      await asUser(user, async (q) => {
        expect(await attempt(q, "select * from public.list_restaurant_team($1)", [R.a])).toBe(
          NOT_FOUND,
        );
      });
    }
    await asUser(U.support, async (q) => {
      expect((await q("select 1 from public.list_restaurant_team($1)", [R.b])).rowCount).toBe(1);
    });
  });

  it("summarize readiness for platform staff only", async () => {
    await asUser(U.support, async (q) => {
      const r = await q(
        "select restaurant_id, passed, total from public.restaurant_readiness_summary($1::uuid[])",
        [[R.draft, "00000000-0000-4000-b000-0000000000ff"]],
      );
      expect(r.rows).toEqual([{ restaurant_id: R.draft, passed: 2, total: 7 }]);
    });
    await asUser(U.ownerA, async (q) => {
      expect(
        await attempt(q, "select * from public.restaurant_readiness_summary($1::uuid[])", [[R.a]]),
      ).toBe(NOT_FOUND);
    });
  });
});

describe("image storage", () => {
  const put = (q: Q, bucket: string, name: string) =>
    attempt(q, "insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, name]);
  const file = (restaurant: string, kind: string, ext = "png") =>
    `${restaurant}/${kind}/0b7a6c1e-5d4f-4a3b-9c2d-1e0f9a8b7c6${kind.length}.${ext}`;

  it("has a public 2 MB image bucket", async () => {
    const b = await asSystem((q) =>
      q(
        "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'restaurant-assets'",
      ),
    );
    expect(b.rows[0]).toEqual({
      public: true,
      file_size_limit: "2097152",
      allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
    });
  });

  it("lets owners, managers and platform staff upload under their own restaurant's folder only", async () => {
    await asUser(U.ownerA, async (q) => {
      expect(await put(q, "restaurant-assets", file(R.a, "logo"))).toBeNull();
      expect(await put(q, "restaurant-assets", file(R.b, "logo"))).toBe(DENIED);
      expect(await put(q, "other-bucket", file(R.a, "logo"))).toBe(DENIED);
    });
    await asUser(U.managerA, async (q) => {
      expect(await put(q, "restaurant-assets", file(R.a, "item", "webp"))).toBeNull();
    });
    await asUser(U.staffA, async (q) => {
      expect(await put(q, "restaurant-assets", file(R.a, "item"))).toBe(DENIED);
    });
    await asUser(U.support, async (q) => {
      expect(await put(q, "restaurant-assets", file(R.b, "cover", "jpg"))).toBeNull();
    });
    await asAnon(async (q) => {
      expect(await put(q, "restaurant-assets", file(R.a, "logo"))).toBe(DENIED);
    });
  });

  it("accepts only server-built object names", async () => {
    await asUser(U.ownerA, async (q) => {
      for (const name of [
        "not-a-restaurant/logo/x.png",
        `${R.a}/logo/x.png`,
        `${R.a}/../${R.b}/logo/0b7a6c1e-5d4f-4a3b-9c2d-1e0f9a8b7c64.png`,
        `${R.a}/avatar/0b7a6c1e-5d4f-4a3b-9c2d-1e0f9a8b7c64.png`,
        `${R.a}/logo/0b7a6c1e-5d4f-4a3b-9c2d-1e0f9a8b7c64.svg`,
        `${R.a}/logo/0b7a6c1e-5d4f-4a3b-9c2d-1e0f9a8b7c64.png.html`,
      ]) {
        expect(await put(q, "restaurant-assets", name), name).toBe(DENIED);
      }
    });
  });

  it("lets owners replace and delete only their own images", async () => {
    await asSystem(async (q) => {
      await q(
        "insert into storage.objects (bucket_id, name) values ('restaurant-assets', $1), ('restaurant-assets', $2)",
        [file(R.a, "logo"), file(R.b, "logo")],
      );
      await q("set local role authenticated");
      await switchUser(q, U.ownerA);
      expect((await q("select name from storage.objects")).rows).toEqual([
        { name: file(R.a, "logo") },
      ]);
      expect((await q("delete from storage.objects where name like '%/logo/%'")).rowCount).toBe(1);
      await q("reset role");
      expect((await q("select name from storage.objects where name like '%/logo/%'")).rows).toEqual(
        [{ name: file(R.b, "logo") }],
      );
    });
  });
});
