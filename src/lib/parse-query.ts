import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CATALOG, STATES } from "@/data/catalog";
import { ParsedQuerySchema, type ParsedQuery } from "./types";

export const PARSE_MODEL = "claude-haiku-5-5";

const catalogLines = CATALOG.map((c) => `${c.make} ${c.model} (${c.body}, ${c.seats} seats, ${c.fuel})`).join("\n");

// Stable across requests, so it can be cached.
const SYSTEM = `You turn a used-car search query from a Malaysian marketplace into search filters.
Queries mix English, Malay and Manglish. Return only what the user actually asked for: leave a field null (or states empty) when they didn't mention it. Never invent a filter to be helpful.

Cars on this marketplace:
${catalogLines}

States: ${STATES.join(", ")}.

How to read queries:
- Prices are Malaysian ringgit. "80k", "RM80k", "80 ribu" = 80000. "bawah", "below", "under", "max", "budget" = price_max. "atas", "above", "at least" = price_min. "around 50k" = price_min 45000 and price_max 55000.
- "auto", "AT", "automatik" = transmission auto. "manual", "MT" = manual.
- "after 2018", "2018 and above", "2018 onwards" = year_min 2018. "below 2018", "before 2018" = year_max 2017. "recent", "new-ish", "latest" = year_min 2023.
- "low mileage" = mileage_max 60000. "under 100k km" = mileage_max 100000. A number with "km" is mileage, never price.
- "7 seater", "MPV for big family" = seats_min 7.
- "EV", "electric" = fuel ev. "hybrid" = fuel hybrid. "diesel" = fuel diesel.
- "SUV", "MPV", "sedan", "hatchback", "pickup"/"4x4 truck" = body type.
- A model name implies its make. Malay spellings and nicknames count: "kancil-style small car" is a soft preference, not a model.
- Places map to their state: PJ, Petaling Jaya, Shah Alam, Subang, Klang, Puchong, Cyberjaya -> Selangor. KL, Cheras, Kepong, Bangsar -> Kuala Lumpur. JB, Johor Bahru -> Johor. Penang, Pulau Pinang, Butterworth -> Penang. Ipoh -> Perak. Seremban -> Negeri Sembilan. "Klang Valley" -> Selangor and Kuala Lumpur. "kat", "di", "near", "area" introduce a place.
- Preferences that filters can't express go in semantic_query, rewritten as a short English phrase: what the car is for or what it should feel like ("good for e-hailing", "first car for a new driver", "big boot for a stroller", "comfortable for long highway drives", "cheap to maintain"). Don't repeat hard filters there. Leave it null if there are none.
- Set needs_clarification true only when the query is too vague to search at all (for example "cheap car" or "best car?") with no make, model, body, budget or use. Then ask one short question in clarifying_question, in the same language the user wrote in. Otherwise clarifying_question is null.
- If they ask for something this marketplace doesn't have (a make or model not in the list, motorcycles, rentals), put it in unsupported and don't map it to a different car.`;

let _client: Anthropic | null = null;
const client = () => (_client ??= new Anthropic());

export class ParseError extends Error {
  constructor(
    message: string,
    readonly reason: "refusal" | "unparsable" | "api" | "rate_limit" | "auth" | "network",
  ) {
    super(message);
  }
}

export async function parseQuery(query: string): Promise<ParsedQuery> {
  return (await parseQueryDetailed(query)).output;
}

/** Same as parseQuery, plus token usage for the eval's cost report. */
export async function parseQueryDetailed(query: string): Promise<{ output: ParsedQuery; usage: Anthropic.Usage }> {
  let response;
  try {
    response = await client().messages.parse({
      model: PARSE_MODEL,
      max_tokens: 2000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: query }],
      output_config: { effort: "low", format: zodOutputFormat(ParsedQuerySchema) },
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new ParseError("Anthropic API key is missing or invalid.", "auth");
    if (err instanceof Anthropic.RateLimitError) throw new ParseError("Rate limited by the Anthropic API.", "rate_limit");
    if (err instanceof Anthropic.APIConnectionError) throw new ParseError("Couldn't reach the Anthropic API.", "network");
    if (err instanceof Anthropic.APIError) throw new ParseError(`Anthropic API error ${err.status}: ${err.message}`, "api");
    throw err;
  }

  if (response.stop_reason === "refusal") throw new ParseError("The model declined this query.", "refusal");
  if (!response.parsed_output) throw new ParseError(`No parsable output (stop_reason: ${response.stop_reason}).`, "unparsable");
  return { output: response.parsed_output, usage: response.usage };
}
