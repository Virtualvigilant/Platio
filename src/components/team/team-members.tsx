"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, FormMessage, Pill, SelectField, SubmitButton } from "@/components/ui";
import type { RestaurantRole } from "@/domain/access";
import type { FormState } from "@/server/actions";
import type { TeamMember } from "@/server/team/queries";
import {
  IDLE,
  ROLE_LABELS,
  canManageMember,
  formatDay,
  memberName,
  type FormAction,
  type TeamPowers,
} from "./model";

/**
 * The people on a restaurant's team: name or email, role and joined date, with a role change and
 * a two-step Remove for the people this viewer may manage. A removal's result is shown above the
 * list, because the person's row disappears once they're removed.
 */
export function TeamMembers({
  remove,
  changeRole,
  members,
  viewerUserId,
  powers,
  lockedNote,
}: {
  /** removeMember bound to the restaurant id, by a Server Component. */
  remove: FormAction;
  /** changeRole bound to the restaurant id, by a Server Component. */
  changeRole: FormAction;
  members: readonly TeamMember[];
  viewerUserId: string;
  powers: TeamPowers;
  /** Shown on rows this viewer can't change (other than their own). */
  lockedNote?: string;
}) {
  const [removal, removeAction] = useActionState<FormState, FormData>(remove, IDLE);
  const [removing, setRemoving] = useState<string | null>(null);
  const activeOwners = members.filter((m) => m.role === "owner" && m.status === "active").length;
  const removedRowGone = !members.some((m) => m.membershipId === removing);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {removal.status === "success" || (removal.status === "error" && removedRowGone) ? (
        <FormMessage state={removal} />
      ) : null}
      {members.length === 0 ? (
        <p className="m-0 font-serif text-body text-ink-muted">Nobody has joined yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {members.map((m) => (
            <MemberRow
              key={m.membershipId}
              changeRole={changeRole}
              member={m}
              isViewer={m.userId === viewerUserId}
              canManage={canManageMember(powers, m, viewerUserId)}
              roles={powers.manage}
              lockedNote={lockedNote}
              isLastOwner={m.role === "owner" && m.status === "active" && activeOwners === 1}
              removeAction={removeAction}
              onRemoveSubmit={() => setRemoving(m.membershipId)}
              removeError={
                removal.status === "error" && removing === m.membershipId ? removal : null
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MemberRow({
  changeRole,
  member,
  isViewer,
  canManage,
  roles,
  lockedNote,
  isLastOwner,
  removeAction,
  onRemoveSubmit,
  removeError,
}: {
  changeRole: FormAction;
  member: TeamMember;
  isViewer: boolean;
  canManage: boolean;
  roles: readonly RestaurantRole[];
  lockedNote?: string;
  isLastOwner: boolean;
  removeAction: (formData: FormData) => void;
  onRemoveSubmit: () => void;
  removeError: FormState | null;
}) {
  const name = memberName(member);
  const id = member.membershipId;
  const headingId = `member-${id}`;

  return (
    <li
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 rounded-md border border-line bg-surface-raised p-4"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p id={headingId} className="m-0 font-sans text-label break-words text-ink">
          {name}
          {isViewer ? (
            <span className="ml-2 font-bold text-brand-strong">
              <span className="sr-only">, </span>You
            </span>
          ) : null}
        </p>
        {member.displayName?.trim() && member.email ? (
          <p className="m-0 font-sans text-small break-all text-ink-muted">{member.email}</p>
        ) : null}
        <p className="m-0 font-sans text-small text-ink-muted">
          {ROLE_LABELS[member.role]} · Joined{" "}
          <time dateTime={member.joinedAt}>{formatDay(member.joinedAt, true)}</time>
        </p>
        {member.status === "invited" ? (
          <div>
            <Pill tone="amber" form="outline" glyph="clock">
              Hasn’t accepted yet
            </Pill>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <div className="flex min-w-0 flex-col gap-3">
          <RoleForm changeRole={changeRole} member={member} name={name} roles={roles} />
          <RemoveControl
            membershipId={id}
            name={name}
            isLastOwner={isLastOwner}
            action={removeAction}
            onSubmit={onRemoveSubmit}
            error={removeError}
          />
        </div>
      ) : !isViewer && lockedNote ? (
        <p className="m-0 font-sans text-small text-ink-muted">{lockedNote}</p>
      ) : null}
    </li>
  );
}

function RoleForm({
  changeRole,
  member,
  name,
  roles,
}: {
  changeRole: FormAction;
  member: TeamMember;
  name: string;
  roles: readonly RestaurantRole[];
}) {
  const [state, action] = useActionState<FormState, FormData>(changeRole, IDLE);
  const id = member.membershipId;
  const error = state.status === "error" ? state.fieldErrors?.role : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <form action={action} className="flex min-w-0 flex-wrap items-end gap-2">
        <input type="hidden" name="membershipId" value={id} />
        <SelectField
          id={`role-${id}`}
          name="role"
          label={
            <>
              Role<span className="sr-only"> for {name}</span>
            </>
          }
          defaultValue={member.role}
          error={error}
          className="min-w-40 flex-1 sm:max-w-60"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </SelectField>
        <SubmitButton variant="secondary" pendingLabel="Saving…">
          Save role<span className="sr-only"> for {name}</span>
        </SubmitButton>
      </form>
      <FormMessage state={state} />
    </div>
  );
}

/** Remove, then "Yes, remove" or Cancel: a confirmation built into the row, not a browser dialog. */
function RemoveControl({
  membershipId,
  name,
  isLastOwner,
  action,
  onSubmit,
  error,
}: {
  membershipId: string;
  name: string;
  isLastOwner: boolean;
  action: (formData: FormData) => void;
  onSubmit: () => void;
  error: FormState | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const promptRef = useRef<HTMLParagraphElement>(null);
  const removeId = `remove-${membershipId}`;
  // Where focus goes after the next switch: the question when it appears, Remove after Cancel.
  const focusNext = useRef<"prompt" | "remove" | null>(null);

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === "prompt") promptRef.current?.focus();
    if (target === "remove") document.getElementById(removeId)?.focus();
  }, [confirming, removeId]);

  function ask() {
    focusNext.current = "prompt";
    setConfirming(true);
  }

  function cancel() {
    focusNext.current = "remove";
    setConfirming(false);
  }

  if (!confirming) {
    return (
      <div>
        <Button id={removeId} variant="secondary" onClick={ask}>
          Remove from team<span className="sr-only">: {name}</span>
        </Button>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={onSubmit}
      className="flex min-w-0 flex-col gap-3 border-l-4 border-danger bg-danger-soft p-3"
    >
      <input type="hidden" name="membershipId" value={membershipId} />
      <p ref={promptRef} tabIndex={-1} className="m-0 font-serif text-body-sm text-ink">
        Remove {name} from the team? They lose access straight away, even on a screen they already
        have open.
        {isLastOwner
          ? " They’re the only owner, so nobody at the restaurant will be able to manage the team until another owner accepts an invitation."
          : null}
      </p>
      {error ? <FormMessage state={error} /> : null}
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="danger" pendingLabel="Removing…">
          Yes, remove<span className="sr-only"> {name}</span>
        </SubmitButton>
        <Button variant="secondary" onClick={cancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
