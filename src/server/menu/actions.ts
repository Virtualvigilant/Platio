"use server";

/**
 * Every change to a restaurant's menu (brief §6.3, §7.2 step 5). Each action:
 *   1. authorizes the restaurant again (ids are bound on the client, so they are input like any other),
 *   2. validates with the domain schemas (prices become integer cents through parseKES),
 *   3. checks that the category, dish, group or option belongs to that restaurant, reading it with
 *      the signed-in person's client (row-level security hides other tenants' rows, so "not found"
 *      and "not yours" look the same),
 *   4. writes as that person, so the database's policies still apply, and
 *   5. refreshes the page.
 * Owners and managers edit the menu; counter staff may only change availability. Platform staff
 * with restaurants.onboard may do everything.
 */

import { refresh } from "next/cache";
import type { RestaurantRole } from "@/domain/access";
import {
  categorySchema,
  fieldErrors,
  menuItemSchema,
  modifierGroupSchema,
  modifierOptionSchema,
} from "@/domain/restaurants/config";
import type { ServerClient } from "@/lib/supabase/server";
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
import { authorizeRestaurant } from "@/server/guards";
import { hasFile, removeRestaurantImage, uploadRestaurantImage } from "@/server/uploads";
import { byPosition, moveAmongActive } from "./queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

const EDITORS: readonly RestaurantRole[] = ["owner", "manager"];
const EVERYONE: readonly RestaurantRole[] = ["owner", "manager", "staff"];

const MAX_GROUPS_PER_DISH = 20;

/**
 * KES 1,000,000 in cents: far above any dish, and well inside the database's integer range, so a
 * slip of the keyboard gets a clear message instead of a failed save.
 */
const MAX_PRICE_MINOR = 100_000_000;

const NOT_FOUND = {
  restaurant: "We couldn’t find that restaurant. Reload the page and try again.",
  category:
    "We couldn’t find that category. It may have been deleted. Reload the page and try again.",
  item: "We couldn’t find that dish. It may have been changed elsewhere. Reload the page and try again.",
  group:
    "We couldn’t find that choice group. It may have been deleted. Reload the page and try again.",
  option: "We couldn’t find that option. It may have been deleted. Reload the page and try again.",
};
const DENIED = "You don’t have permission to change this menu.";
const CHECK_FIELDS = "Check the highlighted fields and try again.";
const CATEGORY_IN_USE =
  "This category still has dishes, including archived ones. Move them to another category first, or keep the category archived.";

type Auth = Awaited<ReturnType<typeof authorizeRestaurant>>;

async function authorize(restaurantId: unknown, roles = EDITORS): Promise<Auth> {
  if (!isId(restaurantId)) return { ok: false, state: failure(NOT_FOUND.restaurant) };
  return authorizeRestaurant(restaurantId, roles);
}

const isDirection = (value: unknown): value is "up" | "down" => value === "up" || value === "down";

/** A field error when a parsed price is beyond MAX_PRICE_MINOR, otherwise null. */
function priceTooHigh(minor: number, field: string, formData: FormData): FormState | null {
  if (minor <= MAX_PRICE_MINOR) return null;
  return failure(CHECK_FIELDS, {
    fieldErrors: { [field]: "Enter an amount up to KES 1,000,000." },
    values: formValues(formData),
  });
}

// ---------------------------------------------------------------------------------------------
// Reading rows that must belong to the restaurant
// ---------------------------------------------------------------------------------------------

type CategoryRef = { id: string; name: string; active: boolean };
type ItemRef = {
  id: string;
  name: string;
  category_id: string;
  image_path: string | null;
  price_minor: number;
  active: boolean;
};
type GroupRef = { id: string; name: string };
type OptionRef = { id: string; name: string; modifier_group_id: string };

async function findCategory(supabase: ServerClient, restaurantId: string, id: string) {
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, name, active")
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return { row: data as CategoryRef | null, error };
}

