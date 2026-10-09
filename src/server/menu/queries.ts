import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { publicAssetUrl } from "@/server/storage";

/**
 * A restaurant's whole menu as its editors see it: archived categories, dishes and options
 * included. Read with the signed-in person's client, so row-level security decides what comes back
 * (members and platform staff see everything for their restaurant; nobody sees another tenant's).
 */

export interface EditableCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  /** False when archived: hidden from customers, kept for history. */
  active: boolean;
}

export interface EditableItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceMinor: number;
  prepMinutes: number | null;
  tags: string[];
  imagePath: string | null;
  imageUrl: string | null;
  sortOrder: number;
  /** False when archived. */
  active: boolean;
  /** False when sold out for now ("Unavailable"). */
  available: boolean;
  /** Attached choice groups, in the order they're shown on the dish. */
  modifierGroupIds: string[];
}

export interface EditableOption {
  id: string;
  groupId: string;
  name: string;
  priceDeltaMinor: number;
  active: boolean;
  sortOrder: number;
}

export interface EditableModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: EditableOption[];
  /** Dishes this group is attached to. */
  itemIds: string[];
}

export interface MenuForEditing {
  restaurantId: string;
  /** In menu order. */
  categories: EditableCategory[];
  /** In menu order within each category. */
  items: EditableItem[];
  modifierGroups: EditableModifierGroup[];
}

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
};

type ItemRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_minor: number;
  prep_minutes: number | null;
  tags: string[] | null;
  image_path: string | null;
  sort_order: number;
  active: boolean;
  availability: "available" | "unavailable";
};

type GroupRow = {
  id: string;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number;
  sort_order: number;
};

type OptionRow = {
  id: string;
  modifier_group_id: string;
  name: string;
  price_delta_minor: number;
  active: boolean;
  sort_order: number;
};

type LinkRow = { menu_item_id: string; modifier_group_id: string; sort_order: number };

/** Menu order: sort_order first; ties (rows that were never reordered) fall back to name, then id. */
export function byPosition<T extends { sortOrder: number; name: string; id: string }>(
  a: T,
  b: T,
): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/**
 * The new order of a list after moving one row past its neighbour among the active rows. Archived
 * rows keep their relative order at the end, so they never sit between two visible ones.
 * Returns null when the row isn't active or is already at that end.
 */
export function moveAmongActive<T extends { id: string; active: boolean }>(
  ordered: readonly T[],
  id: string,
  direction: "up" | "down",
): string[] | null {
  const active = ordered.filter((r) => r.active).map((r) => r.id);
  const archived = ordered.filter((r) => !r.active).map((r) => r.id);
  const from = active.indexOf(id);
  if (from === -1) return null;
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= active.length) return null;
  [active[from], active[to]] = [active[to], active[from]];
  return [...active, ...archived];
}

export async function getMenuForEditing(
  supabase: ServerClient,
  restaurantId: string,
): Promise<MenuForEditing> {
  const [categories, items, groups, options, links] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, description, sort_order, active")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("menu_items")
      .select(
        "id, category_id, name, description, price_minor, prep_minutes, tags, image_path, sort_order, active, availability",
      )
      .eq("restaurant_id", restaurantId),
    supabase
      .from("modifier_groups")
      .select("id, name, required, min_select, max_select, sort_order")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("modifier_options")
      .select("id, modifier_group_id, name, price_delta_minor, active, sort_order")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("menu_item_modifier_groups")
      .select("menu_item_id, modifier_group_id, sort_order")
      .eq("restaurant_id", restaurantId),
  ]);
  for (const result of [categories, items, groups, options, links]) {
    if (result.error) throw new Error(`Could not load the menu: ${result.error.message}`);
  }

  const linkRows = ((links.data ?? []) as LinkRow[]).sort(
    (a, b) => a.sort_order - b.sort_order || a.modifier_group_id.localeCompare(b.modifier_group_id),
  );
  const groupsByItem = new Map<string, string[]>();
  const itemsByGroup = new Map<string, string[]>();
  for (const link of linkRows) {
    groupsByItem.set(link.menu_item_id, [
      ...(groupsByItem.get(link.menu_item_id) ?? []),
      link.modifier_group_id,
    ]);
    itemsByGroup.set(link.modifier_group_id, [
      ...(itemsByGroup.get(link.modifier_group_id) ?? []),
      link.menu_item_id,
    ]);
  }

  const categoryList: EditableCategory[] = ((categories.data ?? []) as CategoryRow[])
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      sortOrder: c.sort_order,
      active: c.active,
    }))
    .sort(byPosition);

  const itemList: EditableItem[] = ((items.data ?? []) as ItemRow[])
    .map((i) => ({
      id: i.id,
      categoryId: i.category_id,
      name: i.name,
      description: i.description,
      priceMinor: i.price_minor,
      prepMinutes: i.prep_minutes,
      tags: i.tags ?? [],
      imagePath: i.image_path,
      imageUrl: publicAssetUrl(i.image_path),
      sortOrder: i.sort_order,
      active: i.active,
      available: i.availability === "available",
      modifierGroupIds: groupsByItem.get(i.id) ?? [],
    }))
    .sort(byPosition);

  const optionList: EditableOption[] = ((options.data ?? []) as OptionRow[])
    .map((o) => ({
      id: o.id,
      groupId: o.modifier_group_id,
      name: o.name,
      priceDeltaMinor: o.price_delta_minor,
      active: o.active,
      sortOrder: o.sort_order,
    }))
    .sort(byPosition);

  const groupList: EditableModifierGroup[] = ((groups.data ?? []) as GroupRow[])
    .map((g) => ({
      id: g.id,
      name: g.name,
      required: g.required,
      minSelect: g.min_select,
      maxSelect: g.max_select,
      sortOrder: g.sort_order,
      options: optionList.filter((o) => o.groupId === g.id),
      itemIds: itemsByGroup.get(g.id) ?? [],
    }))
    .sort(byPosition);

  return {
    restaurantId,
    categories: categoryList,
    items: itemList,
    modifierGroups: groupList,
  };
}
