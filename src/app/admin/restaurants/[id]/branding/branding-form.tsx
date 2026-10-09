"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import {
  Button,
  Callout,
  Field,
  Fieldset,
  FormMessage,
  ImageField,
  Pill,
  cn,
} from "@/components/ui";
import {
  INK,
  MIN_CONTRAST,
  WHITE,
  checkTenantColor,
  contrastRatio,
  isHexColor,
} from "@/domain/restaurants/branding";
import { MAX_IMAGE_BYTES, type StorefrontLayout } from "@/domain/restaurants/config";
import { IDLE, type FormState } from "@/server/actions";
import { saveBranding } from "./actions";

/** DineFlow teal (light theme), what the colour picker shows while the field is empty. */
const DEFAULT_PICKER = "#167d8d";

/**
 * Server Actions accept 3 MB per request (next.config.ts). One image is at most 2 MB, so a logo
 * and a cover photo near the limit can't go in one save.
 */
const MAX_REQUEST_FILES_BYTES = MAX_IMAGE_BYTES + 768 * 1024;

const LAYOUTS: { value: StorefrontLayout; title: string; detail: string }[] = [
  { value: "standard", title: "Standard", detail: "Logo and name." },
  {
    value: "cover",
    title: "Cover photo",
    detail:
      "A wide photo above the name. Needs a cover photo; until one is added, customers see the standard layout.",
  },
];

type ColourCheck =
  | { kind: "default" }
  | { kind: "incomplete" }
  | { kind: "ok"; color: string; onColor: string; ratio: number }
  | { kind: "low"; color: string; onColor: string; ratio: number; reason: string };

function withHash(value: string): string {
  const v = value.trim();
  return /^[0-9a-f]{6}$/i.test(v) ? `#${v}` : v;
}

/** The same check the server runs (checkTenantColor), plus the best ratio for a refused colour. */
function describeColour(input: string): ColourCheck {
  const value = withHash(input).toLowerCase();
  if (value === "") return { kind: "default" };
  if (!isHexColor(value)) return { kind: "incomplete" };
  const check = checkTenantColor(value);
  if (check.ok) {
    return { kind: "ok", color: check.color, onColor: check.onColor, ratio: check.ratio };
  }
  const white = contrastRatio(value, WHITE);
  const ink = contrastRatio(value, INK);
  return white >= ink
    ? { kind: "low", color: value, onColor: WHITE, ratio: white, reason: check.reason }
    : { kind: "low", color: value, onColor: INK, ratio: ink, reason: check.reason };
}

/** Rounded down, so a colour at 4.47:1 never reads as 4.5:1. */
function ratioLabel(ratio: number): string {
  return `${(Math.floor(ratio * 10) / 10).toFixed(1)}:1`;
}

const textName = (onColor: string) => (onColor === WHITE ? "white text" : "dark text");

