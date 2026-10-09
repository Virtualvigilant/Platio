import { Callout } from "@/components/ui";

/** Shown instead of data when the server has no Supabase settings (local setup, misconfigured deploy). */
export function SetupNotice() {
  return (
    <Callout tone="warning" title="Supabase isn’t connected">
      <p>
        Copy <code>.env.example</code> to <code>.env.local</code> and add your Supabase URL and
        publishable key, then restart the server. The README explains how to run Supabase locally
        with demo restaurants.
      </p>
    </Callout>
  );
}
