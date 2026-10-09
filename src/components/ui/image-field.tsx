"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "./cn";
import { Glyph } from "./glyph";

/**
 * A file picker for one restaurant image with a preview of the current or chosen picture.
 * The server checks the real file type and size; the size check here only saves a wasted upload.
 */
export function ImageField({
  name,
  label,
  currentUrl,
  hint = "PNG, JPEG or WebP, up to 2 MB.",
  error,
  aspect = "square",
  removeName,
}: {
  /** The file input's name in the form. */
  name: string;
  label: string;
  currentUrl?: string | null;
  hint?: string;
  error?: string;
  aspect?: "square" | "wide";
  /** When set, shows a "Remove this image" checkbox submitted under this name. */
  removeName?: string;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const shown = preview ?? currentUrl ?? null;
  const message = localError ?? error;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="font-sans text-label text-ink">
        {label}
      </label>
      <p id={`${id}-hint`} className="m-0 font-sans text-small text-ink-muted">
        {hint}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={cn(
            "flex flex-none items-center justify-center overflow-hidden rounded-md border border-line bg-surface-alt",
            aspect === "square" ? "size-24" : "h-24 w-48",
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview or storage URL
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <span className="px-2 text-center font-sans text-small text-ink-muted">
              No image yet
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <input
            id={id}
            name={name}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-describedby={[`${id}-hint`, message ? `${id}-error` : null]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={message ? true : undefined}
            className="max-w-full font-sans text-small text-ink file:mr-3 file:min-h-touch-min file:cursor-pointer file:rounded-sm file:border file:border-solid file:border-line-strong file:bg-surface-raised file:px-4 file:font-sans file:text-label file:text-ink"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setLocalError(null);
              if (preview) URL.revokeObjectURL(preview);
              setPreview(null);
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) {
                setLocalError("That image is larger than 2 MB. Choose a smaller one or resize it.");
                e.target.value = "";
                return;
              }
              setPreview(URL.createObjectURL(file));
            }}
          />
          {removeName && currentUrl ? (
            <label className="flex min-h-touch-min items-center gap-2 font-sans text-ui text-ink">
              <input type="checkbox" name={removeName} className="size-5 accent-brand" />
              Remove this image
            </label>
          ) : null}
        </div>
      </div>
      {message ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="m-0 flex items-start gap-1 font-sans text-small text-danger"
        >
          <span className="mt-px">
            <Glyph name="alert" size={14} />
          </span>
          {message}
        </p>
      ) : null}
    </div>
  );
}
