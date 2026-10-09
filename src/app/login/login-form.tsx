"use client";

import { useActionState } from "react";
import { Button, Callout } from "@/components/ui";
import { requestSignInLink, type SignInState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(requestSignInLink, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <Callout tone="info" title="Check your email">
        We sent a sign-in link to <strong>{state.email}</strong>. Open it on this device to
        continue. The link expires in 15 minutes.
      </Callout>
    );
  }

  const error = state.status === "error" ? state.message : null;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="font-sans text-label">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.status === "error" ? state.email : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-error" : "email-hint"}
          className="min-h-touch-min rounded-sm border border-line-strong bg-surface-raised px-3 font-sans text-ui text-ink aria-invalid:border-danger"
        />
        {error ? (
          <p id="email-error" className="m-0 font-sans text-small text-danger">
            {error}
          </p>
        ) : (
          <p id="email-hint" className="m-0 font-sans text-small text-ink-muted">
            We’ll email you a link. No password needed.
          </p>
        )}
      </div>
      <Button type="submit" loading={pending} loadingLabel="Sending link…" block>
        Email me a sign-in link
      </Button>
    </form>
  );
}
