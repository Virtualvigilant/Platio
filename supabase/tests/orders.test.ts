// Brief §8 and §17.3: only valid transitions, with ETAs, reasons, concurrency checks, refunds
// and pickup-code verification enforced by the database.
import { describe, expect, it } from "vitest";
import { asSystem, asUser, attempt, switchUser } from "./db";
import { ORDER, PICKUP, R, U } from "./fixtures";

const ETA = "2026-10-09T09:50:00Z";

describe("transition_order", () => {
  it("lets staff accept a paid order with an ETA and records who did it", async () => {
    await asUser(U.staffA, async (q) => {
      const res = await q("select * from public.transition_order($1, 'accepted', 0, null, $2)", [
        ORDER.aPaid,
        ETA,
      ]);
      expect(res.rows[0]).toMatchObject({ order_status: "accepted", status_version: 1 });
      expect(res.rows[0].accepted_at).not.toBeNull();
      expect(new Date(res.rows[0].eta_at).toISOString()).toBe(new Date(ETA).toISOString());

      const events = await q("select * from public.order_status_events where order_id = $1", [
        ORDER.aPaid,
      ]);
      expect(events.rows).toHaveLength(1);
      expect(events.rows[0]).toMatchObject({
        previous_status: "awaiting_restaurant",
        new_status: "accepted",
        actor_kind: "restaurant",
        actor_user_id: U.staffA,
      });
    });
  });

  it("requires an ETA to accept", async () => {
    await asUser(U.staffA, async (q) => {
      expect(
        await attempt(q, "select public.transition_order($1, 'accepted', 0)", [ORDER.aPaid]),
      ).toBe("22023");
    });
  });

  it("rejects a stale update when two staff act on the same order", async () => {
    await asUser(U.staffA, async (q) => {
      await q("select public.transition_order($1, 'accepted', 0, null, $2)", [ORDER.aPaid, ETA]);
      // A second tablet still showing version 0 tries to reject.
      expect(
        await attempt(q, "select public.transition_order($1, 'rejected', 0, 'Too busy')", [
          ORDER.aPaid,
        ]),
      ).toBe("40001");
    });
  });

  it("refuses skipped or illegal steps", async () => {
    await asUser(U.staffA, async (q) => {
      expect(
        await attempt(q, "select public.transition_order($1, 'collected', 0)", [ORDER.aPaid]),
      ).toBe("22023");
      // The restaurant cannot release an unpaid order to its own kitchen.
      expect(
        await attempt(q, "select public.transition_order($1, 'awaiting_restaurant', 0)", [
          ORDER.aPending,
        ]),
      ).toBe("22023");
    });
  });

  it("requires a reason to reject, and requests a refund when money was taken", async () => {
    await asUser(U.ownerA, async (q) => {
      expect(
        await attempt(q, "select public.transition_order($1, 'rejected', 0, '  ')", [ORDER.aPaid]),
      ).toBe("22023");
      await q("select public.transition_order($1, 'rejected', 0, 'Kitchen too busy')", [
        ORDER.aPaid,
      ]);
      const refunds = await q(
        "select amount_minor, status, reason from public.refunds where order_id = $1",
        [ORDER.aPaid],
      );
      expect(refunds.rows).toEqual([
        { amount_minor: 73000, status: "requested", reason: "Kitchen too busy" },
      ]);
      // Payment status changes only when the provider confirms the refund.
      const order = await q("select payment_status from public.orders where id = $1", [
        ORDER.aPaid,
      ]);
      expect(order.rows[0].payment_status).toBe("confirmed");
    });
  });

  it("lets customers cancel before acceptance only", async () => {
    await asUser(U.customer1, async (q) => {
      expect(
        await attempt(q, "select public.transition_order($1, 'cancelled', 0)", [ORDER.aPaid]),
      ).toBeNull();
    });
    await asUser(U.staffA, async (q) => {
      await q("select public.transition_order($1, 'accepted', 0, null, $2)", [ORDER.aPaid, ETA]);
      await switchUser(q, U.customer1);
      expect(
        await attempt(q, "select public.transition_order($1, 'cancelled', 1)", [ORDER.aPaid]),
      ).toBe("22023");
    });
  });

  it("hides other customers' orders behind the same 'not found' error", async () => {
    await asUser(U.customer2, async (q) => {
      expect(
        await attempt(q, "select public.transition_order($1, 'cancelled', 0)", [ORDER.aPaid]),
      ).toBe("P0002");
    });
  });

  it("lets the system release an order once payment is verified", async () => {
    await asSystem(async (q) => {
      const res = await q(
        "select order_status from public.transition_order($1, 'awaiting_restaurant', 0)",
        [ORDER.aPending],
      );
      expect(res.rows[0].order_status).toBe("awaiting_restaurant");
      const ev = await q(
        "select actor_kind, actor_user_id from public.order_status_events where order_id = $1",
        [ORDER.aPending],
      );
      expect(ev.rows).toEqual([{ actor_kind: "system", actor_user_id: null }]);
    });
  });

  it("updates an ETA without changing status and keeps the history", async () => {
    await asUser(U.staffA, async (q) => {
      await q("select public.transition_order($1, 'accepted', 0, null, $2)", [ORDER.aPaid, ETA]);
      const later = "2026-10-09T10:00:00Z";
      const res = await q("select * from public.update_order_eta($1, 1, $2, 'Busier than usual')", [
        ORDER.aPaid,
        later,
      ]);
      expect(res.rows[0]).toMatchObject({ order_status: "accepted", status_version: 2 });
      const ev = await q(
        "select eta_at, reason from public.order_status_events where order_id = $1 order by id",
        [ORDER.aPaid],
      );
      expect(ev.rows.map((r) => new Date(r.eta_at).toISOString())).toEqual([
        new Date(ETA).toISOString(),
        new Date(later).toISOString(),
      ]);
      expect(ev.rows[1].reason).toBe("Busier than usual");
    });
  });
});

