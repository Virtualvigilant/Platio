import { describe, expect, it } from "vitest";
import { MoneyError } from "../money";
import {
  describeModifierRule,
  minimumChoices,
  modifierGroupProblems,
  priceWithModifiers,
  validateModifierSelection,
  type ModifierGroup,
} from "./modifiers";

const size: ModifierGroup = {
  id: "size",
  name: "Size",
  required: true,
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: "regular", name: "Regular", priceDeltaMinor: 0, active: true },
    { id: "large", name: "Large", priceDeltaMinor: 5000, active: true },
    { id: "family", name: "Family", priceDeltaMinor: 15000, active: false },
  ],
};

const extras: ModifierGroup = {
  id: "extras",
  name: "Extras",
  required: false,
  minSelect: 0,
  maxSelect: 2,
  options: [
    { id: "kachumbari", name: "Extra kachumbari", priceDeltaMinor: 3000, active: true },
    { id: "avocado", name: "Avocado", priceDeltaMinor: 4050, active: true },
    { id: "egg", name: "Boiled egg", priceDeltaMinor: 2500, active: true },
  ],
};

const sides: ModifierGroup = {
  id: "sides",
  name: "Sides",
  required: true,
  minSelect: 2,
  maxSelect: 3,
  options: [
    { id: "chips", name: "Chips", priceDeltaMinor: 0, active: true },
    { id: "rice", name: "Rice", priceDeltaMinor: 0, active: true },
    { id: "ugali", name: "Ugali", priceDeltaMinor: 0, active: true },
    { id: "greens", name: "Sukuma wiki", priceDeltaMinor: 0, active: true },
  ],
};

