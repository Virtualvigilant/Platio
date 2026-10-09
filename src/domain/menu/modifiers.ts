/**
 * Dish choices ("modifiers", brief §5.2, §6.3, §10): groups such as Size or Add-ons, each with
 * options that may add to the price. The restaurant sets whether a group is required and how many
 * options a customer may pick. Checkout validates a customer's picks with these rules on the
 * server; the browser may use them to explain a problem early, never to decide the price.
 *
 * Money is integer cents throughout (see ../money).
 */
import { assertMinor, sumMinor } from "../money";

export interface ModifierOption {
  id: string;
  name: string;
  /** Extra cost in cents; 0 for a free choice. */
  priceDeltaMinor: number;
  /** False when the restaurant has stopped offering this option. */
  active: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  /** Groups are active unless said otherwise. */
  active?: boolean;
  options: readonly ModifierOption[];
}

/** One valid pick, with the names and price needed for an order snapshot. */
export interface ChosenModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDeltaMinor: number;
}

export type ModifierSelection =
  | { ok: true; chosen: ChosenModifier[]; extraMinor: number }
  | {
      ok: false;
      /**
       * People-facing messages keyed by group id. "_form" holds problems that belong to no
       * offered group, such as an option that was removed.
       */
      errors: Record<string, string>;
    };

const FORM_KEY = "_form";

const options = (n: number) => (n === 1 ? "one option" : `${n} options`);

/** The fewest picks that satisfy a group once the customer picks anything from it. */
function lowerBound(group: ModifierGroup): number {
  return Math.max(1, group.minSelect);
}

/** The fewest picks a customer must make: 0 for an optional group. */
export function minimumChoices(group: ModifierGroup): number {
  return group.required ? lowerBound(group) : 0;
}

/** "Required · choose 1", "Required · choose 1 to 3", "Optional · up to 2". */
export function describeModifierRule(
  group: Pick<ModifierGroup, "required" | "minSelect" | "maxSelect">,
): string {
  const min = Math.max(1, group.minSelect);
  const max = group.maxSelect;
  if (group.required) {
    return min >= max ? `Required · choose ${max}` : `Required · choose ${min} to ${max}`;
  }
  if (min > 1) return `Optional · ${min} to ${max} if chosen`;
  return `Optional · up to ${max}`;
}

/** What to tell a customer who picked `count` options from `group`, or null when it's fine. */
function countProblem(group: ModifierGroup, count: number): string | null {
  const min = lowerBound(group);
  const max = group.maxSelect;
  if (count === 0) {
    if (!group.required) return null;
    if (min >= max) return `Choose ${options(max)} for ${group.name}.`;
    if (min === 1) return `Choose at least one option for ${group.name}.`;
    return `Choose ${min} to ${max} options for ${group.name}.`;
  }
  if (count < min) return `Choose at least ${options(min)} for ${group.name}.`;
  if (count > max) {
    return max === 1
      ? `Choose only one option for ${group.name}.`
      : `Choose up to ${options(max)} for ${group.name}.`;
  }
  return null;
}

/**
 * Checks a customer's picks for one dish against the groups attached to that dish.
 *
 * - Every picked option must belong to an active group passed in (that is, attached to the dish)
 *   and must itself be active.
 * - Each option may be picked once.
 * - A required group needs at least its minimum (and at least one) pick; an optional group needs
 *   none, but if the customer picks any, at least its minimum.
 * - No group may have more picks than its maximum.
 *
 * Returns the picks in menu order (group order, then option order) with their prices, or one
 * message per problem group.
 */
export function validateModifierSelection(
  groups: readonly ModifierGroup[],
  selectedOptionIds: readonly string[],
): ModifierSelection {
  const errors: Record<string, string> = {};
  const offered = groups.filter((g) => g.active !== false);

  const groupOf = new Map<string, { group: ModifierGroup; option: ModifierOption }>();
  for (const group of offered) {
    for (const option of group.options) groupOf.set(option.id, { group, option });
  }

  const picked = new Set<string>();
  for (const id of selectedOptionIds) {
    const found = groupOf.get(id);
    if (!found) {
      errors[FORM_KEY] =
        "One of your choices is no longer offered. Review the dish’s choices and try again.";
      continue;
    }
    const { group, option } = found;
    if (picked.has(id)) {
      errors[group.id] ??= `Choose ${option.name} only once.`;
      continue;
    }
    picked.add(id);
    if (!option.active) {
      errors[group.id] ??=
        `${option.name} is no longer available. Choose another option for ${group.name}.`;
    }
  }

  const chosen: ChosenModifier[] = [];
  for (const group of offered) {
    const inGroup = group.options.filter((o) => picked.has(o.id));
    const problem = countProblem(group, inGroup.length);
    if (problem) errors[group.id] ??= problem;
    for (const option of inGroup) {
      chosen.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDeltaMinor: assertMinor(option.priceDeltaMinor, "extra cost"),
      });
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, chosen, extraMinor: sumMinor(chosen.map((c) => c.priceDeltaMinor)) };
}

/** The price of one dish with its picks, in cents. */
export function priceWithModifiers(
  unitMinor: number,
  selectedOptions: readonly Pick<ModifierOption, "priceDeltaMinor">[],
): number {
  assertMinor(unitMinor, "unit price");
  return assertMinor(
    unitMinor + sumMinor(selectedOptions.map((o) => o.priceDeltaMinor)),
    "price with choices",
  );
}

/**
 * Setup problems a restaurant should fix, for the menu builder: a group customers can't satisfy
 * because too few of its options are offered.
 */
export function modifierGroupProblems(group: ModifierGroup): string[] {
  const offered = group.options.filter((o) => o.active).length;
  if (offered === 0) {
    return [
      group.required
        ? "No options yet. Customers can’t order dishes that use this group until you add one."
        : "No options yet. Add at least one so customers have something to choose.",
    ];
  }
  const needed = minimumChoices(group);
  if (needed > offered) {
    return [
      `Customers must choose ${options(needed)}, but only ${options(offered)} ${
        offered === 1 ? "is" : "are"
      } offered. Add options or lower the minimum.`,
    ];
  }
  return [];
}
