/**
 * Small display helpers for the menu builder. Prices stay integer cents; these only turn a saved
 * price back into what goes in a text field, which the server parses again with parseKES.
 */

/** 35000 → "350", 35050 → "350.50". */
export function toPriceInput(minor: number): string {
  const whole = Math.floor(minor / 100);
  const cents = minor % 100;
  return cents ? `${whole}.${String(cents).padStart(2, "0")}` : String(whole);
}

/** count(1, "dish", "dishes") → "1 dish"; count(3, "dish", "dishes") → "3 dishes". */
export function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Ids for elements other components move focus to. */
export const ids = {
  top: "menu-top",
  addCategory: "menu-add-category",
  archived: "menu-archived",
  choices: "menu-choices",
  categoryHeading: (id: string) => `category-${id}-heading`,
  itemEdit: (id: string) => `item-${id}-edit`,
  groupHeading: (id: string) => `group-${id}-heading`,
};
