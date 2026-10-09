"use client";

import { useActionState } from "react";
import { Callout, FormMessage, SelectField, SubmitButton, TextField } from "@/components/ui";
import type { RestaurantRole } from "@/domain/access";
import type { InviteState } from "@/server/team/actions";
import { CopyLinkField } from "./copy-link-field";
import { IDLE, ROLE_DESCRIPTIONS, ROLE_LABELS, type FormAction } from "./model";

/**
 * Invite someone by email. Invitations aren't emailed yet (that comes with notifications), so a
 * successful invite shows its one-time link here, once, for the inviter to send.
 */
export function InviteForm({
  invite,
  roles,
  defaultRole,
}: {
  /** inviteMember bound to the restaurant id, by a Server Component. */
  invite: FormAction<InviteState>;
  /** The roles this person may invite. */
  roles: readonly RestaurantRole[];
  defaultRole: RestaurantRole;
}) {
  const [state, action] = useActionState<InviteState, FormData>(invite, IDLE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const created = state.status === "success" && "link" in state ? state : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {created ? (
        <Callout title="Invitation ready to send">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="m-0">
              Send this link to <strong className="break-all">{created.email}</strong>. It works
              once, for that email address, and expires in 7 days.
            </p>
            <p className="m-0">
              We don’t email invitations yet, so send it yourself. This is the only time the link is
              shown: if it’s lost, invite the same address again and the old link stops working.
            </p>
            <div className="mt-2">
              <CopyLinkField id="invitation-link" label="Invitation link" value={created.link} />
            </div>
          </div>
        </Callout>
      ) : null}

      <form action={action} noValidate className="flex max-w-content flex-col gap-4">
        {state.status === "error" ? <FormMessage state={state} /> : null}
        <TextField
          id="invite-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          label="Email address"
          hint="They’ll need to sign in with this address to accept."
          defaultValue={values.email ?? ""}
          error={errors.email}
          required
        />
        <SelectField
          id="invite-role"
          name="role"
          label="Role"
          defaultValue={values.role ?? defaultRole}
          error={errors.role}
          hint={roles.map((r) => (
            <span key={r} className="block">
              <span className="font-bold text-ink">{ROLE_LABELS[r]}:</span> {ROLE_DESCRIPTIONS[r]}
            </span>
          ))}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </SelectField>
        <div>
          <SubmitButton pendingLabel="Creating invitation…">Create invitation</SubmitButton>
        </div>
      </form>
    </div>
  );
}
