import { describe, expect, it } from "vitest";
import { RESTAURANT_STATUSES, RESTAURANT_TRANSITIONS } from "@/domain/restaurants/lifecycle";
import type { ReadinessCheck } from "@/domain/restaurants/wizard";
import { READINESS_LABELS, checklistRows, checklistSummary } from "./checklist";
import {
  MAX_REASON,
  isDestructiveMove,
  lifecycleMoves,
  moveInputSchema,
  statusNote,
  type MoveContext,
} from "./moves";

const ctx = (over: Partial<MoveContext> = {}): MoveContext => ({
  status: "draft",
  platformRole: "super_admin",
  ready: true,
  unfinished: 0,
  everPublished: false,
  acceptingOrders: false,
  ...over,
});

const move = (c: MoveContext, to: string) => lifecycleMoves(c).find((m) => m.to === to);

describe("lifecycleMoves", () => {
  it("offers exactly the lifecycle table's moves for every status", () => {
    for (const status of RESTAURANT_STATUSES) {
      const offered = lifecycleMoves(ctx({ status }))
        .map((m) => m.to)
        .sort();
      const table = RESTAURANT_TRANSITIONS[status].map((t) => t.to).sort();
      expect(offered).toEqual(table);
    }
  });

  it("lists the main move first and destructive moves last", () => {
    expect(lifecycleMoves(ctx({ status: "draft" })).map((m) => m.to)).toEqual([
      "published",
      "ready_for_review",
      "archived",
    ]);
    const published = lifecycleMoves(ctx({ status: "published" }));
    expect(published[0].to).toBe("paused");
    expect(published.slice(1).every((m) => m.variant === "danger")).toBe(true);
  });

  it("lets support staff mark ready for review but not publish, suspend or archive", () => {
    const support = ctx({ platformRole: "support" });
    expect(move(support, "ready_for_review")).toMatchObject({ allowed: true, deniedNote: null });
    expect(move(support, "published")).toMatchObject({
      allowed: false,
      deniedNote: "Only super-admins can publish.",
    });
    expect(move(support, "archived")?.deniedNote).toBe("Only super-admins can archive.");
    for (const status of ["published", "paused", "suspended", "archived"] as const) {
      expect(lifecycleMoves(ctx({ status, platformRole: "support" })).some((m) => m.allowed)).toBe(
        false,
      );
    }
    expect(
      move(ctx({ status: "ready_for_review", platformRole: "support" }), "draft")?.allowed,
    ).toBe(true);
  });

  it("allows nothing without a platform role", () => {
    expect(lifecycleMoves(ctx({ platformRole: null })).every((m) => !m.allowed)).toBe(true);
  });

  it("blocks publishing until every check passes, with a count", () => {
    const notReady = ctx({ ready: false, unfinished: 2 });
    expect(move(notReady, "published")?.blockedNote).toBe(
      "Finish the 2 items on the checklist first. The checklist is checked again when you publish.",
    );
    expect(move(ctx({ ready: false, unfinished: 1 }), "published")?.blockedNote).toMatch(
      /^Finish the item on the checklist first\./,
    );
    expect(move(notReady, "ready_for_review")?.blockedNote).toBeNull();
    expect(move(ctx(), "published")?.blockedNote).toBeNull();
    // Resume and restore also go to Published, which the database checks the same way.
    expect(
      move(ctx({ status: "paused", ready: false, unfinished: 1 }), "published")?.blockedNote,
    ).toMatch(/when you resume\.$/);
    expect(
      move(ctx({ status: "suspended", ready: false, unfinished: 1 }), "published")?.blockedNote,
    ).toMatch(/when you restore\.$/);
  });

  it("does not show a checklist block to someone who can't publish anyway", () => {
    const m = move(ctx({ platformRole: "support", ready: false, unfinished: 3 }), "published");
    expect(m?.blockedNote).toBeNull();
    expect(m?.deniedNote).toBeTruthy();
  });

  it("needs a reason where the lifecycle table says so", () => {
    for (const status of RESTAURANT_STATUSES) {
      for (const m of lifecycleMoves(ctx({ status }))) {
        const t = RESTAURANT_TRANSITIONS[status].find((x) => x.to === m.to);
        expect(m.requiresReason).toBe(t?.requiresReason);
      }
    }
  });

  it("asks for confirmation before suspending, archiving or unpublishing", () => {
    expect(move(ctx({ status: "published" }), "suspended")?.confirm).toBe(
      "Customers can no longer see or order from this restaurant. Existing orders, refunds and records stay.",
    );
    expect(move(ctx({ status: "paused" }), "draft")?.confirm).toMatch(/can no longer see/);
    expect(move(ctx({ status: "published" }), "archived")?.confirm).toMatch(/can no longer see/);
    expect(move(ctx({ status: "draft" }), "archived")?.confirm).toMatch(/will be archived/);
    expect(move(ctx({ status: "published" }), "paused")?.confirm).toBeNull();
    expect(move(ctx({ status: "draft" }), "published")?.confirm).toBeNull();
    expect(move(ctx({ status: "suspended" }), "draft")?.confirm).toBeNull();
    expect(move(ctx({ status: "archived" }), "draft")?.confirm).toBeNull();
  });

  it("says the web address locks on the first publish only", () => {
    expect(move(ctx(), "published")?.consequence).toMatch(/web address can’t change/);
    expect(move(ctx({ everPublished: true }), "published")?.consequence).not.toMatch(/web address/);
  });

  it("says when the restaurant's own pause keeps orders off after publishing again", () => {
    const back = move(ctx({ everPublished: true, acceptingOrders: false }), "published");
    expect(back?.consequence).toMatch(/stay paused until the restaurant resumes them/);
    const resume = move(
      ctx({ status: "paused", everPublished: true, acceptingOrders: true }),
      "published",
    );
    expect(resume?.consequence).toBe("Customers can place new orders again.");
  });

  it("says suspensions keep orders and records and can't be lifted by the team", () => {
    const m = move(ctx({ status: "published" }), "suspended");
    expect(m?.consequence).toMatch(/Existing orders, refunds and records stay/);
    expect(m?.consequence).toMatch(/restaurant team can’t/);
  });
});

