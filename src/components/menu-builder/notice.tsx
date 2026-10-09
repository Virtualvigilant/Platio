import { FormMessage, Glyph } from "@/components/ui";
import type { FormState } from "@/server/actions";

/**
 * The result of the last save, next to the form or row it belongs to. Errors use FormMessage
 * (an alert); a success is shown without a live role, because the builder's own status region
 * has already announced it.
 */
export function Notice({ state }: { state: FormState | null }) {
  if (!state || state.status === "idle") return null;
  if (state.status === "error") return <FormMessage state={state} />;
  return (
    <p className="m-0 flex items-start gap-2 bg-brand-soft px-3 py-2 font-sans text-ui text-brand-strong">
      <span className="mt-0.5">
        <Glyph name="check" size={16} />
      </span>
      {state.message}
    </p>
  );
}