describe("validateModifierSelection", () => {
  it("accepts valid picks and returns them in menu order with their total", () => {
    const result = validateModifierSelection([size, extras], ["avocado", "large", "kachumbari"]);
    expect(result).toEqual({
      ok: true,
      chosen: [
        {
          groupId: "size",
          groupName: "Size",
          optionId: "large",
          optionName: "Large",
          priceDeltaMinor: 5000,
        },
        {
          groupId: "extras",
          groupName: "Extras",
          optionId: "kachumbari",
          optionName: "Extra kachumbari",
          priceDeltaMinor: 3000,
        },
        {
          groupId: "extras",
          groupName: "Extras",
          optionId: "avocado",
          optionName: "Avocado",
          priceDeltaMinor: 4050,
        },
      ],
      extraMinor: 12050,
    });
  });

  it("allows an optional group to be skipped", () => {
    const result = validateModifierSelection([size, extras], ["regular"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.extraMinor).toBe(0);
  });

  it("accepts a dish with no groups and no picks", () => {
    expect(validateModifierSelection([], [])).toEqual({ ok: true, chosen: [], extraMinor: 0 });
  });

  it("requires a pick from a required group", () => {
    const result = validateModifierSelection([size, extras], ["egg"]);
    expect(result).toEqual({ ok: false, errors: { size: "Choose one option for Size." } });
  });

  it("enforces a required group's minimum", () => {
    expect(validateModifierSelection([sides], [])).toEqual({
      ok: false,
      errors: { sides: "Choose 2 to 3 options for Sides." },
    });
    expect(validateModifierSelection([sides], ["chips"])).toEqual({
      ok: false,
      errors: { sides: "Choose at least 2 options for Sides." },
    });
    expect(validateModifierSelection([sides], ["chips", "rice"]).ok).toBe(true);
  });

  it("treats a required group with a minimum of 0 as needing one pick", () => {
    const loose = { ...size, minSelect: 0, maxSelect: 2 };
    expect(minimumChoices(loose)).toBe(1);
    expect(validateModifierSelection([loose], [])).toEqual({
      ok: false,
      errors: { size: "Choose at least one option for Size." },
    });
  });

  it("enforces an optional group's minimum only when something is picked", () => {
    const pairs = { ...extras, minSelect: 2, maxSelect: 3 };
    expect(validateModifierSelection([pairs], []).ok).toBe(true);
    expect(validateModifierSelection([pairs], ["egg"])).toEqual({
      ok: false,
      errors: { extras: "Choose at least 2 options for Extras." },
    });
  });

  it("refuses more picks than a group allows", () => {
    expect(validateModifierSelection([size], ["regular", "large"])).toEqual({
      ok: false,
      errors: { size: "Choose only one option for Size." },
    });
    expect(validateModifierSelection([extras], ["kachumbari", "avocado", "egg"])).toEqual({
      ok: false,
      errors: { extras: "Choose up to 2 options for Extras." },
    });
  });

  it("refuses an option the restaurant has stopped offering", () => {
    expect(validateModifierSelection([size], ["family"])).toEqual({
      ok: false,
      errors: { size: "Family is no longer available. Choose another option for Size." },
    });
  });

  it("refuses options from groups that aren't attached to the dish or are inactive", () => {
    const message =
      "One of your choices is no longer offered. Review the dish’s choices and try again.";
    expect(validateModifierSelection([size], ["regular", "chips"])).toEqual({
      ok: false,
      errors: { _form: message },
    });
    expect(
      validateModifierSelection([size, { ...extras, active: false }], ["large", "egg"]),
    ).toEqual({ ok: false, errors: { _form: message } });
    expect(validateModifierSelection([size], ["regular", "not-an-option"]).ok).toBe(false);
  });

  it("refuses the same option twice instead of charging for it twice", () => {
    expect(validateModifierSelection([extras], ["egg", "egg"])).toEqual({
      ok: false,
      errors: { extras: "Choose Boiled egg only once." },
    });
  });

  it("reports one message per group, the first problem found", () => {
    const result = validateModifierSelection([size, extras, sides], ["family", "large", "chips"]);
    expect(result).toEqual({
      ok: false,
      errors: {
        size: "Family is no longer available. Choose another option for Size.",
        sides: "Choose at least 2 options for Sides.",
      },
    });
  });

  it("refuses prices that aren't whole cents", () => {
    const broken: ModifierGroup = {
      ...extras,
      options: [{ id: "x", name: "Broken", priceDeltaMinor: 10.5, active: true }],
    };
    expect(() => validateModifierSelection([broken], ["x"])).toThrow(MoneyError);
  });
});

describe("priceWithModifiers", () => {
  it("adds the extra costs to the dish price in cents", () => {
    expect(priceWithModifiers(35000, [])).toBe(35000);
    expect(priceWithModifiers(35000, [{ priceDeltaMinor: 5000 }, { priceDeltaMinor: 4050 }])).toBe(
      44050,
    );
  });

  it("never accepts fractional cents", () => {
    expect(() => priceWithModifiers(350.5, [])).toThrow(MoneyError);
    expect(() => priceWithModifiers(35000, [{ priceDeltaMinor: 0.1 }])).toThrow(MoneyError);
  });
});

describe("describeModifierRule", () => {
  it("summarises the rule in a few words", () => {
    expect(describeModifierRule(size)).toBe("Required · choose 1");
    expect(describeModifierRule(sides)).toBe("Required · choose 2 to 3");
    expect(describeModifierRule({ required: true, minSelect: 2, maxSelect: 2 })).toBe(
      "Required · choose 2",
    );
    expect(describeModifierRule(extras)).toBe("Optional · up to 2");
    expect(describeModifierRule({ required: false, minSelect: 2, maxSelect: 4 })).toBe(
      "Optional · 2 to 4 if chosen",
    );
  });
});

describe("modifierGroupProblems", () => {
  it("is empty for a group customers can satisfy", () => {
    expect(modifierGroupProblems(size)).toEqual([]);
    expect(modifierGroupProblems(sides)).toEqual([]);
  });

  it("flags a group with no options on offer", () => {
    expect(modifierGroupProblems({ ...extras, options: [] })).toEqual([
      "No options yet. Add at least one so customers have something to choose.",
    ]);
    expect(
      modifierGroupProblems({
        ...size,
        options: size.options.map((o) => ({ ...o, active: false })),
      }),
    ).toEqual([
      "No options yet. Customers can’t order dishes that use this group until you add one.",
    ]);
  });

  it("flags a required minimum that the offered options can't meet", () => {
    expect(modifierGroupProblems({ ...sides, options: sides.options.slice(0, 1) })).toEqual([
      "Customers must choose 2 options, but only one option is offered. Add options or lower the minimum.",
    ]);
  });
});
