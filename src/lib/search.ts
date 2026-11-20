import listingsJson from "@/data/listings.json";
import { CATALOG, STATES } from "@/data/catalog";
import { EMPTY_FILTERS, type Filters, type Listing, type ListingCard } from "./types";

export const LISTINGS = listingsJson as Listing[];
export const LISTING_BY_ID = new Map(LISTINGS.map((l) => [l.id, l]));

export function applyFilters(listings: Listing[], f: Filters): Listing[] {
  return listings.filter(
    (l) =>
      (f.make == null || l.make === f.make) &&
      (f.model == null || l.model === f.model) &&
      (f.body == null || l.body === f.body) &&
      (f.transmission == null || l.transmission === f.transmission) &&
      (f.fuel == null || l.fuel === f.fuel) &&
      (f.price_min == null || l.price >= f.price_min) &&
      (f.price_max == null || l.price <= f.price_max) &&
      (f.year_min == null || l.year >= f.year_min) &&
      (f.year_max == null || l.year <= f.year_max) &&
      (f.mileage_max == null || l.mileage <= f.mileage_max) &&
      (f.seats_min == null || l.seats >= f.seats_min) &&
      (f.states.length === 0 || f.states.includes(l.state)),
  );
}

/** Default order when there's no semantic ranking: newest first, then cheapest. */
export function defaultSort(a: Listing, b: Listing) {
  return b.year - a.year || a.price - b.price;
}

export function toCard({ traits: _hidden, ...card }: Listing): ListingCard {
  return card;
}

// ── Keyword fallback ──────────────────────────────────────────────────────────
// Used when the LLM is unavailable or returns something unusable. Deliberately
// simple: it only catches makes, models, states and "under RM Nk".

const lower = (s: string) => s.toLowerCase();

export function keywordFilters(query: string): Filters {
  const q = ` ${lower(query)} `;
  const f: Filters = { ...EMPTY_FILTERS, states: [] };
  for (const c of CATALOG) {
    if (q.includes(` ${lower(c.model)} `) || q.includes(` ${lower(c.model).replace(/[- ]/g, "")} `)) {
      f.make = c.make;
      f.model = c.model;
      break;
    }
    if (q.includes(` ${lower(c.make)} `)) f.make = c.make;
  }
  for (const s of STATES) if (q.includes(lower(s))) f.states.push(s);
  if (/\bauto(matic)?\b/.test(q)) f.transmission = "auto";
  if (/\bmanual\b/.test(q)) f.transmission = "manual";
  const under = q.match(/(?:under|below|bawah|<)\s*(?:rm\s*)?(\d+(?:\.\d+)?)\s*(k)?/);
  if (under) f.price_max = Math.round(Number(under[1]) * (under[2] || Number(under[1]) < 1000 ? 1000 : 1));
  return f;
}
