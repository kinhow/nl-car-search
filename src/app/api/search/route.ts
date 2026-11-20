import { z } from "zod";
import { runSearch } from "@/lib/run-search";
import { ParsedQuerySchema } from "@/lib/types";

const Body = z.object({
  query: z.string().trim().min(1).max(300),
  filters: ParsedQuerySchema.pick({
    make: true, model: true, body: true, transmission: true, fuel: true,
    price_min: true, price_max: true, year_min: true, year_max: true,
    mileage_max: true, seats_min: true, states: true,
  }).optional(),
  semanticQuery: z.string().max(200).nullable().optional(),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Send { query: string } (max 300 characters)." }, { status: 400 });
  try {
    return Response.json(await runSearch(body.data));
  } catch (err) {
    console.error("search failed", err);
    return Response.json({ error: "Search failed. Please try again." }, { status: 500 });
  }
}
