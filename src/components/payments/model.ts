/**
 * Payment setup wording and a guard against secrets typed into the wrong field (brief §6.4,
 * §7.2 step 6, §12). Plain TypeScript, safe in client bundles. Provider keys live in secret
 * storage managed by engineers; these forms hold only methods, a provider name, a public merchant
 * reference and the onboarding state.
 */
import type { PaymentSettings } from "@/domain/restaurants/config";
import type { FormState } from "@/server/actions";

export type PaymentOnboardingStatus = PaymentSettings["onboardingStatus"];

/** The starting state for useActionState (IDLE in src/server/actions.ts, without its imports). */
export const IDLE: FormState = { status: "idle" };

/**
 * A Server Action already bound to its restaurant, passed from a Server Component. Binding in the
 * Server Component (not with .bind() in the client) matters: when a form is posted without
 * JavaScript, React re-renders the client component and checks the action's bound arguments; a
 * client-side .bind() makes a new pending promise on every attempt, so that render never finishes.
 */
export type FormAction<S = FormState> = (state: S, formData: FormData) => Promise<S>;

/** In the order the select shows them; mirrors PAYMENT_ONBOARDING_STATUSES (a test checks). */
export const ONBOARDING_STATUSES = [
  "not_started",
  "in_progress",
  "ready",
] as const satisfies readonly PaymentOnboardingStatus[];

export const ONBOARDING_LABELS: Readonly<Record<PaymentOnboardingStatus, string>> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready: "Ready",
};

export function isOnboardingStatus(value: unknown): value is PaymentOnboardingStatus {
  return (ONBOARDING_STATUSES as readonly unknown[]).includes(value);
}

const SECRET_WORDS =
  /\b(secret|password|passwd|passkey|pin|api[ _-]?key|private[ _-]?key|consumer[ _-]?(key|secret)|access[ _-]?token|bearer)\b/i;
const KEY_PREFIXES = /\b(sk|rk)_(live|test)_|-----BEGIN |\bAKIA[0-9A-Z]{12,}/;
/** A long unbroken run of letters and digits, like an API key or a base64 credential. */
const OPAQUE_RUN = /[A-Za-z0-9+/=_]{24,}/g;

/**
 * Whether text looks like a credential rather than a public reference such as a till or paybill
 * number. A guard against pasting into the wrong field, not a security boundary: anything that
 * matches is refused and never echoed back.
 */
export function looksLikeSecret(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (SECRET_WORDS.test(v) || KEY_PREFIXES.test(v)) return true;
  for (const run of v.match(OPAQUE_RUN) ?? []) {
    if (/[A-Za-z]/.test(run) && /[0-9]/.test(run)) return true;
  }
  return false;
}
