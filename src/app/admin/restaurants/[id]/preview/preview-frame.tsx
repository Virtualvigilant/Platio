"use client";

import { useState, type ReactNode } from "react";
import { buttonClasses, cn } from "@/components/ui";

const SIZES = [
  { key: "phone", label: "Phone", note: "390 pixels wide, the size of most phones." },
  { key: "desktop", label: "Desktop", note: "The full width of this window." },
] as const;

type Size = (typeof SIZES)[number]["key"];

/**
 * Shows the server-rendered storefront at phone or desktop width. The storefront lays itself out
 * with container queries, so narrowing this frame is enough to show the phone layout; no iframe
 * is needed (the site refuses to be framed).
 */
export function PreviewFrame({ children }: { children: ReactNode }) {
  const [size, setSize] = useState<Size>("phone");
  const current = SIZES.find((s) => s.key === size) ?? SIZES[0];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="group" aria-label="Preview size" className="flex gap-2">
          {SIZES.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={size === s.key}
              onClick={() => setSize(s.key)}
              className={buttonClasses({ variant: size === s.key ? "primary" : "secondary" })}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="m-0 font-sans text-small text-ink-muted" aria-live="polite">
          {current.note}
        </p>
      </div>
      <div
        className={cn(
          // overflow-clip keeps the rounded corners without stopping the sticky menu bar.
          "w-full overflow-clip rounded-md border border-line-strong bg-surface",
          size === "phone" && "mx-auto max-w-[390px]",
        )}
      >
        <div className="px-4 py-6">{children}</div>
      </div>
    </div>
  );
}
