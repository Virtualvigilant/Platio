/**
 * The restaurant setup wizard (brief §7.2): eight steps, each a page under
 * /admin/restaurants/[id]/<slug>. The readiness checklist from the database
 * (public.restaurant_readiness) is mapped onto these steps so the step nav can show what is done.
 */

export const WIZARD_STEPS = [
  { slug: "details", label: "Identity", readiness: ["identity"] },
  { slug: "branding", label: "Branding", readiness: [] },
  { slug: "location", label: "Location", readiness: ["location"] },
  { slug: "hours", label: "Hours and operations", readiness: ["hours", "operations"] },
  { slug: "menu", label: "Menu", readiness: ["menu"] },
  { slug: "payments", label: "Payments", readiness: ["payments"] },
  { slug: "team", label: "Owner and staff", readiness: ["team"] },
  { slug: "publish", label: "Preview and publish", readiness: [] },
] as const;

export type WizardStepSlug = (typeof WIZARD_STEPS)[number]["slug"];

export const READINESS_KEYS = [
  "identity",
  "location",
  "hours",
  "operations",
  "menu",
  "payments",
  "team",
] as const;
export type ReadinessKey = (typeof READINESS_KEYS)[number];

export interface ReadinessCheck {
  key: ReadinessKey;
  ok: boolean;
  /** What to do, from the database, e.g. "Set opening hours for at least one day." */
  message: string;
}

/** The wizard step where a readiness problem is fixed. */
export function stepForReadiness(key: ReadinessKey): WizardStepSlug {
  const step = WIZARD_STEPS.find((s) => (s.readiness as readonly string[]).includes(key));
  return step ? step.slug : "details";
}

/** done: every check for the step passes; todo: at least one fails; none: the step has no checks. */
export function stepState(
  slug: WizardStepSlug,
  checks: readonly ReadinessCheck[],
): "done" | "todo" | "none" {
  const step = WIZARD_STEPS.find((s) => s.slug === slug);
  if (!step || step.readiness.length === 0) return "none";
  const relevant = checks.filter((c) => (step.readiness as readonly string[]).includes(c.key));
  if (relevant.length === 0) return "none";
  return relevant.every((c) => c.ok) ? "done" : "todo";
}

export function isReadyToPublish(checks: readonly ReadinessCheck[]): boolean {
  return checks.length > 0 && checks.every((c) => c.ok);
}
