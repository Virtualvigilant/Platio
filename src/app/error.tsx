"use client";

import { Button } from "@/components/ui";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex max-w-content flex-col items-start gap-4 px-4 py-12">
      <h1 className="m-0 font-serif text-display">Something went wrong on our side</h1>
      <p className="m-0 font-serif text-body text-ink-muted">
        Try again. If you were placing an order, check your orders before ordering again so you
        aren’t charged twice.
      </p>
      <Button onClick={() => retry()}>Try again</Button>
    </main>
  );
}
