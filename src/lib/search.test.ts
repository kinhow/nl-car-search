import { describe, expect, it } from "vitest";
import { LISTINGS, applyFilters, keywordFilters } from "./search";
import { EMPTY_FILTERS, type ParsedQuery } from "./types";
import { sanitize } from "./validate";

const parsed = (over: Partial<ParsedQuery>): ParsedQuery => ({
  ...EMPTY_FILTERS,
  semantic_query: null,
  needs_clarification: false,
  clarifying_question: null,
  unsupported: [],
  ...over,
});

describe("sanitize", () => {
  it("fills the make from the model", () => {
    expect(sanitize(parsed({ model: "Myvi" })).filters.make).toBe("Perodua");
  });

  it("drops a model that doesn't belong to the make", () => {
    const { filters, notes } = sanitize(parsed({ make: "Honda", model: "Myvi" }));
    expect(filters.model).toBeNull();
    expect(filters.make).toBe("Honda");
    expect(notes[0]).toMatch(/isn't a real combination/);
  });

  it("swaps reversed price ranges", () => {
    const { filters } = sanitize(parsed({ price_min: 80000, price_max: 50000 }));
    expect([filters.price_min, filters.price_max]).toEqual([50000, 80000]);
  });

  it("reads small prices as thousands", () => {
    expect(sanitize(parsed({ price_max: 80 })).filters.price_max).toBe(80000);
  });

  it("ignores impossible years", () => {
    expect(sanitize(parsed({ year_min: 2035 })).filters.year_min).toBeNull();
  });
});

describe("applyFilters", () => {
  it("respects every bound", () => {
    const f = { ...EMPTY_FILTERS, make: "Honda", price_max: 80000, year_min: 2018, states: ["Selangor" as const] };
    const out = applyFilters(LISTINGS, f);
    expect(out.length).toBeGreaterThan(0);
    for (const l of out) {
      expect(l.make).toBe("Honda");
      expect(l.price).toBeLessThanOrEqual(80000);
      expect(l.year).toBeGreaterThanOrEqual(2018);
      expect(l.state).toBe("Selangor");
    }
  });

  it("returns everything with no filters", () => {
    expect(applyFilters(LISTINGS, EMPTY_FILTERS)).toHaveLength(LISTINGS.length);
  });
});

describe("keywordFilters (fallback)", () => {
  it("catches model, state and budget", () => {
    const f = keywordFilters("auto myvi bawah 40k selangor");
    expect(f).toMatchObject({ make: "Perodua", model: "Myvi", transmission: "auto", price_max: 40000, states: ["Selangor"] });
  });

  it("handles hyphenated models written without the hyphen", () => {
    expect(keywordFilters("honda crv").model).toBe("CR-V");
  });
});
