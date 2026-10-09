"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  closureSchema,
  fieldErrors,
  identitySchema,
  locationSchema,
  operationsSchema,
  weeklyHoursSchema,
} from "@/domain/restaurants/config";
import {
  intervalsFromValues,
  mapIntervalErrors,
  nairobiLocalToIso,
  toHoursPayload,
} from "@/domain/restaurants/hours-form";
import { WIZARD_STEPS } from "@/domain/restaurants/wizard";
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
import { authorizePlatform, authorizeRestaurant } from "@/server/guards";
import type { Viewer } from "@/server/session";
import { hasFile, removeRestaurantImage, uploadRestaurantImage } from "@/server/uploads";
import { UUID } from "./queries";

/**
 * Saving a restaurant's configuration, from the admin setup wizard and from the restaurant's own
 * settings page. Each action checks who is asking for this specific restaurant (the id is bound
 * in the browser, so it is never trusted), validates with the domain schemas, and writes through
 * the user's own client, so row-level security and the database's field rules still apply:
 * owners can't change platform-only fields even if a request is forged.
 *
 * Who may save what:
 *   identity (name, web address, private details)  platform staff
 *   profile, images, location                       owners and platform staff
 *   hours, closures, operations                     owners, managers and platform staff
 */

const NOT_FOUND =
  "We couldn’t find that restaurant. It may have been removed, or you may not have access to it.";
const SLUG_TAKEN = "That web address is taken. Choose another.";
const CHECK_IMAGE = "Check the image and try again.";

/** Keeps what was typed when access is refused, so nothing is lost after signing in again. */
function keepValues(state: FormState, formData: FormData): FormState {
  return state.status === "error" ? { ...state, values: formValues(formData) } : state;
}

/**
 * "Save and continue" in the wizard posts then=<next step>. Only known steps are accepted and
 * the path is built here, so the redirect can't be pointed anywhere else.
 */
function nextStepPath(formData: FormData, restaurantId: string, viewer: Viewer): string | null {
  if (!viewer.platformRole) return null;
  const then = text(formData, "then");
  const step = WIZARD_STEPS.find((s) => s.slug === then);
  return step ? `/admin/restaurants/${restaurantId}/${step.slug}` : null;
}

/** Ends a successful save: refresh what's on screen, or move to the next wizard step. */
function finish(message: string, next: string | null): FormState {
  refresh();
  if (next) redirect(next);
  return success(message);
}

// ---------------------------------------------------------------------------------------------
// Identity (wizard step 1): platform staff only
// ---------------------------------------------------------------------------------------------

export async function saveIdentity(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizePlatform("restaurants.onboard");
  if (!auth.ok) return keepValues(auth.state, formData);
  if (!UUID.test(restaurantId)) return failure(NOT_FOUND);
  const { supabase, viewer } = auth;

  const { data: current, error: loadError } = await supabase
    .from("restaurants")
    .select("slug, first_published_at")
    .eq("id", restaurantId)
    .maybeSingle();
  if (loadError) return fromDb(loadError, formData);
  if (!current) return failure(NOT_FOUND, { values: formValues(formData) });
  // Once published, the web address is fixed so saved links keep working; the database agrees.
  const slugLocked = current.first_published_at !== null;

  const parsed = identitySchema.safeParse({
    displayName: text(formData, "displayName"),
    slug: slugLocked ? current.slug : text(formData, "slug"),
    description: text(formData, "description"),
    cuisineTags: text(formData, "cuisineTags"),
    legalName: text(formData, "legalName"),
    publicPhone: text(formData, "publicPhone"),
    contactEmail: text(formData, "contactEmail"),
    contactPhone: text(formData, "contactPhone"),
  });
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const v = parsed.data;

  const { data: saved, error } = await supabase
    .from("restaurants")
    .update({
      display_name: v.displayName,
      ...(slugLocked ? {} : { slug: v.slug }),
      description: v.description,
      cuisine_tags: v.cuisineTags,
      public_phone: v.publicPhone,
    })
    .eq("id", restaurantId)
    .select("id");
  if (error) {
    if (error.code === "23505") {
      return failure(SLUG_TAKEN, {
        fieldErrors: { slug: SLUG_TAKEN },
        values: formValues(formData),
      });
    }
    return fromDb(error, formData);
  }
  if (!saved?.length) return failure(NOT_FOUND, { values: formValues(formData) });

  const { error: privateError } = await supabase.from("restaurant_private").upsert(
    {
      restaurant_id: restaurantId,
      legal_name: v.legalName,
      contact_email: v.contactEmail,
      contact_phone: v.contactPhone,
    },
    { onConflict: "restaurant_id" },
  );
  if (privateError) {
    refresh();
    return fromDb(
      privateError,
      formData,
      "We saved the public details but not the private ones. Try saving again.",
    );
  }

  return finish("Identity saved.", nextStepPath(formData, restaurantId, viewer));
}

