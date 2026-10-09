import type { ReactNode } from "react";
import { cn } from "./cn";

const TONES = {
  info: { box: "bg-brand-soft", title: "text-brand-strong" },
  warning: { box: "bg-amber-soft", title: "text-amber-strong" },
  danger: { box: "bg-danger-soft", title: "text-danger" },
} as const;

/** A square tinted block that sets one message apart, as in the brief's callout boxes. */
export function Callout({
  tone = "info",
  title,
  actions,
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  title?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "rounded-0 px-4 py-3 font-serif text-body-sm text-ink",
        TONES[tone].box,
        className,
      )}
    >
      {title ? (
        <p className={cn("mb-1 font-serif text-callout-title", TONES[tone].title)}>{title}</p>
      ) : null}
      <div className="[&>:first-child]:mt-0 [&>:last-child]:mb-0">{children}</div>
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
