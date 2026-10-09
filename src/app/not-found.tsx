import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-content flex-col items-start gap-4 px-4 py-12">
      <h1 className="m-0 font-serif text-display">We can’t find that page</h1>
      <p className="m-0 font-serif text-body text-ink-muted">
        The link may be out of date, or the restaurant may not be taking part right now.
      </p>
      <ButtonLink href="/">Browse restaurants</ButtonLink>
    </main>
  );
}
