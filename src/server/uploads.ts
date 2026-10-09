import "server-only";
import { checkImage } from "@/domain/media/image";
import type { ImageKind } from "@/domain/restaurants/config";
import type { ServerClient } from "@/lib/supabase/server";
import { PUBLIC_ASSETS_BUCKET } from "./storage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type UploadResult = { ok: true; path: string } | { ok: false; message: string };

/**
 * Stores an uploaded image for a restaurant as the signed-in user (Storage policies apply).
 * The path is built here, never from the file name: <restaurant_id>/<kind>/<uuid>.<ext>, with the
 * extension taken from the file's real type. Every upload gets a new path, so images can be
 * cached for a year and replacing one never serves a stale copy.
 *
 * Returns { ok: false } with a people-facing message for empty, oversized or non-image files.
 */
export async function uploadRestaurantImage(
  supabase: ServerClient,
  restaurantId: string,
  kind: ImageKind,
  file: FormDataEntryValue | null,
): Promise<UploadResult> {
  if (!UUID.test(restaurantId)) return { ok: false, message: "We couldn’t find that restaurant." };
  if (!(file instanceof Blob) || file.size === 0)
    return { ok: false, message: "Choose an image to upload." };

  // Pass bytes, not the File: storage-js ignores contentType for File bodies.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImage(bytes);
  if (!check.ok) return check;

  const path = `${restaurantId}/${kind}/${crypto.randomUUID()}.${check.image.ext}`;
  const { error } = await supabase.storage.from(PUBLIC_ASSETS_BUCKET).upload(path, bytes, {
    contentType: check.image.mime,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    return {
      ok: false,
      message: "We couldn’t upload that image. Check your connection and try again.",
    };
  }
  return { ok: true, path };
}

/** Removes a replaced image. Best effort: a leftover file is harmless, a failed save is not. */
export async function removeRestaurantImage(
  supabase: ServerClient,
  path: string | null | undefined,
) {
  if (!path) return;
  await supabase.storage.from(PUBLIC_ASSETS_BUCKET).remove([path]);
}

/** True when a submitted file field actually contains a file (an empty file input sends an empty Blob). */
export function hasFile(value: FormDataEntryValue | null): boolean {
  return value instanceof Blob && value.size > 0;
}
