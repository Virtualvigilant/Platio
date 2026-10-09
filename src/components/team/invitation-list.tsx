"use client";

import { useActionState } from "react";
import {
  FormMessage,
  Pill,
  SubmitButton,
  type Form,
  type GlyphName,
  type Tone,
} from "@/components/ui";
import type { RestaurantRole } from "@/domain/access";
import type { FormState } from "@/server/actions";
import type { Invitation } from "@/server/team/queries";
import { IDLE, ROLE_LABELS, formatDay, type FormAction, type InvitationState } from "./model";

const STATE_LOOK: Record<
  InvitationState,
  { tone: Tone; form: Form; glyph: GlyphName; label: string }
> = {
  pending: { tone: "amber", form: "outline", glyph: "clock", label: "Pending" },
  accepted: { tone: "brand", form: "soft", glyph: "check", label: "Accepted" },
  expired: { tone: "neutral", form: "outline", glyph: "slash", label: "Expired" },
  revoked: { tone: "neutral", form: "soft", glyph: "cross", label: "Revoked" },
};

export function InvitationStatus({ state }: { state: InvitationState }) {
  const { label, ...look } = STATE_LOOK[state];
  return <Pill {...look}>{label}</Pill>;
}

/**
 * Pending invitations with their expiry and a Revoke button, then past invitations folded away.
 * Revoking moves the row into the past list, so the result is shown above the list.
 */
export function InvitationList({
  revoke,
  invitations,
  revokeRoles,
  lockedNote,
}: {
  /** revokeInvitation bound to the restaurant id, by a Server Component. */
  revoke: FormAction;
  invitations: readonly Invitation[];
  /** Roles whose invitations this viewer may revoke. */
  revokeRoles: readonly RestaurantRole[];
  /** Shown on pending invitations this viewer can't revoke. */
  lockedNote?: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(revoke, IDLE);
  const pending = invitations.filter((i) => i.state === "pending");
  const past = invitations.filter((i) => i.state !== "pending");

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <FormMessage state={state} />
      {pending.length === 0 ? (
        <p className="m-0 font-serif text-body text-ink-muted">No invitations are waiting.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {pending.map((inv) => (
            <li
              key={inv.id}
              className="flex min-w-0 flex-col gap-3 rounded-md border border-line bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="m-0 font-sans text-label break-all text-ink">{inv.email}</p>
                <p className="m-0 font-sans text-small text-ink-muted">
                  {ROLE_LABELS[inv.role]} · Expires{" "}
                  <time dateTime={inv.expiresAt}>{formatDay(inv.expiresAt)}</time>
                </p>
                <div>
                  <InvitationStatus state="pending" />
                </div>
              </div>
              {revokeRoles.includes(inv.role) ? (
                <form action={action} className="flex-none">
                  <input type="hidden" name="invitationId" value={inv.id} />
                  <SubmitButton variant="secondary" pendingLabel="Revoking…">
                    Revoke<span className="sr-only"> the invitation for {inv.email}</span>
                  </SubmitButton>
                </form>
              ) : lockedNote ? (
                <p className="m-0 font-sans text-small text-ink-muted sm:max-w-60">{lockedNote}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {past.length ? (
        <details className="min-w-0">
          <summary className="flex min-h-touch-min cursor-pointer items-center font-sans text-label text-brand-strong">
            Past invitations ({past.length})
          </summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {past.map((inv) => (
              <li
                key={inv.id}
                className="flex min-w-0 flex-col gap-1 border-b border-line pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="flex min-w-0 flex-col">
                  <p className="m-0 font-sans text-ui break-all text-ink">{inv.email}</p>
                  <p className="m-0 font-sans text-small text-ink-muted">
                    {ROLE_LABELS[inv.role]} · {pastDetail(inv)}
                  </p>
                </div>
                <div className="flex-none">
                  <InvitationStatus state={inv.state} />
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function pastDetail(inv: Invitation): string {
  if (inv.state === "accepted" && inv.acceptedAt) return `Accepted ${formatDay(inv.acceptedAt)}`;
  if (inv.state === "revoked" && inv.revokedAt) return `Revoked ${formatDay(inv.revokedAt)}`;
  if (inv.state === "expired") return `Expired ${formatDay(inv.expiresAt)}`;
  return `Sent ${formatDay(inv.createdAt)}`;
}
