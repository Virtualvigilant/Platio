// The order state machine exists twice: in TypeScript for the UI and in the database for
// enforcement. This keeps them identical.
import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, ORDER_TRANSITIONS } from "../../src/domain/orders/state-machine";
import { asSystem } from "./db";

describe("order transitions", () => {
  it("are the same in TypeScript and in the database", async () => {
    const fromTs = ORDER_STATUSES.flatMap((from) =>
      ORDER_TRANSITIONS[from].flatMap((rule) =>
        rule.actors.map(
          (actor) =>
            `${from}→${rule.to} by ${actor} reason=${!!rule.requiresReason} eta=${!!rule.requiresEta}`,
        ),
      ),
    ).sort();

    const rows = await asSystem((q) =>
      q(
        "select from_status, to_status, actor, requires_reason, requires_eta from public.order_status_transitions",
      ),
    );
    const fromDb = rows.rows
      .map(
        (r) =>
          `${r.from_status}→${r.to_status} by ${r.actor} reason=${r.requires_reason} eta=${r.requires_eta}`,
      )
      .sort();

    expect(fromDb).toEqual(fromTs);
  });

  it("use the same status names", async () => {
    const rows = await asSystem((q) =>
      q("select unnest(enum_range(null::public.order_status))::text as s"),
    );
    expect(rows.rows.map((r) => r.s)).toEqual([...ORDER_STATUSES]);
  });
});
