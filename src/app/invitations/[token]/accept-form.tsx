"use client";

import { useActionState } from "react";
import { IDLE, type FormAction } from "@/components/team/model";
import { FormMessage, SubmitButton } from "@/components/ui";
import type { FormState } from "@/server/actions";

/** Accept invitation; on success the action moves on to the restaurant workspace. */
export function AcceptForm({ accept }: { accept: FormAction }) {
  const [state, action] = useActionState<FormState, FormData>(accept, IDLE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <div>
        <SubmitButton size="lg" pendingLabel="Accepting…">
          Accept invitation
        </SubmitButton>
      </div>
    </form>
  );
}
