"use client";

import { useActionState } from "react";
import { FormMessage, ImageField, SubmitButton } from "@/components/ui";
import { saveImage } from "@/server/restaurant-config/actions";
import { IDLE, errorFor } from "./form-state";

const KINDS = {
  logo: {
    label: "Logo",
    hint: "Square, at least 256 pixels wide. PNG, JPEG or WebP, up to 2 MB.",
    aspect: "square",
  },
  cover: {
    label: "Cover photo",
    hint: "Wide, about three times as wide as it is tall. Used when the restaurant page has the cover layout. PNG, JPEG or WebP, up to 2 MB.",
    aspect: "wide",
  },
} as const;

/**
 * The restaurant's logo and cover photo. Each image is its own form, so one upload per request
 * stays under the server's size limit; the server checks the real file type and size.
 */
export function ProfileImagesForm({
  restaurantId,
  logoUrl,
  coverUrl,
}: {
  restaurantId: string;
  logoUrl: string | null;
  coverUrl: string | null;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <ImageForm restaurantId={restaurantId} kind="logo" currentUrl={logoUrl} />
      <ImageForm restaurantId={restaurantId} kind="cover" currentUrl={coverUrl} />
    </div>
  );
}

function ImageForm({
  restaurantId,
  kind,
  currentUrl,
}: {
  restaurantId: string;
  kind: keyof typeof KINDS;
  currentUrl: string | null;
}) {
  const [state, action] = useActionState(saveImage.bind(null, restaurantId, kind), IDLE);
  const { label, hint, aspect } = KINDS[kind];
  return (
    <form action={action} className="flex min-w-0 flex-col gap-3">
      {/* Remount when the saved image changes so the preview shows the stored file. */}
      <ImageField
        key={currentUrl ?? "none"}
        name="image"
        label={label}
        hint={hint}
        aspect={aspect}
        currentUrl={currentUrl}
        removeName="remove"
        error={errorFor(state, "image")}
      />
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Saving…">Save {label.toLowerCase()}</SubmitButton>
      </div>
    </form>
  );
}
