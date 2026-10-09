import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { getViewer } from "@/server/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Request a new one below.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  if (await getViewer()) redirect(next);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <main className="mx-auto flex max-w-content flex-col gap-6 px-4 py-12">
      <div>
        <p className="m-0 font-serif text-eyebrow text-brand-strong uppercase">
          DineFlow / Sign in
        </p>
        <h1 className="mt-2 mb-0 font-serif text-display">Sign in to order</h1>
        <p className="mt-2 mb-0 font-serif text-lede text-ink-muted">
          Restaurant staff sign in here too.
        </p>
      </div>
      {error ? (
        <p className="m-0 bg-danger-soft px-4 py-3 font-serif text-body-sm text-ink">{error}</p>
      ) : null}
      <div className="max-w-md">
        <LoginForm next={next} />
      </div>
    </main>
  );
}
