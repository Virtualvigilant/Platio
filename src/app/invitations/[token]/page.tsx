import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SetupNotice } from "@/components/site/setup-notice";
import {
  ROLE_DESCRIPTIONS,
  ROLE_PHRASES,
  emailMatchesHint,
  formatDayAndTime,
  isPlausibleInvitationToken,
} from "@/components/team/model";
import { ButtonLink, Callout, SubmitButton } from "@/components/ui";
import type { RestaurantRole } from "@/domain/access";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/server/session";
import { AcceptForm } from "./accept-form";
import { acceptInvitation, switchAccount } from "./actions";

/**
 * A restaurant invitation link (brief §3.1, §4.3 step 6). Works signed out: it shows which
 * restaurant and role the link is for, and a masked email, then asks the person to sign in with
 * the invited address. The token is the secret, so this page is kept out of search engines, sends
 * no referrer and loads nothing from other sites.
 */
export const metadata: Metadata = {
  title: "Restaurant invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface Preview {
  restaurant_name: string;
  role: RestaurantRole;
  email_hint: string;
  state: "valid" | "expired" | "revoked" | "accepted";
  expires_at: string;
}

export default async function InvitationPage(props: PageProps<"/invitations/[token]">) {
  const { token } = await props.params;
  const supabase = await createClient();
  if (!supabase) {
    return (
      <Shell title="Invitation">
        <SetupNotice />
      </Shell>
    );
  }

  let invitation: Preview | null = null;
  if (isPlausibleInvitationToken(token)) {
    const { data, error } = await supabase.rpc("get_restaurant_invitation", { p_token: token });
    // Deliberately generic: the error must not carry the token into logs.
    if (error) throw new Error("Could not load the invitation.");
    invitation = ((data ?? []) as Preview[])[0] ?? null;
  }

  if (!invitation) {
    return (
      <Shell title="This invitation link isn’t valid">
        <Lede>Check you copied the whole link, or ask for a new one.</Lede>
      </Shell>
    );
  }

  const restaurant = invitation.restaurant_name;

  if (invitation.state === "expired") {
    return (
      <Shell title="This invitation has expired">
        <Lede>
          Invitations last 7 days. Ask whoever invited you to {restaurant} to send a new one.
        </Lede>
      </Shell>
    );
  }

  if (invitation.state === "revoked") {
    return (
      <Shell title="This invitation was withdrawn">
        <Lede>
          It no longer works. If you were sent a newer link, use that one. Otherwise, ask whoever
          invited you to {restaurant} for a new invitation.
        </Lede>
      </Shell>
    );
  }

  if (invitation.state === "accepted") {
    return (
      <Shell title="This invitation has already been accepted">
        <Lede>Open the restaurant workspace to see {restaurant}’s orders.</Lede>
        <div>
          <ButtonLink href="/restaurant">Open the restaurant workspace</ButtonLink>
        </div>
      </Shell>
    );
  }

  const viewer = await getViewer();
  const role = invitation.role;
  const hint = invitation.email_hint;
  const nextPath = `/invitations/${token}`;

  return (
    <Shell title={`You’ve been invited to join ${restaurant} as ${ROLE_PHRASES[role] ?? role}.`}>
      <div className="flex flex-col gap-2">
        <Lede>{ROLE_DESCRIPTIONS[role]}</Lede>
        <p className="m-0 font-sans text-small text-ink-muted">
          This invitation expires on {formatDayAndTime(invitation.expires_at)}.
        </p>
      </div>

      {!viewer ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 font-serif text-body">
            Sign in with <strong className="break-all">{hint}</strong> to accept.
          </p>
          <div>
            <ButtonLink href={`/login?next=${encodeURIComponent(nextPath)}`} size="lg">
              Sign in to accept
            </ButtonLink>
          </div>
          <p className="m-0 font-sans text-small text-ink-muted">
            We’ll email you a sign-in link. Open it on this device and you’ll come back here.
          </p>
        </div>
      ) : emailMatchesHint(viewer.email, hint) ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 font-sans text-small text-ink-muted">
            Signed in as <span className="break-all">{viewer.email}</span>.
          </p>
          <AcceptForm accept={acceptInvitation.bind(null, token)} />
        </div>
      ) : (
        <Callout tone="warning" title="You’re signed in with a different address">
          <p>
            This invitation is for <strong className="break-all">{hint}</strong>, but you’re signed
            in as <span className="break-all">{viewer.email ?? "another account"}</span>. Sign out,
            then sign in with the address the invitation was sent to.
          </p>
          <form action={switchAccount.bind(null, token)} className="mt-3">
            <SubmitButton variant="secondary" pendingLabel="Signing out…">
              Sign out and use another address
            </SubmitButton>
          </form>
        </Callout>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-content flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <p className="m-0 font-serif text-eyebrow text-brand-strong uppercase">
          DineFlow / Invitation
        </p>
        <h1 className="m-0 font-serif text-display break-words">{title}</h1>
      </div>
      {children}
    </main>
  );
}

function Lede({ children }: { children: ReactNode }) {
  return <p className="m-0 font-serif text-lede text-ink-muted">{children}</p>;
}