async function findItem(supabase: ServerClient, restaurantId: string, id: string) {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, category_id, image_path, price_minor, active")
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return { row: data as ItemRef | null, error };
}

async function findGroup(supabase: ServerClient, restaurantId: string, id: string) {
  const { data, error } = await supabase
    .from("modifier_groups")
    .select("id, name")
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return { row: data as GroupRef | null, error };
}

async function findOption(supabase: ServerClient, restaurantId: string, id: string) {
  const { data, error } = await supabase
    .from("modifier_options")
    .select("id, name, modifier_group_id")
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return { row: data as OptionRef | null, error };
}

/** One past the last position, so new rows go to the end. */
async function nextSortOrder(
  supabase: ServerClient,
  table: "menu_categories" | "menu_items" | "modifier_groups" | "modifier_options",
  column: "restaurant_id" | "category_id" | "modifier_group_id",
  value: string,
): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select("sort_order")
    .eq(column, value)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { sort_order: number } | null)?.sort_order ?? 0) + 1;
}

// ---------------------------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------------------------

function categoryInput(formData: FormData) {
  return categorySchema.safeParse({
    name: text(formData, "name"),
    description: text(formData, "description"),
  });
}

export async function createCategory(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;

  const parsed = categoryInput(formData);
  if (!parsed.success) return fromValidation(parsed.error, formData);

  const { error } = await supabase
    .from("menu_categories")
    .insert({
      restaurant_id: restaurantId,
      name: parsed.data.name,
      description: parsed.data.description,
      sort_order: await nextSortOrder(supabase, "menu_categories", "restaurant_id", restaurantId),
    })
    .select("id")
    .single();
  if (error) return fromDb(error, formData);

  refresh();
  return success(`${parsed.data.name} added. Add dishes to it next.`);
}

export async function updateCategory(
  restaurantId: string,
  categoryId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (!isId(categoryId)) return failure(NOT_FOUND.category);

  const parsed = categoryInput(formData);
  if (!parsed.success) return fromValidation(parsed.error, formData);

  const { data, error } = await supabase
    .from("menu_categories")
    .update({ name: parsed.data.name, description: parsed.data.description })
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();
  if (error) return fromDb(error, formData);
  if (!data) return failure(NOT_FOUND.category, { values: formValues(formData) });

  refresh();
  return success(`${parsed.data.name} saved.`);
}

async function setCategoryActive(
  restaurantId: string,
  categoryId: string,
  active: boolean,
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (!isId(categoryId)) return failure(NOT_FOUND.category);

  const { data, error } = await supabase
    .from("menu_categories")
    .update({ active })
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId)
    .select("id, name")
    .maybeSingle();
  if (error) return fromDb(error);
  if (!data) return failure(NOT_FOUND.category);
  const { name } = data as { name: string };

  refresh();
  return success(
    active
      ? `${name} restored. Its active dishes are back on the menu.`
      : `${name} archived. Customers no longer see it or its dishes. Restore it from Archived at any time.`,
  );
}

export async function archiveCategory(
  restaurantId: string,
  categoryId: string,
): Promise<FormState> {
  return setCategoryActive(restaurantId, categoryId, false);
}

export async function restoreCategory(
  restaurantId: string,
  categoryId: string,
): Promise<FormState> {
  return setCategoryActive(restaurantId, categoryId, true);
}

/** Only an empty category can go; the database refuses while any dish (even archived) uses it. */
export async function deleteCategory(restaurantId: string, categoryId: string): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (!isId(categoryId)) return failure(NOT_FOUND.category);

  const found = await findCategory(supabase, restaurantId, categoryId);
  if (found.error) return fromDb(found.error);
  if (!found.row) return failure(NOT_FOUND.category);

  const { count, error: countError } = await supabase
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("category_id", categoryId);
  if (countError) return fromDb(countError);
  if ((count ?? 0) > 0) return failure(CATEGORY_IN_USE);

  const { data, error } = await supabase
    .from("menu_categories")
    .delete()
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();
  if (error) return error.code === "23503" ? failure(CATEGORY_IN_USE) : fromDb(error);
  if (!data) return failure(DENIED);

  refresh();
  return success(`${found.row.name} deleted.`);
}

