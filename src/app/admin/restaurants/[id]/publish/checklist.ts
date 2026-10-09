/**
 * The publish checklist's wording (brief §7.2 step 8). The checks themselves come from the
 * database (public.restaurant_readiness); this names them and says where each one is fixed.
 */
import type { RestaurantStatus } from "@/domain/restaurants/lifecycle";
import {
  WIZARD_STEPS,
  isReadyToPublish,
  stepForReadiness,
  type ReadinessCheck,
  type ReadinessKey,
} from "@/domain/restaurants/wizard";

export const READINESS_LABELS: Readonly<Record<ReadinessKey, string>> = {
  identity: "Description and cuisine labels",
  location: "Address or service area",
  hours: "Opening hours",
  operations: "Pickup instructions",
  menu: "At least one dish on the menu",
  payments: "A way to pay",
  team: "An owner who has accepted their invitation",
};

export interface ChecklistRow {
  key: ReadinessKey;
  label: string;
  ok: boolean;
  /** What to do, from the database, for a failing check. */
  message: string | null;
  href: string;
  /** The wizard step's name, for the link: "Go to Hours and operations". */
  stepLabel: string;
}

export function checklistRows(
  restaurantId: string,
  checks: readonly ReadinessCheck[],
): ChecklistRow[] {
  return checks.map((c) => {
    const slug = stepForReadiness(c.key);
    const step = WIZARD_STEPS.find((s) => s.slug === slug);
    return {
      key: c.key,
      label: READINESS_LABELS[c.key],
      ok: c.ok,
      message: c.ok ? null : c.message.trim() || "This still needs doing.",
      href: `/admin/restaurants/${encodeURIComponent(restaurantId)}/${slug}`,
      stepLabel: step?.label ?? "the setup step",
    };
  });
}

/** "Ready to publish", or how many things are left. */
export function checklistSummary(
  checks: readonly ReadinessCheck[],
  status: RestaurantStatus,
): string {
  if (checks.length === 0) return "The checklist couldn’t be checked. Reload the page.";
  if (isReadyToPublish(checks)) {
    return status === "published" || status === "paused"
      ? "Every check passes"
      : "Ready to publish";
  }
  const left = checks.filter((c) => !c.ok).length;
  return left === 1
    ? "1 thing to finish before publishing"
    : `${left} things to finish before publishing`;
}
