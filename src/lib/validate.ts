import { CATALOG, findModel } from "@/data/catalog";
import { EMPTY_FILTERS, type Filters, type ParsedQuery } from "./types";

const THIS_YEAR = 2026;

/** Guardrails between the LLM and the search index. Structured output already
 *  guarantees the shape and enum values; this checks they make sense together. */
export function sanitize(parsed: ParsedQuery): { filters: Filters; notes: string[] } {
  const notes: string[] = [];
  const f: Filters = { ...EMPTY_FILTERS, ...pickFilters(parsed) };

  // A model implies its make; a make/model pair that doesn't exist is dropped.
  if (f.model) {
    const entry = CATALOG.find((c) => c.model === f.model);
    if (entry && !f.make) f.make = entry.make;
    if (f.make && !findModel(f.make, f.model)) {
      notes.push(`"${f.make} ${f.model}" isn't a real combination, so the model filter was dropped.`);
      f.model = null;
    }
  }

  // Swap reversed ranges instead of returning nothing.
  if (f.price_min != null && f.price_max != null && f.price_min > f.price_max) {
    [f.price_min, f.price_max] = [f.price_max, f.price_min];
    notes.push("Price range was reversed, so it was swapped.");
  }
  if (f.year_min != null && f.year_max != null && f.year_min > f.year_max) {
    [f.year_min, f.year_max] = [f.year_max, f.year_min];
    notes.push("Year range was reversed, so it was swapped.");
  }

  // Out-of-range numbers are almost always a units mistake (e.g. "80" meaning RM80k).
  for (const k of ["price_min", "price_max"] as const) {
    const v = f[k];
    if (v != null && v > 0 && v < 1000) {
      f[k] = v * 1000;
      notes.push(`Read ${k === "price_min" ? "minimum" : "maximum"} price RM${v} as RM${v}k.`);
    }
  }
  for (const k of ["year_min", "year_max"] as const) {
    const v = f[k];
    if (v != null && (v < 1990 || v > THIS_YEAR)) {
      f[k] = null;
      notes.push(`Ignored year ${v}, which is outside 1990–${THIS_YEAR}.`);
    }
  }
  if (f.mileage_max != null && f.mileage_max <= 0) f.mileage_max = null;
  if (f.seats_min != null && (f.seats_min < 2 || f.seats_min > 9)) f.seats_min = null;

  return { filters: f, notes };
}

function pickFilters(p: ParsedQuery): Filters {
  const { make, model, body, transmission, fuel, price_min, price_max, year_min, year_max, mileage_max, seats_min, states } = p;
  return { make, model, body, transmission, fuel, price_min, price_max, year_min, year_max, mileage_max, seats_min, states };
}

export function hasAnyFilter(f: Filters) {
  return Object.entries(f).some(([, v]) => (Array.isArray(v) ? v.length > 0 : v != null));
}