export async function moveCategory(
  restaurantId: string,
  categoryId: string,
  direction: "up" | "down",
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (!isId(categoryId) || !isDirection(direction)) return failure(NOT_FOUND.category);

  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, name, sort_order, active")
    .eq("restaurant_id", restaurantId);
  if (error) return fromDb(error);
  const rows = ((data ?? []) as { id: string; name: string; sort_order: number; active: boolean }[])
    .map((r) => ({ ...r, sortOrder: r.sort_order }))
    .sort(byPosition);
  const target = rows.find((r) => r.id === categoryId);
  if (!target) return failure(NOT_FOUND.category);
  if (!target.active) return failure("Restore this category before moving it.");

  const order = moveAmongActive(rows, categoryId, direction);
  if (!order) return success(`${target.name} is already ${direction === "up" ? "first" : "last"}.`);

  const { error: moveError } = await supabase.rpc("reorder_menu_categories", {
    p_restaurant_id: restaurantId,
    p_ids: order,
  });
  if (moveError) return fromDb(moveError);

  refresh();
  return success(`${target.name} moved ${direction}.`);
}

// ---------------------------------------------------------------------------------------------
// Dishes
// ---------------------------------------------------------------------------------------------

function itemInput(formData: FormData) {
  return menuItemSchema.safeParse({
    categoryId: text(formData, "categoryId"),
    name: text(formData, "name"),
    description: text(formData, "description"),
    price: text(formData, "price"),
    prepMinutes: text(formData, "prepMinutes"),
    tags: text(formData, "tags"),
  });
}

/** The choice groups ticked on the dish form, de-duplicated, in the order the form lists them. */
function groupIdsFrom(formData: FormData): string[] | null {
  const ids = [
    ...new Set(
      formData.getAll("modifierGroupIds").filter((v): v is string => typeof v === "string"),
    ),
  ];
  if (ids.length > MAX_GROUPS_PER_DISH || !ids.every(isId)) return null;
  return ids;
}

/** Null when every id is one of this restaurant's groups; otherwise what to tell the person. */
async function checkGroups(
  supabase: ServerClient,
  restaurantId: string,
  ids: string[],
  formData: FormData,
): Promise<FormState | null> {
  if (ids.length === 0) return null;
  const { data, error } = await supabase
    .from("modifier_groups")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .in("id", ids);
  if (error) return fromDb(error, formData);
  if ((data ?? []).length !== ids.length) {
    return failure(
      "One of the choice groups no longer exists. Reload the page, then save the dish again.",
      { values: formValues(formData) },
    );
  }
  return null;
}

/** Attaches exactly `groupIds` to the dish, in that order. */
async function setItemGroups(
  supabase: ServerClient,
  restaurantId: string,
  itemId: string,
  groupIds: string[],
) {
  const { data: existing, error: readError } = await supabase
    .from("menu_item_modifier_groups")
    .select("modifier_group_id")
    .eq("restaurant_id", restaurantId)
    .eq("menu_item_id", itemId);
  if (readError) return readError;

  const remove = ((existing ?? []) as { modifier_group_id: string }[])
    .map((r) => r.modifier_group_id)
    .filter((id) => !groupIds.includes(id));
  if (remove.length > 0) {
    const { error } = await supabase
      .from("menu_item_modifier_groups")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("menu_item_id", itemId)
      .in("modifier_group_id", remove);
    if (error) return error;
  }
  if (groupIds.length > 0) {
    const { error } = await supabase.from("menu_item_modifier_groups").upsert(
      groupIds.map((groupId, index) => ({
        restaurant_id: restaurantId,
        menu_item_id: itemId,
        modifier_group_id: groupId,
        sort_order: index + 1,
      })),
      { onConflict: "menu_item_id,modifier_group_id" },
    );
    if (error) return error;
  }
  return null;
}

