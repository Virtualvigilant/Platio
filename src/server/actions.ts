/**
 * Shared plumbing for Server Actions: one result shape for every form, FormData readers, and
 * translation of validation and database errors into the voice guide's wording.
 * (Not a "use server" file: it exports helpers, not actions.)
 */
import type { z } from "zod";
import { fieldErrors } from "@/domain/restaurants/config";

export type FormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      /** First error per field, keyed by the schema path ("price", "hours.2.opensAt"). */
      fieldErrors?: Record<string, string>;
      /** What the person typed, so fields keep their values after a failed submit. */
      values?: Record<string, string>;
    };

export const IDLE: FormState = { status: "idle" };

export const success = (message: string): FormState => ({ status: "success", message });

export const failure = (
  message: string,
  extra: { fieldErrors?: Record<string, string>; values?: Record<string, string> } = {},
): FormState => ({ status: "error", message, ...extra });

/** A trimmed string field; missing fields read as "". */
export function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

/** A checkbox: present (any value but "false") means on. */
export function checked(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v !== null && v !== "false";
}

/** Every plain string field, for echoing values back after an error (files are skipped). */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  }
  return out;
}

export function fromValidation(error: z.ZodError, formData?: FormData): FormState {
  return failure("Check the highlighted fields and try again.", {
    fieldErrors: fieldErrors(error),
    values: formData ? formValues(formData) : undefined,
  });
}

interface DbError {
  code?: string;
  message?: string;
  details?: string | null;
}

/**
 * Database errors as people-facing messages. Our own functions raise messages already written for
 * people (codes 22023, P0002, 42501, 54000, 40001); constraint errors get a generic explanation.
 */
export function dbErrorMessage(
  error: DbError,
  fallback = "We couldn’t save that. Try again.",
): string {
  const own = error.message?.trim();
  switch (error.code) {
    case "22023": // our validation messages
    case "54000": // rate limited
    case "40001": // stale version
      return own ? withFullStop(own) : fallback;
    case "P0002":
      return "We couldn’t find that. It may have been removed, or you may not have access to it.";
    case "42501":
      return own && !/row-level security|permission denied/i.test(own)
        ? withFullStop(own)
        : "You don’t have permission to do that.";
    case "23505":
      return own && !/duplicate key/i.test(own)
        ? withFullStop(own)
        : "That already exists. Use a different value.";
    case "23514":
      return "Some of those values aren’t allowed. Check them and try again.";
    case "23503":
      return "That refers to something that no longer exists. Reload the page and try again.";
    default:
      return fallback;
  }
}

export function fromDb(error: DbError, formData?: FormData, fallback?: string): FormState {
  return failure(dbErrorMessage(error, fallback), {
    values: formData ? formValues(formData) : undefined,
  });
}

function withFullStop(message: string) {
  return /[.!?]$/.test(message) ? message : `${message}.`;
}