describe("isDestructiveMove", () => {
  it("covers suspending, archiving and taking a public restaurant back to draft", () => {
    expect(isDestructiveMove("published", "suspended")).toBe(true);
    expect(isDestructiveMove("draft", "archived")).toBe(true);
    expect(isDestructiveMove("published", "draft")).toBe(true);
    expect(isDestructiveMove("paused", "draft")).toBe(true);
    expect(isDestructiveMove("ready_for_review", "draft")).toBe(false);
    expect(isDestructiveMove("suspended", "draft")).toBe(false);
    expect(isDestructiveMove("published", "paused")).toBe(false);
    expect(isDestructiveMove("draft", "published")).toBe(false);
  });
});

describe("moveInputSchema", () => {
  it("requires a reason only when the move needs one, and trims it", () => {
    const needs = moveInputSchema({ requiresReason: true, destructive: false });
    const missing = needs.safeParse({ reason: "   ", confirm: false });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.issues[0].path).toEqual(["reason"]);
    expect(needs.parse({ reason: "  Owner asked  ", confirm: false }).reason).toBe("Owner asked");

    const optional = moveInputSchema({ requiresReason: false, destructive: false });
    expect(optional.parse({ reason: "", confirm: false }).reason).toBeNull();
  });

  it("limits the reason's length", () => {
    const s = moveInputSchema({ requiresReason: true, destructive: false });
    expect(s.safeParse({ reason: "x".repeat(MAX_REASON), confirm: false }).success).toBe(true);
    expect(s.safeParse({ reason: "x".repeat(MAX_REASON + 1), confirm: false }).success).toBe(false);
  });

  it("requires the confirmation box for destructive moves", () => {
    const s = moveInputSchema({ requiresReason: true, destructive: true });
    const unticked = s.safeParse({ reason: "Closed for good", confirm: false });
    expect(unticked.success).toBe(false);
    if (!unticked.success) {
      expect(unticked.error.issues.map((i) => i.path.join("."))).toEqual(["confirm"]);
    }
    expect(s.safeParse({ reason: "Closed for good", confirm: true }).success).toBe(true);
  });
});

describe("statusNote", () => {
  it("describes every status", () => {
    for (const status of RESTAURANT_STATUSES) {
      expect(statusNote(status, true).length).toBeGreaterThan(10);
    }
    expect(statusNote("published", false)).toMatch(/paused new orders itself/);
    expect(statusNote("suspended", false)).toMatch(/can’t lift/);
  });
});

describe("checklist", () => {
  const checks: ReadinessCheck[] = [
    { key: "identity", ok: true, message: "Add a description and at least one cuisine label." },
    { key: "hours", ok: false, message: "Set opening hours for at least one day." },
    { key: "operations", ok: false, message: "" },
    { key: "team", ok: false, message: "Invite an owner." },
  ];

  it("links each failing check to the wizard step that fixes it", () => {
    const rows = checklistRows("r-1", checks);
    expect(rows.map((r) => [r.key, r.href])).toEqual([
      ["identity", "/admin/restaurants/r-1/details"],
      ["hours", "/admin/restaurants/r-1/hours"],
      ["operations", "/admin/restaurants/r-1/hours"],
      ["team", "/admin/restaurants/r-1/team"],
    ]);
    expect(rows[1]).toMatchObject({
      label: READINESS_LABELS.hours,
      message: "Set opening hours for at least one day.",
      stepLabel: "Hours and operations",
    });
    expect(rows[0].message).toBeNull();
    expect(rows[2].message).toBe("This still needs doing.");
  });

  it("summarises how much is left", () => {
    expect(checklistSummary(checks, "draft")).toBe("3 things to finish before publishing");
    expect(checklistSummary(checks.slice(0, 2), "draft")).toBe(
      "1 thing to finish before publishing",
    );
    const done = checks.map((c) => ({ ...c, ok: true }));
    expect(checklistSummary(done, "draft")).toBe("Ready to publish");
    expect(checklistSummary(done, "published")).toBe("Every check passes");
    expect(checklistSummary([], "draft")).toMatch(/couldn’t be checked/);
  });
});