type Upload = { ok: true; path: string | null } | { ok: false; state: FormState };

async function uploadItemImage(
  supabase: ServerClient,
  restaurantId: string,
  formData: FormData,
): Promise<Upload> {
  const image = formData.get("image");
  if (!hasFile(image)) return { ok: true, path: null };
  const result = await uploadRestaurantImage(supabase, restaurantId, "item", image);
  if (!result.ok) {
    return {
      ok: false,
      state: failure(CHECK_FIELDS, {
        fieldErrors: { image: result.message },
        values: formValues(formData),
      }),
    };
  }
  return { ok: true, path: result.path };
}

export async function createMenuItem(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;

  const parsed = itemInput(formData);
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const dish = parsed.data;
  const tooHigh = priceTooHigh(dish.price, "price", formData);
  if (tooHigh) return tooHigh;
  const groupIds = groupIdsFrom(formData);
  if (!groupIds) return failure(NOT_FOUND.group, { values: formValues(formData) });

  const category = await findCategory(supabase, restaurantId, dish.categoryId);
  if (category.error) return fromDb(category.error, formData);
  if (!category.row) {
    return failure(CHECK_FIELDS, {
      fieldErrors: { categoryId: "Choose one of this menu’s categories." },
      values: formValues(formData),
    });
  }
  const groupProblem = await checkGroups(supabase, restaurantId, groupIds, formData);
  if (groupProblem) return groupProblem;

  const upload = await uploadItemImage(supabase, restaurantId, formData);
  if (!upload.ok) return upload.state;

  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      restaurant_id: restaurantId,
      category_id: dish.categoryId,
      name: dish.name,
      description: dish.description,
      price_minor: dish.price,
      prep_minutes: dish.prepMinutes,
      tags: dish.tags,
      image_path: upload.path,
      sort_order: await nextSortOrder(supabase, "menu_items", "category_id", dish.categoryId),
    })
    .select("id")
    .single();
  if (error || !data) {
    await removeRestaurantImage(supabase, upload.path);
    return error ? fromDb(error, formData) : failure(DENIED, { values: formValues(formData) });
  }

  const linkError = await setItemGroups(
    supabase,
    restaurantId,
    (data as { id: string }).id,
    groupIds,
  );
  refresh();
  if (linkError) {
    return failure(
      `${dish.name} was added, but we couldn’t attach its choices. Don’t add it again: close this form, edit the dish and tick its choices.`,
    );
  }
  return success(
    category.row.active
      ? `${dish.name} added to ${category.row.name}.`
      : `${dish.name} added. ${category.row.name} is archived, so customers won’t see it until you restore the category.`,
  );
}

