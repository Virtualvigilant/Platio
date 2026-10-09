"use client";

import { useState } from "react";
import { cn } from "./cn";

/** Changes one cart line's quantity in steps of one, with 44px targets. Removing a line is separate. */
export function QuantityStepper({
  value,
  defaultValue,
  onChange,
  min = 1,
  max = 20,
  label = "Quantity",
  className,
}: {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? min);
  const current = value ?? internal;

  function set(next: number) {
    const clamped = Math.max(min, Math.min(max, next));
    if (value === undefined) setInternal(clamped);
    onChange?.(clamped);
  }

  const step =
    "size-touch-min rounded-sm font-sans text-[22px] leading-none font-bold text-brand-strong disabled:text-line-strong disabled:cursor-not-allowed";

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex w-fit items-stretch rounded-sm border border-line-strong bg-surface-raised",
        className,
      )}
    >
      <button
        type="button"
        className={step}
        onClick={() => set(current - 1)}
        disabled={current <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        −
      </button>
      <output
        aria-live="polite"
        className="flex min-w-10 items-center justify-center border-x border-line font-sans text-[18px] font-bold text-ink tabular-nums"
      >
        {current}
      </output>
      <button
        type="button"
        className={step}
        onClick={() => set(current + 1)}
        disabled={current >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        +
      </button>
    </div>
  );
}
