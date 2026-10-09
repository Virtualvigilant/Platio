import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checked, dbErrorMessage, formValues, fromValidation, text } from "./actions";

describe("form helpers", () => {
  it("read text, checkboxes and values, skipping files and action ids", () => {
    const fd = new FormData();
    fd.set("name", "Pilau");
    fd.set("vegetarian", "on");
    fd.set("$ACTION_ID_abc", "");
    fd.set("logo", new Blob(["x"]), "logo.png");
    expect(text(fd, "name")).toBe("Pilau");
    expect(text(fd, "missing")).toBe("");
    expect(checked(fd, "vegetarian")).toBe(true);
    expect(checked(fd, "missing")).toBe(false);
    expect(formValues(fd)).toEqual({ name: "Pilau", vegetarian: "on" });
  });

  it("turn validation errors into field errors", () => {
    const r = z
      .object({ name: z.string().min(1, { error: "Enter the dish name." }) })
      .safeParse({ name: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(fromValidation(r.error)).toMatchObject({
        status: "error",
        fieldErrors: { name: "Enter the dish name." },
      });
    }
  });
});

describe("dbErrorMessage", () => {
  it("passes through our own messages and hides raw database wording", () => {
    expect(dbErrorMessage({ code: "22023", message: "Give a reason for the audit log" })).toBe(
      "Give a reason for the audit log.",
    );
    expect(
      dbErrorMessage({
        code: "42501",
        message: "new row violates row-level security policy for table x",
      }),
    ).toBe("You don’t have permission to do that.");
    expect(dbErrorMessage({ code: "42501", message: "Your role can’t change: display_name" })).toBe(
      "Your role can’t change: display_name.",
    );
    expect(
      dbErrorMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "restaurants_slug_key"',
      }),
    ).toBe("That already exists. Use a different value.");
    expect(dbErrorMessage({ code: "XX000", message: "internal" })).toBe(
      "We couldn’t save that. Try again.",
    );
  });
});