export async function updateMenuItem(
  restaurantId: string,
  itemId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (!isId(itemId)) return failure(NOT_FOUND.item);

  const parsed = itemInput(formData);
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const dish = parsed.data;
  const tooHigh = priceTooHigh(dish.price, "price", formData);
  if (tooHigh) return tooHigh;
  const groupIds = groupIdsFrom(formData);
  if (!groupIds) return failure(NOT_FOUND.group, { values: formValues(formData) });

  const current = await findItem(supabase, restaurantId, itemId);
  if (current.error) return fromDb(current.error, formData);
  if (!current.row) return failure(NOT_FOUND.item, { values: formValues(formData) });
  const before = current.row;

  const category = await findCategory(supabase, restaurantId, dish.categoryId);
  if (category.error) return fromDb(category.error, formData);
  if (!category.row) {
    return failure(CHECK_FIELDS, {
      fieldErrors: { categoryId: "Choose one of this menu’s categories." },
      values: formValues(formData),
    });
  }
  const groupProblem = await checkGroups(supabase, restaurantId, groupIds, formData);
  if (groupProblem) return groupProblem;

  // A new file wins over "Remove this image".
  const upload = await uploadItemImage(supabase, restaurantId, formData);
  if (!upload.ok) return upload.state;
  const imagePath = upload.path ?? (checked(formData, "removeImage") ? null : before.image_path);

  const moved = before.category_id !== dish.categoryId;
  const { data, error } = await supabase
    .from("menu_items")
    .update({
      category_id: dish.categoryId,
      name: dish.name,
      description: dish.description,
      price_minor: dish.price,
      prep_minutes: dish.prepMinutes,
      tags: dish.tags,
      image_path: imagePath,
      ...(moved
        ? {
            sort_order: await nextSortOrder(supabase, "menu_items", "category_id", dish.categoryId),
          }
        : {}),
    })
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    await removeRestaurantImage(supabase, upload.path);
    return error ? fromDb(error, formData) : failure(DENIED, { values: formValues(formData) });
  }

  // The row points at the new picture now, so the old file can go.
  if (before.image_path && before.image_path !== imagePath) {
    await removeRestaurantImage(supabase, before.image_path);
  }

  const linkError = await setItemGroups(supabase, restaurantId, itemId, groupIds);
  refresh();
  if (linkError) {
    return failure(
      `${dish.name} was saved, but we couldn’t update its choices. Tick them again and save.`,
      { values: formValues(formData) },
    );
  }
  if (before.price_minor !== dish.price) {
    return success(
      `${dish.name} saved. The new price applies to new orders; past orders keep the price paid.`,
    );
  }
  return success(`${dish.name} saved.`);
}

async function setItemActive(
  restaurantId: string,
  itemId: string,
  active: boolean,
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (!isId(itemId)) return failure(NOT_FOUND.item);

  const { data, error } = await supabase
    .from("menu_items")
    .update({ active })
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId)
    .select("id, name, category_id")
    .maybeSingle();
  if (error) return fromDb(error);
  if (!data) return failure(NOT_FOUND.item);
  const item = data as { name: string; category_id: string };

  refresh();
  if (!active) {
    return success(
      `${item.name} archived. Customers no longer see it. Restore it from Archived at any time.`,
    );
  }
  const category = await findCategory(supabase, restaurantId, item.category_id);
  if (category.row && !category.row.active) {
    return success(
      `${item.name} restored. ${category.row.name} is archived, so customers won’t see it until you restore the category.`,
    );
  }
  return success(`${item.name} restored to the menu.`);
}

export async function archiveMenuItem(restaurantId: string, itemId: string): Promise<FormState> {
  return setItemActive(restaurantId, itemId, false);
}

export async function restoreMenuItem(restaurantId: string, itemId: string): Promise<FormState> {
  return setItemActive(restaurantId, itemId, true);
}

export async function moveMenuItem(
  restaurantId: string,
  itemId: string,
  direction: "up" | "down",
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (!isId(itemId) || !isDirection(direction)) return failure(NOT_FOUND.item);

  const current = await findItem(supabase, restaurantId, itemId);
  if (current.error) return fromDb(current.error);
  if (!current.row) return failure(NOT_FOUND.item);
  if (!current.row.active) return failure("Restore this dish before moving it.");
  const categoryId = current.row.category_id;

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, sort_order, active")
    .eq("restaurant_id", restaurantId)
    .eq("category_id", categoryId);
  if (error) return fromDb(error);
  const rows = ((data ?? []) as { id: string; name: string; sort_order: number; active: boolean }[])
    .map((r) => ({ ...r, sortOrder: r.sort_order }))
    .sort(byPosition);

  const order = moveAmongActive(rows, itemId, direction);
  if (!order) {
    return success(
      `${current.row.name} is already ${direction === "up" ? "first" : "last"} in its category.`,
    );
  }

  const { error: moveError } = await supabase.rpc("reorder_menu_items", {
    p_category_id: categoryId,
    p_ids: order,
  });
  if (moveError) return fromDb(moveError);

  refresh();
  return success(`${current.row.name} moved ${direction}.`);
}

