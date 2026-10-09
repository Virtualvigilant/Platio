import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it.each(["/restaurant", "/orders/1042?tab=receipt", "/account#orders"])("keeps %j", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example/",
    "//evil.example/path",
    "/\\evil.example",
    "javascript:alert(1)",
    "restaurant",
    "/\u0000x",
    "",
    null,
    undefined,
  ])("falls back for %j", (path) => {
    expect(safeNextPath(path as string | null | undefined)).toBe("/");
  });
});
