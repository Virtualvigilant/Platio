import type { FormState } from "@/server/actions";

/**
 * Reading a Server Action's FormState in a form: the first error for a field (including errors on
 * its parts, like "prepPresets.2"), and the value to show, which is what was typed when the last
 * save failed and the saved value otherwise.
 */

/**
 * The starting state for useActionState. Same value as IDLE in src/server/actions.ts, defined here
 * so client bundles don't pull in the validation schemas that module imports.
 */
export const IDLE: FormState = { status: "idle" };

/**
 * A Server Action already bound to its restaurant in a Server Component and passed down as a prop.
 * Binding there, not with .bind() in a client component, matters: when a form is posted without
 * JavaScript, React re-renders the client component and compares the action's bound arguments; a
 * .bind() in the client makes a new pending promise on every attempt, so the render never finishes
 * and the request spins. Ids that vary per row go in hidden inputs instead.
 */
export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

export function errorFor(state: FormState, key: string): string | undefined {
  if (state.status !== "error" || !state.fieldErrors) return undefined;
  const errors = state.fieldErrors;
  if (errors[key]) return errors[key];
  const nested = Object.keys(errors).find((k) => k.startsWith(`${key}.`));
  return nested ? errors[nested] : undefined;
}

/** The value to show in a text field. */
export function valueFor(state: FormState, key: string, saved: string | null | undefined): string {
  if (state.status === "error" && state.values) return state.values[key] ?? "";
  return saved ?? "";
}

/** Whether a checkbox shows ticked: unticked boxes are absent from submitted values. */
export function checkedFor(state: FormState, key: string, saved: boolean): boolean {
  if (state.status === "error" && state.values) return key in state.values;
  return saved;
}