/**
 * "Unavailable" is sold out for now; the dish stays on the menu, labelled, and can't be ordered.
 * Counter staff may do this too. Team members go through set_menu_item_availability; platform
 * staff (who aren't members) update the row, which their policy allows.
 */
export async function setMenuItemAvailability(
  restaurantId: string,
  itemId: string,
  availability: "available" | "unavailable",
): Promise<FormState> {
  const auth = await authorize(restaurantId, EVERYONE);
  if (!auth.ok) return auth.state;
  const { supabase, viewer } = auth;
  if (!isId(itemId) || (availability !== "available" && availability !== "unavailable")) {
    return failure(NOT_FOUND.item);
  }

  const current = await findItem(supabase, restaurantId, itemId);
  if (current.error) return fromDb(current.error);
  if (!current.row) return failure(NOT_FOUND.item);

  const isMember = viewer.memberships.some((m) => m.restaurantId === restaurantId);
  if (isMember) {
    const { error } = await supabase.rpc("set_menu_item_availability", {
      p_item_id: itemId,
      p_availability: availability,
    });
    if (error) return fromDb(error);
  } else {
    const { data, error } = await supabase
      .from("menu_items")
      .update({ availability })
      .eq("id", itemId)
      .eq("restaurant_id", restaurantId)
      .select("id")
      .maybeSingle();
    if (error) return fromDb(error);
    if (!data) return failure(DENIED);
  }

  refresh();
  return success(
    availability === "available"
      ? `${current.row.name} is available again.`
      : `${current.row.name} is marked unavailable. Customers can see it but can’t order it.`,
  );
}

// ---------------------------------------------------------------------------------------------
// Choice groups ("modifier groups") and their options
// ---------------------------------------------------------------------------------------------

function groupInput(formData: FormData) {
  const minSelect = text(formData, "minSelect").trim() || "0";
  const maxSelect = text(formData, "maxSelect").trim();
  const extra: Record<string, string> = {};
  if (!/^\d{1,2}$/.test(minSelect) || Number(minSelect) > 20) {
    extra.minSelect = "Enter a whole number from 0 to 20.";
  }
  if (!/^\d{1,2}$/.test(maxSelect) || Number(maxSelect) < 1 || Number(maxSelect) > 20) {
    extra.maxSelect = "Enter a whole number from 1 to 20.";
  }
  const parsed = modifierGroupSchema.safeParse({
    name: text(formData, "name"),
    required: checked(formData, "required"),
    minSelect,
    maxSelect,
  });
  if (parsed.success && Object.keys(extra).length === 0) {
    return { ok: true as const, data: parsed.data };
  }
  return {
    ok: false as const,
    state: failure(CHECK_FIELDS, {
      fieldErrors: { ...(parsed.success ? {} : fieldErrors(parsed.error)), ...extra },
      values: formValues(formData),
    }),
  };
}

export async function createModifierGroup(
  restaurantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;

  const input = groupInput(formData);
  if (!input.ok) return input.state;
  const group = input.data;

  const { error } = await supabase
    .from("modifier_groups")
    .insert({
      restaurant_id: restaurantId,
      name: group.name,
      required: group.required,
      min_select: group.minSelect,
      max_select: group.maxSelect,
      sort_order: await nextSortOrder(supabase, "modifier_groups", "restaurant_id", restaurantId),
    })
    .select("id")
    .single();
  if (error) return fromDb(error, formData);

  refresh();
  return success(`${group.name} added. Add its options, then tick it on the dishes that offer it.`);
}

