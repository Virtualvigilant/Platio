"use server";

import { redirect } from "next/navigation";
import type { RestaurantStatus } from "@/domain/restaurants/lifecycle";
import { newRestaurantSchema } from "@/domain/restaurants/config";
import {
  checked,
  failure,
  formValues,
  fromDb,
  fromValidation,
  text,
  type FormState,
} from "@/server/actions";
import { authorizePlatform } from "@/server/guards";
import { findSimilarRestaurants, mainWords } from "@/server/restaurant-config/similar-names";

export interface SimilarRestaurant {
  id: string;
  displayName: string;
  slug: string;
  status: RestaurantStatus;
}

/** FormState plus the existing restaurants a new one might duplicate. */
export type NewRestaurantState = FormState & { similar?: SimilarRestaurant[] };

const SLUG_TAKEN = "That web address is taken. Choose another.";

/**
 * Creates a draft restaurant (brief §4.3 steps 1–2), then opens the setup wizard. Duplicate web
 * addresses are refused; similar names warn and need "Create anyway" ticked.
 */
export async function createRestaurant(
  _prev: NewRestaurantState,
  formData: FormData,
): Promise<NewRestaurantState> {
  const auth = await authorizePlatform("restaurants.onboard");
  if (!auth.ok) {
    return auth.state.status === "error"
      ? { ...auth.state, values: formValues(formData) }
      : auth.state;
  }
  const { supabase } = auth;

  const parsed = newRestaurantSchema.safeParse({
    displayName: text(formData, "displayName"),
    slug: text(formData, "slug"),
  });
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const { displayName, slug } = parsed.data;

  // Candidates: the same web address, or any name or address containing one of the main words.
  // Words are letters and digits only and the slug is validated, so both are safe in the filter.
  const words = mainWords(displayName);
  const filters = [
    `slug.eq.${slug}`,
    ...words.flatMap((w) => [`display_name.ilike.%${w}%`, `slug.ilike.%${w}%`]),
  ];
  const { data: candidates, error: searchError } = await supabase
    .from("restaurants")
    .select("id, display_name, slug, status")
    .or(filters.join(","))
    .order("display_name")
    .limit(100);
  if (searchError) return fromDb(searchError, formData);

  const existing = (
    (candidates ?? []) as {
      id: string;
      display_name: string;
      slug: string;
      status: RestaurantStatus;
    }[]
  ).map((r) => ({ id: r.id, displayName: r.display_name, slug: r.slug, status: r.status }));

  if (existing.some((r) => r.slug === slug)) {
    return failure(SLUG_TAKEN, {
      fieldErrors: { slug: SLUG_TAKEN },
      values: formValues(formData),
    });
  }

  const similar = findSimilarRestaurants(displayName, slug, existing).slice(0, 10);
  if (similar.length > 0 && !checked(formData, "createAnyway")) {
    const message =
      similar.length === 1
        ? "A restaurant with a similar name already exists. Check it isn’t the same business, then tick “Create anyway” to continue."
        : "Restaurants with similar names already exist. Check none is the same business, then tick “Create anyway” to continue.";
    return {
      ...failure(message, {
        fieldErrors: { createAnyway: "Tick this to create the restaurant anyway." },
        values: formValues(formData),
      }),
      similar,
    };
  }

  const { data: created, error } = await supabase
    .from("restaurants")
    .insert({ display_name: displayName, slug })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return failure(SLUG_TAKEN, {
        fieldErrors: { slug: SLUG_TAKEN },
        values: formValues(formData),
      });
    }
    return fromDb(error, formData, "We couldn’t create the restaurant. Try again.");
  }

  redirect(`/admin/restaurants/${created.id}/details`);
}