describe("pickup codes", () => {
  it("are hidden from staff and shown to the customer only after acceptance", async () => {
    await asUser(U.ownerB, async (q) => {
      expect((await q("select * from public.order_pickup_codes")).rowCount).toBe(0);
    });
    await asUser(U.customer1, async (q) => {
      // Still awaiting the restaurant: no code yet.
      expect(
        (await q("select code from public.order_pickup_codes where order_id = $1", [ORDER.aPaid]))
          .rowCount,
      ).toBe(0);
      await switchUser(q, U.staffA);
      await q("select public.transition_order($1, 'accepted', 0, null, $2)", [ORDER.aPaid, ETA]);
      await switchUser(q, U.customer1);
      const code = await q("select code from public.order_pickup_codes where order_id = $1", [
        ORDER.aPaid,
      ]);
      expect(code.rows).toEqual([{ code: PICKUP.aPaid }]);
    });
  });

  it("verify the code the customer shows, forgiving case and spaces", async () => {
    await asUser(U.ownerB, async (q) => {
      const wrong = await q("select public.verify_pickup_code($1, 'AAAA') as ok", [ORDER.bReady]);
      expect(wrong.rows[0].ok).toBe(false);
      const right = await q("select public.verify_pickup_code($1, $2) as ok", [
        ORDER.bReady,
        " mx-39 ",
      ]);
      expect(right.rows[0].ok).toBe(true);
      const done = await q(
        "select order_status, collected_at from public.transition_order($1, 'collected', 0)",
        [ORDER.bReady],
      );
      expect(done.rows[0].order_status).toBe("collected");
      expect(done.rows[0].collected_at).not.toBeNull();
    });
  });

  it("lock after five wrong attempts", async () => {
    await asUser(U.ownerB, async (q) => {
      for (let i = 0; i < 5; i++) {
        const res = await q("select public.verify_pickup_code($1, 'AAAA') as ok", [ORDER.bReady]);
        expect(res.rows[0].ok).toBe(false);
      }
      expect(
        await attempt(q, "select public.verify_pickup_code($1, $2)", [ORDER.bReady, PICKUP.bReady]),
      ).toBe("54000");
    });
  });
});

describe("pausing new orders", () => {
  it("is for owners and managers, and is audited", async () => {
    await asUser(U.staffA, async (q) => {
      expect(
        await attempt(q, "select public.set_accepting_orders($1, false, 'Gas refill')", [R.a]),
      ).toBe("P0002");
    });
    await asUser(U.ownerA, async (q) => {
      await q("select public.set_accepting_orders($1, false, 'Gas refill')", [R.a]);
      const r = await q(
        "select accepting_orders, pause_reason from public.restaurants where id = $1",
        [R.a],
      );
      expect(r.rows[0]).toEqual({ accepting_orders: false, pause_reason: "Gas refill" });
      const audit = await q(
        "select action, reason from public.audit_logs where restaurant_id = $1",
        [R.a],
      );
      expect(audit.rows).toContainEqual({
        action: "restaurant.paused_orders",
        reason: "Gas refill",
      });
    });
  });
});
