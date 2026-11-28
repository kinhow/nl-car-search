import { describe, expect, it } from "vitest";
import { fastPath } from "./fast-path";
import { clearCache, getCached, setCached } from "./query-cache";
import { EMPTY_FILTERS, type ParsedQuery } from "./types";

describe("fastPath", () => {
  it("reads a simple Manglish query", () => {
    expect(fastPath("Myvi kat Cheras bawah 45k")).toEqual({
      ...EMPTY_FILTERS, make: "Perodua", model: "Myvi", states: ["Kuala Lumpur"], price_max: 45000,
    });
  });

  it("reads years and RM amounts with commas", () => {
    const f = fastPath("hatchback auto, budget RM35,000, 2019 and above");
    expect(f).toMatchObject({ body: "hatchback", transmission: "auto", price_max: 35000, year_min: 2019 });
  });

  it.each([
    "good for Grab driving in KL", // a preference
    "cheap car", // too vague: needs a clarifying question
    "Myvi 80", // a bare number: RM80k or 80,000 km?
    "Proton Saga under 100k km", // mileage, not price
    "Honda Myvi", // a pair that doesn't exist
    "Kia Seltos", // not on this marketplace
    "Mazda CX-5 low mileage", // "low mileage" needs the LLM's rule
    "car",
  ])("leaves %j to the LLM", (q) => {
    expect(fastPath(q)).toBeNull();
  });
});

describe("query cache", () => {
  it("matches a query with other case and spaces", () => {
    clearCache();
    const p = { ...EMPTY_FILTERS, semantic_query: null, needs_clarification: false, clarifying_question: null, unsupported: [] } as ParsedQuery;
    setCached("Good for Grab", p);
    expect(getCached("  good  for GRAB ")).toBe(p);
    expect(getCached("good for taxi")).toBeNull();
  });
});