// ---------------------------------------------------------------------------------------------
// Profile (owners): description, cuisine labels, public phone
// ---------------------------------------------------------------------------------------------

const profileSchema = identitySchema.pick({
  description: true,
  cuisineTags: true,
  publicPhone: true,
});

export async function saveProfile(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeRestaurant(restaurantId, ["owner"]);
  if (!auth.ok) return keepValues(auth.state, formData);
  if (!UUID.test(restaurantId)) return failure(NOT_FOUND);

  const parsed = profileSchema.safeParse({
    description: text(formData, "description"),
    cuisineTags: text(formData, "cuisineTags"),
    publicPhone: text(formData, "publicPhone"),
  });
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const v = parsed.data;

  const { data, error } = await auth.supabase
    .from("restaurants")
    .update({
      description: v.description,
      cuisine_tags: v.cuisineTags,
      public_phone: v.publicPhone,
    })
    .eq("id", restaurantId)
    .select("id");
  if (error) return fromDb(error, formData);
  if (!data?.length) return failure(NOT_FOUND, { values: formValues(formData) });
  return finish("Profile saved.", null);
}

// ---------------------------------------------------------------------------------------------
// Location (wizard step 3; owners)
// ---------------------------------------------------------------------------------------------

export async function saveLocation(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeRestaurant(restaurantId, ["owner"]);
  if (!auth.ok) return keepValues(auth.state, formData);
  if (!UUID.test(restaurantId)) return failure(NOT_FOUND);

  const parsed = locationSchema.safeParse({
    address: text(formData, "address"),
    serviceArea: text(formData, "serviceArea"),
    directions: text(formData, "directions"),
    latitude: text(formData, "latitude"),
    longitude: text(formData, "longitude"),
  });
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const v = parsed.data;

  const { data, error } = await auth.supabase
    .from("restaurants")
    .update({
      address: v.address,
      service_area: v.serviceArea,
      directions: v.directions,
      latitude: v.latitude,
      longitude: v.longitude,
    })
    .eq("id", restaurantId)
    .select("id");
  if (error) return fromDb(error, formData);
  if (!data?.length) return failure(NOT_FOUND, { values: formValues(formData) });
  return finish("Location saved.", nextStepPath(formData, restaurantId, auth.viewer));
}

// ---------------------------------------------------------------------------------------------
// Weekly hours (wizard step 4; owners and managers). Saved as a whole week, atomically.
// ---------------------------------------------------------------------------------------------

export async function saveHours(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeRestaurant(restaurantId, ["owner", "manager"]);
  if (!auth.ok) return keepValues(auth.state, formData);
  if (!UUID.test(restaurantId)) return failure(NOT_FOUND);

  const values = formValues(formData);
  const parsed = intervalsFromValues(values);
  if (Object.keys(parsed.errors).length > 0) {
    return failure("Check the highlighted days and try again.", {
      fieldErrors: parsed.errors,
      values,
    });
  }
  const result = weeklyHoursSchema.safeParse(parsed.intervals);
  if (!result.success) {
    return failure("Check the highlighted days and try again.", {
      fieldErrors: mapIntervalErrors(fieldErrors(result.error), parsed.sources),
      values,
    });
  }

  const { error } = await auth.supabase.rpc("set_restaurant_hours", {
    p_restaurant_id: restaurantId,
    p_hours: toHoursPayload(result.data),
  });
  if (error) return fromDb(error, formData);
  return finish(
    result.data.length === 0
      ? "Opening hours saved. The restaurant shows as closed every day until you add hours."
      : "Opening hours saved.",
    null,
  );
}

// ---------------------------------------------------------------------------------------------
// Temporary closures (owners and managers). Times are typed in Nairobi time.
// ---------------------------------------------------------------------------------------------

