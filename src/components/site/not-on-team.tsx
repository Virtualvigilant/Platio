/** Shown on workspace pages to signed-in people who aren't on any restaurant's team. */
export function NotOnTeam({ email }: { email: string | null }) {
  return (
    <main className="mx-auto max-w-content px-4 py-12">
      <h1 className="m-0 font-sans text-title">You’re not on a restaurant team</h1>
      <p className="mt-2 font-serif text-body text-ink-muted">
        Ask your restaurant’s owner to invite {email ?? "this account"}, then open the invitation
        link while signed in with that address.
      </p>
    </main>
  );
}

/** Shown when the viewer's role at this restaurant doesn't include this page. */
export function NotForYourRole({ page }: { page: string }) {
  return (
    <div className="flex flex-col gap-2 py-6">
      <h1 className="m-0 font-sans text-title">{page} isn’t available for your role</h1>
      <p className="m-0 font-serif text-body text-ink-muted">
        Ask your restaurant’s owner if you need access.
      </p>
    </div>
  );
}