export async function updateModifierGroup(
  restaurantId: string,
  groupId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (!isId(groupId)) return failure(NOT_FOUND.group);

  const input = groupInput(formData);
  if (!input.ok) return input.state;
  const group = input.data;

  const { data, error } = await supabase
    .from("modifier_groups")
    .update({
      name: group.name,
      required: group.required,
      min_select: group.minSelect,
      max_select: group.maxSelect,
    })
    .eq("id", groupId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();
  if (error) return fromDb(error, formData);
  if (!data) return failure(NOT_FOUND.group, { values: formValues(formData) });

  refresh();
  return success(`${group.name} saved.`);
}

/** Removes the group, its options and its links to dishes. Past orders keep their snapshots. */
export async function deleteModifierGroup(
  restaurantId: string,
  groupId: string,
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (!isId(groupId)) return failure(NOT_FOUND.group);

  const { data, error } = await supabase
    .from("modifier_groups")
    .delete()
    .eq("id", groupId)
    .eq("restaurant_id", restaurantId)
    .select("id, name")
    .maybeSingle();
  if (error) return fromDb(error);
  if (!data) return failure(NOT_FOUND.group);

  refresh();
  return success(
    `${(data as { name: string }).name} deleted. Dishes that used it no longer offer these choices.`,
  );
}

function optionInput(formData: FormData) {
  return modifierOptionSchema.safeParse({
    name: text(formData, "name"),
    // An empty extra cost means the option is free.
    priceDelta: text(formData, "priceDelta").trim() || "0",
  });
}

export async function createModifierOption(
  restaurantId: string,
  groupId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (!isId(groupId)) return failure(NOT_FOUND.group);

  const parsed = optionInput(formData);
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const tooHigh = priceTooHigh(parsed.data.priceDelta, "priceDelta", formData);
  if (tooHigh) return tooHigh;

  const group = await findGroup(supabase, restaurantId, groupId);
  if (group.error) return fromDb(group.error, formData);
  if (!group.row) return failure(NOT_FOUND.group, { values: formValues(formData) });

  const { error } = await supabase
    .from("modifier_options")
    .insert({
      restaurant_id: restaurantId,
      modifier_group_id: groupId,
      name: parsed.data.name,
      price_delta_minor: parsed.data.priceDelta,
      active: true,
      sort_order: await nextSortOrder(supabase, "modifier_options", "modifier_group_id", groupId),
    })
    .select("id")
    .single();
  if (error) return fromDb(error, formData);

  refresh();
  return success(`${parsed.data.name} added to ${group.row.name}.`);
}

export async function updateModifierOption(
  restaurantId: string,
  optionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (!isId(optionId)) return failure(NOT_FOUND.option);

  const parsed = optionInput(formData);
  if (!parsed.success) return fromValidation(parsed.error, formData);
  const tooHigh = priceTooHigh(parsed.data.priceDelta, "priceDelta", formData);
  if (tooHigh) return tooHigh;

  const { data, error } = await supabase
    .from("modifier_options")
    .update({
      name: parsed.data.name,
      price_delta_minor: parsed.data.priceDelta,
      active: checked(formData, "active"),
    })
    .eq("id", optionId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();
  if (error) return fromDb(error, formData);
  if (!data) return failure(NOT_FOUND.option, { values: formValues(formData) });

  refresh();
  return success(`${parsed.data.name} saved.`);
}

export async function deleteModifierOption(
  restaurantId: string,
  optionId: string,
): Promise<FormState> {
  const auth = await authorize(restaurantId);
  if (!auth.ok) return auth.state;
  const { supabase } = auth;
  if (!isId(optionId)) return failure(NOT_FOUND.option);

  const found = await findOption(supabase, restaurantId, optionId);
  if (found.error) return fromDb(found.error);
  if (!found.row) return failure(NOT_FOUND.option);

  const { data, error } = await supabase
    .from("modifier_options")
    .delete()
    .eq("id", optionId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();
  if (error) return fromDb(error);
  if (!data) return failure(DENIED);

  refresh();
  return success(`${found.row.name} deleted.`);
}
