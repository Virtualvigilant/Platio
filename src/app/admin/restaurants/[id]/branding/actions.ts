"use server";

import { refresh } from "next/cache";
import { brandingSchema } from "@/domain/restaurants/config";
import {
  checked,
  failure,
  formValues,
  fromDb,
  fromValidation,
  success,
  text,
  type FormState,
} from "@/server/actions";
import { authorizePlatform } from "@/server/guards";
import { hasFile, removeRestaurantImage, uploadRestaurantImage } from "@/server/uploads";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const NOT_FOUND =
  "We couldn’t find that restaurant. It may have been removed. Go back to the restaurant list and try again.";

/** "7A2E12" → "#7A2E12", so a colour pasted without its hash still counts. */
function withHash(value: string): string {
  const v = value.trim();
  return /^[0-9a-f]{6}$/i.test(v) ? `#${v}` : v;
}

/**
 * Wizard step 2 (brief §7.2, §7.3): brand colour, layout variant, logo and cover photo.
 * Platform staff only: owners can change their logo and cover elsewhere, but the colour and layout
 * stay with the platform (the database enforces this too).
 */
export async function saveBranding(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // 1. Authorize. The id is bound on the client, so check it like any other input.
  const auth = await authorizePlatform("restaurants.onboard");
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (typeof restaurantId !== "string" || !UUID.test(restaurantId)) return failure(NOT_FOUND);

  // 2. Validate. The colour is checked for contrast here as well as in the browser.
  const parsed = brandingSchema.safeParse({
    brandColor: withHash(text(formData, "brandColor")),
    layout: text(formData, "layout"),
  });
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const branding = parsed.data;

  const { data: current, error: readError } = await supabase
    .from("restaurants")
    .select("id, logo_path, cover_path")
    .eq("id", restaurantId)
    .maybeSingle();
  if (readError) return fromDb(readError, formData);
  if (!current) return failure(NOT_FOUND);
  const previous = current as { id: string; logo_path: string | null; cover_path: string | null };

  // 3. Upload new images first; a new file wins over "Remove this image".
  const uploaded: string[] = [];
  const discardUploads = async () => {
    for (const path of uploaded) await removeRestaurantImage(supabase, path);
  };

  let logoPath = previous.logo_path;
  const logo = formData.get("logo");
  if (hasFile(logo)) {
    const result = await uploadRestaurantImage(supabase, restaurantId, "logo", logo);
    if (!result.ok) {
      return failure("Check the highlighted fields and try again.", {
        fieldErrors: { logo: result.message },
        values: formValues(formData),
      });
    }
    uploaded.push(result.path);
    logoPath = result.path;
  } else if (checked(formData, "removeLogo")) {
    logoPath = null;
  }

  let coverPath = previous.cover_path;
  const cover = formData.get("cover");
  if (hasFile(cover)) {
    const result = await uploadRestaurantImage(supabase, restaurantId, "cover", cover);
    if (!result.ok) {
      await discardUploads();
      return failure("Check the highlighted fields and try again.", {
        fieldErrors: { cover: result.message },
        values: formValues(formData),
      });
    }
    uploaded.push(result.path);
    coverPath = result.path;
  } else if (checked(formData, "removeCover")) {
    coverPath = null;
  }

  // 4. Save as the signed-in user, so row-level security and the field guard still apply.
  const { data: saved, error } = await supabase
    .from("restaurants")
    .update({
      brand_color: branding.brandColor,
      brand_on_color: branding.brandOnColor,
      storefront_layout: branding.layout,
      logo_path: logoPath,
      cover_path: coverPath,
    })
    .eq("id", restaurantId)
    .select("id")
    .maybeSingle();
  if (error) {
    await discardUploads();
    return fromDb(error, formData);
  }
  if (!saved) {
    await discardUploads();
    return failure("You don’t have permission to change this restaurant’s branding.");
  }

  // 5. The row now points at the new files, so the old ones can go.
  if (previous.logo_path && previous.logo_path !== logoPath) {
    await removeRestaurantImage(supabase, previous.logo_path);
  }
  if (previous.cover_path && previous.cover_path !== coverPath) {
    await removeRestaurantImage(supabase, previous.cover_path);
  }

  refresh();
  if (branding.layout === "cover" && !coverPath) {
    return success(
      "Branding saved. Customers see the standard layout until you add a cover photo.",
    );
  }
  return success("Branding saved.");
}