export function BrandingForm({
  restaurantId,
  name,
  cuisine,
  brandColor,
  layout: savedLayout,
  logoUrl,
  coverUrl,
  logoKey,
  coverKey,
}: {
  restaurantId: string;
  name: string;
  cuisine: string[];
  brandColor: string | null;
  layout: StorefrontLayout;
  logoUrl: string | null;
  coverUrl: string | null;
  /** Changes when the saved image changes, so the picker clears after a successful save. */
  logoKey: string;
  coverKey: string;
}) {
  const [state, formAction, pending] = useActionState(saveBranding.bind(null, restaurantId), IDLE);
  const [colour, setColour] = useState(brandColor ?? "");
  const [layout, setLayout] = useState<StorefrontLayout>(savedLayout);
  const [localError, setLocalError] = useState<string | null>(null);

  const check = describeColour(colour);
  const shown =
    check.kind === "ok" || check.kind === "low"
      ? { color: check.color, onColor: check.onColor }
      : { color: null, onColor: null };
  const fieldError = (key: string) =>
    state.status === "error" ? state.fieldErrors?.[key] : undefined;
  const message: FormState = localError ? { status: "error", message: localError } : state;

  // Submitting through a transition (instead of letting React run the form action) keeps the
  // chosen files and values in place if the save fails; React resets forms after an action.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    let bytes = 0;
    for (const value of formData.values()) if (value instanceof File) bytes += value.size;
    if (bytes > MAX_REQUEST_FILES_BYTES) {
      setLocalError(
        "The logo and cover photo are too large to upload together. Save one now, then add the other.",
      );
      return;
    }
    setLocalError(null);
    startTransition(() => formAction(formData));
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <section aria-labelledby="branding-colour" className="flex flex-col gap-4">
        <h2 id="branding-colour" className="m-0 font-sans text-heading text-brand">
          Colour
        </h2>
        <p className="m-0 font-serif text-body-sm text-ink-muted">
          One colour for the restaurant’s header band and logo tile. Buttons and order status keep
          DineFlow’s colours at every restaurant, so they always mean the same thing.
        </p>

        <Field
          id="brandColor"
          label="Brand colour"
          optional
          hint="A hex code like #7a2e12, or pick one. Leave it empty to use DineFlow teal."
          error={fieldError("brandColor")}
        >
          {(describedBy, invalid) => (
            <div className="flex min-w-0 items-center gap-2">
              <input
                id="brandColor"
                name="brandColor"
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={7}
                placeholder="#167d8d"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                onBlur={() => setColour((c) => withHash(c).toLowerCase())}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                className={cn(
                  "min-h-touch-min w-full max-w-48 min-w-0 rounded-sm border bg-surface-raised px-3 font-sans text-ui text-ink placeholder:text-ink-muted",
                  invalid ? "border-danger" : "border-line-strong",
                )}
              />
              <input
                type="color"
                aria-label="Brand colour picker"
                value={check.kind === "ok" || check.kind === "low" ? check.color : DEFAULT_PICKER}
                onChange={(e) => setColour(e.target.value.toLowerCase())}
                className="h-touch-min w-16 flex-none cursor-pointer rounded-sm border border-line-strong bg-surface-raised p-1"
              />
            </div>
          )}
        </Field>
        <div>
          <Button variant="quiet" onClick={() => setColour("")} disabled={colour.trim() === ""}>
            Use DineFlow teal
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-alt p-4">
          <p className="m-0 font-sans text-label text-ink">Preview</p>
          <StorefrontHeader
            name={name}
            cuisine={cuisine}
            layout="standard"
            brandColor={shown.color}
            brandOnColor={shown.onColor}
            titleAs="p"
          />
          <div aria-live="polite" className="flex flex-col gap-2">
            <ContrastResult check={check} />
          </div>
        </div>
      </section>

      <section aria-labelledby="branding-layout" className="flex flex-col gap-4">
        <h2 id="branding-layout" className="m-0 font-sans text-heading text-brand">
          Layout
        </h2>
        <Fieldset
          legend="Top of the page"
          hint="Every storefront uses the same tested template. Restaurants can’t add their own styles."
        >
          {LAYOUTS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-touch-min cursor-pointer items-start gap-3 rounded-sm border border-line-strong bg-surface-raised p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
            >
              <input
                type="radio"
                name="layout"
                value={option.value}
                checked={layout === option.value}
                onChange={() => setLayout(option.value)}
                className="mt-0.5 size-5 flex-none accent-brand"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-sans text-label text-ink">{option.title}</span>
                <span className="font-sans text-small text-ink-muted">{option.detail}</span>
              </span>
              <LayoutSketch layout={option.value} />
            </label>
          ))}
          {fieldError("layout") ? (
            <p className="m-0 font-sans text-small text-danger">{fieldError("layout")}</p>
          ) : null}
        </Fieldset>
        {layout === "cover" && !coverUrl ? (
          <Callout tone="info" title="No cover photo yet">
            Customers see the standard layout until you add a cover photo below.
          </Callout>
        ) : null}
      </section>

      <section aria-labelledby="branding-images" className="flex flex-col gap-6">
        <h2 id="branding-images" className="m-0 font-sans text-heading text-brand">
          Logo and cover photo
        </h2>
        <ImageField
          key={logoKey}
          name="logo"
          label="Logo"
          aspect="square"
          currentUrl={logoUrl}
          removeName="removeLogo"
          hint="Square, at least 256 × 256 pixels. PNG, JPEG or WebP, up to 2 MB. Without a logo, customers see the restaurant’s initials."
          error={fieldError("logo")}
        />
        <ImageField
          key={coverKey}
          name="cover"
          label="Cover photo"
          aspect="wide"
          currentUrl={coverUrl}
          removeName="removeCover"
          hint="Wide, about 3 × 1 and at least 1200 pixels across. PNG, JPEG or WebP, up to 2 MB. Shown only with the cover photo layout; text never sits on it."
          error={fieldError("cover")}
        />
      </section>

      <div className="flex flex-col gap-3">
        <FormMessage state={message} />
        <div>
          <Button type="submit" loading={pending} loadingLabel="Saving…">
            Save branding
          </Button>
        </div>
      </div>
    </form>
  );
}

function ContrastResult({ check }: { check: ColourCheck }) {
  const minimum = `${MIN_CONTRAST}:1`;
  switch (check.kind) {
    case "default":
      return (
        <>
          <Pill tone="neutral" form="outline" glyph="ring" className="self-start">
            DineFlow teal
          </Pill>
          <p className="m-0 font-sans text-small text-ink">
            No colour set, so customers see DineFlow teal.
          </p>
        </>
      );
    case "incomplete":
      return (
        <>
          <Pill tone="neutral" form="outline" glyph="ring" className="self-start">
            Not a colour yet
          </Pill>
          <p className="m-0 font-sans text-small text-ink">
            Enter # and six letters or digits, like #7a2e12. Until then the preview shows DineFlow
            teal.
          </p>
        </>
      );
    case "ok":
      return (
        <>
          <Pill tone="brand" form="soft" glyph="check" className="self-start">
            Easy to read
          </Pill>
          <p className="m-0 font-sans text-small text-ink">
            Contrast <span className="tabular-nums">{ratioLabel(check.ratio)}</span> with{" "}
            {textName(check.onColor)}. The minimum is{" "}
            <span className="tabular-nums">{minimum}</span>.
          </p>
        </>
      );
    case "low":
      return (
        <>
          <Pill tone="danger" form="soft" glyph="alert" className="self-start">
            Hard to read
          </Pill>
          <p className="m-0 font-sans text-small text-danger">
            {check.reason} Contrast is{" "}
            <span className="tabular-nums">{ratioLabel(check.ratio)}</span> at best, with{" "}
            {textName(check.onColor)}; it needs to be at least{" "}
            <span className="tabular-nums">{minimum}</span>.
          </p>
        </>
      );
  }
}

/** A tiny drawing of each layout. Decorative: the option's words say the same thing. */
function LayoutSketch({ layout }: { layout: StorefrontLayout }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-16 flex-none flex-col overflow-hidden rounded-sm border border-line bg-surface"
    >
      {layout === "cover" ? <span className="h-5 flex-none bg-line-strong" /> : null}
      <span className="flex flex-1 items-center gap-1 bg-brand px-1">
        <span className="size-3 flex-none rounded-0 bg-on-brand" />
        <span className="h-1 flex-1 bg-on-brand" />
      </span>
      <span className="h-3 flex-none bg-surface" />
    </span>
  );
}