export async function addClosure(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeRestaurant(restaurantId, ["owner", "manager"]);
  if (!auth.ok) return keepValues(auth.state, formData);
  if (!UUID.test(restaurantId)) return failure(NOT_FOUND);

  const parsed = closureSchema.safeParse({
    startAt: nairobiLocalToIso(text(formData, "startAt")),
    endAt: nairobiLocalToIso(text(formData, "endAt")),
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const v = parsed.data;
  if (v.endAt.getTime() <= Date.now()) {
    const message = "That time has already passed. Choose an end time in the future.";
    return failure("Check the highlighted fields and try again.", {
      fieldErrors: { endAt: message },
      values: formValues(formData),
    });
  }

  const { error } = await auth.supabase.from("restaurant_closures").insert({
    restaurant_id: restaurantId,
    start_at: v.startAt.toISOString(),
    end_at: v.endAt.toISOString(),
    reason: v.reason,
    created_by: auth.viewer.userId,
  });
  if (error) return fromDb(error, formData);
  return finish("Closure added. Customers can’t order during it.", null);
}

/** Bound to the restaurant on the server; the closure's id comes from the form. */
export async function removeClosure(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const closureId = text(formData, "closureId");
  const auth = await authorizeRestaurant(restaurantId, ["owner", "manager"]);
  if (!auth.ok) return auth.state;
  if (!UUID.test(restaurantId) || !UUID.test(closureId)) {
    return failure("We couldn’t find that closure. Reload the page and try again.");
  }

  // Scoped to the authorized restaurant, so a forged id can't remove another restaurant's closure.
  const { data, error } = await auth.supabase
    .from("restaurant_closures")
    .delete()
    .eq("id", closureId)
    .eq("restaurant_id", restaurantId)
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) {
    return failure("We couldn’t find that closure. It may already be removed. Reload the page.");
  }
  return finish("Closure removed.", null);
}

// ---------------------------------------------------------------------------------------------
// Operations (wizard step 4; owners and managers)
// ---------------------------------------------------------------------------------------------

export async function saveOperations(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeRestaurant(restaurantId, ["owner", "manager"]);
  if (!auth.ok) return keepValues(auth.state, formData);
  if (!UUID.test(restaurantId)) return failure(NOT_FOUND);

  const presets = text(formData, "prepPresets");
  const notWhole = presets
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .some((s) => !/^\d+$/.test(s));
  if (notWhole) {
    return failure("Check the highlighted fields and try again.", {
      fieldErrors: { prepPresets: "Use whole minutes separated by commas, like 5, 10, 15." },
      values: formValues(formData),
    });
  }

  const parsed = operationsSchema.safeParse({
    pickupEnabled: checked(formData, "pickupEnabled"),
    dineInEnabled: checked(formData, "dineInEnabled"),
    pickupInstructions: text(formData, "pickupInstructions"),
    prepPresets: presets,
    defaultPrepMinutes: text(formData, "defaultPrepMinutes"),
  });
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const v = parsed.data;

  const { data, error } = await auth.supabase
    .from("restaurants")
    .update({
      pickup_enabled: v.pickupEnabled,
      dine_in_enabled: v.dineInEnabled,
      pickup_instructions: v.pickupInstructions,
      prep_presets: v.prepPresets,
      default_prep_minutes: v.defaultPrepMinutes,
    })
    .eq("id", restaurantId)
    .select("id");
  if (error) return fromDb(error, formData);
  if (!data?.length) return failure(NOT_FOUND, { values: formValues(formData) });
  return finish("Operations saved.", nextStepPath(formData, restaurantId, auth.viewer));
}

// ---------------------------------------------------------------------------------------------
// Logo and cover (owners). One image per submit keeps each request under the upload limit.
// ---------------------------------------------------------------------------------------------

export async function saveImage(
  restaurantId: string,
  kind: "logo" | "cover",
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeRestaurant(restaurantId, ["owner"]);
  if (!auth.ok) return auth.state;
  if (!UUID.test(restaurantId) || (kind !== "logo" && kind !== "cover")) {
    return failure(NOT_FOUND);
  }
  const { supabase } = auth;
  const label = kind === "logo" ? "Logo" : "Cover photo";

  const { data: current, error: loadError } = await supabase
    .from("restaurants")
    .select("logo_path, cover_path")
    .eq("id", restaurantId)
    .maybeSingle();
  if (loadError) return fromDb(loadError);
  if (!current) return failure(NOT_FOUND);
  const oldPath = kind === "logo" ? current.logo_path : current.cover_path;

  const file = formData.get("image");
  let newPath: string | null;
  if (hasFile(file)) {
    const upload = await uploadRestaurantImage(supabase, restaurantId, kind, file);
    if (!upload.ok) return failure(CHECK_IMAGE, { fieldErrors: { image: upload.message } });
    newPath = upload.path;
  } else if (checked(formData, "remove")) {
    if (!oldPath) return success(`${label} removed.`);
    newPath = null;
  } else {
    return failure(CHECK_IMAGE, {
      fieldErrors: {
        image: oldPath
          ? "Choose an image to upload, or tick “Remove this image”."
          : "Choose an image to upload.",
      },
    });
  }

  const { data, error } = await supabase
    .from("restaurants")
    .update(kind === "logo" ? { logo_path: newPath } : { cover_path: newPath })
    .eq("id", restaurantId)
    .select("id");
  if (error || !data?.length) {
    await removeRestaurantImage(supabase, newPath);
    return error ? fromDb(error) : failure(NOT_FOUND);
  }
  // Every upload has a new path; the replaced file is removed only after the row points away.
  if (oldPath && oldPath !== newPath && oldPath.startsWith(`${restaurantId}/`)) {
    await removeRestaurantImage(supabase, oldPath);
  }
  return finish(newPath ? `${label} saved.` : `${label} removed.`, null);
}
