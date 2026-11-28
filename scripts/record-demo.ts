// Records real Claude results for the example searches, for demo mode.
// Run once with credits: npm run demo:record (needs ANTHROPIC_API_KEY).
import { writeFileSync } from "node:fs";
import { demoKey } from "../src/lib/demo";
import { EXAMPLES } from "../src/lib/examples";
import { parseQuery } from "../src/lib/parse-query";
import type { ParsedQuery } from "../src/lib/types";

const out: Record<string, ParsedQuery> = {};
for (const q of EXAMPLES) {
  out[demoKey(q)] = await parseQuery(q);
  console.log("saved", q);
}
writeFileSync("src/data/demo-searches.json", JSON.stringify(out, null, 2) + "\n");
