"use client";

import { useId, useState } from "react";
import { DEFAULT_PREP_PRESETS, DEFAULT_PREP_SETTINGS } from "@/domain/prep-estimate";
import { cn } from "./cn";

/** Lets kitchen staff confirm or change an estimated ready time with one tap. */
export function PrepTimePicker({
  value,
  defaultValue,
  onChange,
  presets = DEFAULT_PREP_PRESETS,
  suggested,
  min = DEFAULT_PREP_SETTINGS.minMinutes,
  max = DEFAULT_PREP_SETTINGS.maxMinutes,
  label = "Estimated ready time",
  hint = "Minutes from now. The customer sees this as an estimated ready time.",
  name,
  className,
}: {
  value?: number | null;
  defaultValue?: number | null;
  onChange?: (minutes: number) => void;
  presets?: readonly number[];
  suggested?: number;
  min?: number;
  max?: number;
  label?: string;
  hint?: string;
  /** When set, the chosen minutes are submitted with the surrounding form under this name. */
  name?: string;
  className?: string;
}) {
  const id = useId();
  const [internal, setInternal] = useState<number | null>(defaultValue ?? suggested ?? null);
  const current = value === undefined ? internal : value;
  const [custom, setCustom] = useState(
    current != null && !presets.includes(current) ? String(current) : "",
  );

  function choose(minutes: number) {
    if (value === undefined) setInternal(minutes);
    onChange?.(minutes);
  }

  const n = Number(custom);
  const customInvalid = custom !== "" && !(Number.isInteger(n) && n >= min && n <= max);

  return (
    <fieldset className={cn("m-0 min-w-0 border-0 p-0", className)}>
      <legend className="mb-2 p-0 font-sans text-label text-ink">{label}</legend>
      <p className="mt-0 mb-3 font-sans text-small text-ink-muted">{hint}</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
        {presets.map((m) => {
          const pressed = current === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={pressed}
              onClick={() => {
                setCustom("");
                choose(m);
              }}
              className={cn(
                "relative flex min-h-touch-kitchen flex-col items-center justify-center rounded-sm border font-sans text-[20px] leading-[22px] font-bold",
                pressed
                  ? "border-brand bg-brand text-on-brand"
                  : "border-line-strong bg-surface-raised text-ink",
              )}
            >
              {suggested === m ? (
                <span className="absolute -top-[9px] left-1/2 -translate-x-1/2 rounded-pill bg-brand-soft px-1.5 text-[11px] leading-4 font-bold whitespace-nowrap text-brand-strong">
                  Suggested
                </span>
              ) : null}
              <span className="tabular-nums">{m}</span>
              <small
                className={cn(
                  "text-[12px] leading-[14px] font-normal",
                  pressed ? "text-on-brand" : "text-ink-muted",
                )}
              >
                min
              </small>
            </button>
          );
        })}
      </div>
      <label
        htmlFor={`${id}-custom`}
        className="mt-3 flex items-center gap-2 font-sans text-ui text-ink"
      >
        Other
        <input
          id={`${id}-custom`}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={custom}
          aria-invalid={customInvalid}
          aria-describedby={customInvalid ? `${id}-error` : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            setCustom(raw);
            const v = Number(raw);
            if (raw !== "" && Number.isInteger(v) && v >= min && v <= max) choose(v);
          }}
          className="min-h-touch-min w-22 rounded-sm border border-line-strong bg-surface-raised px-3 font-sans text-ui text-ink tabular-nums aria-invalid:border-danger"
        />
        min
      </label>
      {customInvalid ? (
        <p id={`${id}-error`} className="mt-1 mb-0 font-sans text-small text-danger">
          Enter whole minutes between {min} and {max}.
        </p>
      ) : null}
      {name && current != null ? <input type="hidden" name={name} value={current} /> : null}
    </fieldset>
  );
}
