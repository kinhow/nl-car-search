import { z } from "zod";
import { askAboutListing } from "@/lib/ask";
import { LISTING_BY_ID } from "@/lib/search";

const Body = z.object({
  listingId: z.string().refine((id) => LISTING_BY_ID.has(id), "Unknown listing"),
  question: z.string().trim().min(2).max(300),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Send { listingId, question }." }, { status: 400 });
  try {
    return Response.json(await askAboutListing(body.data.listingId, body.data.question));
  } catch (err) {
    console.error("ask failed", err);
    return Response.json({ error: "Couldn't answer right now. Please try again." }, { status: 500 });
  }
}
