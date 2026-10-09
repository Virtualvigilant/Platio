import { describe, expect, it } from "vitest";
import { MoneyError, formatKES, multiplyMinor, parseKES, sumMinor } from "./money";

describe("formatKES", () => {
  it("shows whole shillings without cents", () => {
    expect(formatKES(35000)).toBe("KES 350");
    expect(formatKES(0)).toBe("KES 0");
  });

  it("groups thousands and keeps two-digit cents", () => {
    expect(formatKES(125000)).toBe("KES 1,250");
    expect(formatKES(35050)).toBe("KES 350.50");
    expect(formatKES(35005)).toBe("KES 350.05");
    expect(formatKES(123456789)).toBe("KES 1,234,567.89");
  });

  it("marks refunds and other negative amounts", () => {
    expect(formatKES(-5000)).toBe("−KES 50");
  });

  it("refuses fractional cents", () => {
    expect(() => formatKES(10.5)).toThrow(MoneyError);
  });
});

describe("arithmetic", () => {
  it("sums and multiplies integer cents", () => {
    expect(sumMinor([35000, 3000, 22000])).toBe(60000);
    expect(multiplyMinor(2200, 3)).toBe(6600);
  });

  it("rejects negative or fractional quantities", () => {
    expect(() => multiplyMinor(2200, -1)).toThrow(MoneyError);
    expect(() => multiplyMinor(2200, 1.5)).toThrow(MoneyError);
  });
});

describe("parseKES", () => {
  it.each([
    ["350", 35000],
    ["350.5", 35050],
    ["350.50", 35050],
    ["1,250.00", 125000],
    ["KES 99", 9900],
    [" 0 ", 0],
  ])("parses %j", (input, expected) => {
    expect(parseKES(input)).toBe(expected);
  });

  it.each(["", "-5", "3.505", "abc", "1e3", "12.", ".5"])("rejects %j", (input) => {
    expect(parseKES(input)).toBeNull();
  });
});
