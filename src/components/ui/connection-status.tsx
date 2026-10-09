"use client";

import { Button } from "./button";
import { Pill } from "./status";
import { cn } from "./cn";

export type ConnectionState = "live" | "reconnecting" | "offline";

const LOOK = {
  live: { tone: "brand", form: "soft", glyph: "dot", label: "Live" },
  reconnecting: { tone: "amber", form: "soft", glyph: "clock", label: "Reconnecting" },
  offline: { tone: "danger", form: "soft", glyph: "cross", label: "Offline" },
} as const;

/** Tells staff whether the live order queue is current. A stale queue never pretends otherwise. */
export function ConnectionStatus({
  state,
  lastSynced,
  onRetry,
  className,
}: {
  state: ConnectionState;
  lastSynced?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { label, ...look } = LOOK[state];
  const meta =
    state === "live"
      ? lastSynced && `Updated ${lastSynced}`
      : `${lastSynced ? `Last updated ${lastSynced}. ` : ""}The queue may be out of date.`;
  return (
    <div role="status" className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <Pill {...look}>{label}</Pill>
      {meta ? <span className="font-sans text-small text-ink-muted">{meta}</span> : null}
      {state !== "live" && onRetry ? (
        <Button variant="quiet" onClick={onRetry}>
          Retry now
        </Button>
      ) : null}
    </div>
  );
}
