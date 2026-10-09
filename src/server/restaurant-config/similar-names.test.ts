import { describe, expect, it } from "vitest";
import { findSimilarRestaurants, mainWords, normalizeName } from "./similar-names";

const existing = [
  { id: "1", displayName: "Mama Oliech Kitchen", slug: "mama-oliech-kitchen" },
  { id: "2", displayName: "Java House", slug: "java-house-gate-b" },
  { id: "3", displayName: "The Cafe", slug: "the-cafe" },
  { id: "4", displayName: "Mama Rocks", slug: "mama-rocks" },
  { id: "5", displayName: "Kilimanjaro Grill", slug: "kili-grill" },
];

const ids = (name: string, slug: string) =>
  findSimilarRestaurants(name, slug, existing).map((r) => r.id);

describe("similar restaurant names", () => {
  it("normalizes case, accents, punctuation and ampersands", () => {
    expect(normalizeName("  Mama Oliech’s Kitchen & Café ")).toBe("mama oliech s kitchen and cafe");
  });

  it("keeps the words that identify the business", () => {
    expect(mainWords("Mama Oliech Kitchen")).toEqual(["mama", "oliech"]);
    expect(mainWords("The Cafe")).toEqual(["the", "cafe"]);
    expect(mainWords("A")).toEqual([]);
  });

  it("warns about exact and near-duplicate names", () => {
    expect(ids("mama oliech kitchen", "mama-oliech")).toEqual(["1"]);
    expect(ids("Mama Oliech", "mama-oliech")).toEqual(["1"]);
    expect(ids("Mama Oliech's Restaurant", "mama-oliechs")).toEqual(["1"]);
    expect(ids("Java", "java")).toEqual(["2"]);
    expect(ids("The Cafe", "the-cafe-2")).toEqual(["3"]);
  });

  it("warns when the web address is the same", () => {
    expect(ids("Something Else", "kili-grill")).toEqual(["5"]);
  });

  it("matches words in the existing web address", () => {
    expect(ids("Gate B Java", "gate-b-java")).toEqual(["2"]);
  });

  it("doesn't warn about names that only share a word", () => {
    expect(ids("Mama Njeri Foods", "mama-njeri-foods")).toEqual([]);
    expect(ids("Campus Grill", "campus-grill")).toEqual([]);
  });
});
