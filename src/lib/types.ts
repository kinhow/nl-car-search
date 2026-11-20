import { z } from "zod";
import {
  BODY_TYPES,
  FUELS,
  MAKES,
  MODELS,
  STATES,
  TRANSMISSIONS,
  type BodyType,
  type Fuel,
  type State,
  type Trait,
  type Transmission,
} from "@/data/catalog";

export interface Listing {
  id: string;
  title: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  transmission: Transmission;
  fuel: Fuel;
  body: BodyType;
  seats: number;
  cc: number;
  colour: string;
  state: State;
  area: string;
  description: string;
  /** Hidden ground truth for the retrieval eval. Never shown to the model. */
  traits: Trait[];
}

/** What the LLM returns for a search query. Every field is nullable so the
 *  model can say "not mentioned" instead of guessing. */
export const ParsedQuerySchema = z.object({
  make: z.enum(MAKES).nullable(),
  model: z.enum(MODELS).nullable(),
  body: z.enum(BODY_TYPES).nullable(),
  transmission: z.enum(TRANSMISSIONS).nullable(),
  fuel: z.enum(FUELS).nullable(),
  price_min: z.number().nullable(),
  price_max: z.number().nullable(),
  year_min: z.number().nullable(),
  year_max: z.number().nullable(),
  mileage_max: z.number().nullable(),
  seats_min: z.number().nullable(),
  states: z.array(z.enum(STATES)),
  /** Soft preferences that filters can't express, rewritten in English. */
  semantic_query: z.string().nullable(),
  needs_clarification: z.boolean(),
  clarifying_question: z.string().nullable(),
  /** Things the user asked for that this marketplace doesn't have. */
  unsupported: z.array(z.string()),
});
export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;

export const FILTER_KEYS = [
  "make",
  "model",
  "body",
  "transmission",
  "fuel",
  "price_min",
  "price_max",
  "year_min",
  "year_max",
  "mileage_max",
  "seats_min",
  "states",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Pick<ParsedQuery, FilterKey>;

export const EMPTY_FILTERS: Filters = {
  make: null,
  model: null,
  body: null,
  transmission: null,
  fuel: null,
  price_min: null,
  price_max: null,
  year_min: null,
  year_max: null,
  mileage_max: null,
  seats_min: null,
  states: [],
};

export type ListingCard = Omit<Listing, "traits">;

export interface SearchResponse {
  query: string;
  mode: "llm" | "keyword-fallback";
  filters: Filters;
  semanticQuery: string | null;
  clarifyingQuestion: string | null;
  unsupported: string[];
  notes: string[];
  total: number;
  results: (ListingCard & { score?: number })[];
  timingMs: { parse: number; search: number };
}
