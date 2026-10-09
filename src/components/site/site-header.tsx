import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { getViewer } from "@/server/session";
import { signOut } from "@/app/login/actions";

const navLink =
  "inline-flex min-h-touch-min items-center px-2 font-sans text-label text-ink no-underline hover:text-brand-strong";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="border-b border-line bg-surface">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2"
      >
        <Link href="/" className="no-underline" aria-label="DineFlow home">
          <Wordmark size="sm" />
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {viewer?.memberships.length ? (
            <Link href="/restaurant" className={navLink}>
              Workspace
            </Link>
          ) : null}
          {viewer?.platformRole ? (
            <Link href="/admin" className={navLink}>
              Admin
            </Link>
          ) : null}
          {viewer ? (
            <form action={signOut}>
              <button type="submit" className={`${navLink} cursor-pointer bg-transparent`}>
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className={navLink}>
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
