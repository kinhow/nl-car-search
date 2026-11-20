// Eval runner. Usage: npm run eval [-- parse|retrieval|ask]
// Writes evals/results/<suite>.json and evals/results/summary.md; exits 1 if a suite is below its threshold.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseQueryDetailed, PARSE_MODEL } from "../src/lib/parse-query";
import { askAboutListing } from "../src/lib/ask";
import { LISTINGS, applyFilters } from "../src/lib/search";
import { rankBySimilarity } from "../src/lib/vector-index";
import { sanitize } from "../src/lib/validate";
import { EMPTY_FILTERS, FILTER_KEYS, type FilterKey, type Filters, type Listing } from "../src/lib/types";

const THRESHOLDS = { parseExact: 0.85, parseField: 0.97, retrievalP10: 0.6, ask: 0.85 };
// Haiku 5.5, USD per token (cache writes at 1.25×, reads at 0.1× input).
const PRICE = { in: 0.1e-6, out: 0.5e-6, cacheWrite: 0.125e-6, cacheRead: 0.01e-6 };

const read = <T>(f: string): T => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8"));
mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
const write = (f: string, data: unknown) => writeFileSync(new URL(`./results/${f}`, import.meta.url), typeof data === "string" ? data : JSON.stringify(data, null, 2));

async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const quantile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))];

// ── Parse: query → filters ───────────────────────────────────────────────────
type Flag = boolean | "optional";
interface ParseCase {
  q: string;
  expect: Partial<Filters>;
  anyOf?: Partial<Filters>[];
  semantic?: Flag;
  clarify?: Flag;
  unsupported?: Flag;
  tolerance?: number;
  seatsOptional?: boolean;
  makeOptional?: boolean;
  statesOptional?: boolean;
  priceOptional?: boolean;
  tags: string[];
}

function fieldEqual(key: FilterKey, want: unknown, got: unknown, tol = 0) {
  if (key === "states") return JSON.stringify([...(want as string[])].sort()) === JSON.stringify([...(got as string[])].sort());
  if (typeof want === "number" && typeof got === "number") return Math.abs(want - got) <= Math.abs(want) * tol;
  return want === got;
}

function gradeParse(c: ParseCase, got: Filters, flags: { semantic: boolean; clarify: boolean; unsupported: boolean }) {
  const skip = new Set<FilterKey>([
    ...(c.seatsOptional ? (["seats_min"] as const) : []),
    ...(c.makeOptional ? (["make"] as const) : []),
    ...(c.statesOptional ? (["states"] as const) : []),
    ...(c.priceOptional ? (["price_min", "price_max"] as const) : []),
  ]);
  const variants = (c.anyOf ?? [{}]).map((alt) => ({ ...EMPTY_FILTERS, ...c.expect, ...alt }));
  // Score against the closest acceptable answer.
  const scored = variants.map((want) => {
    const fields = FILTER_KEYS.filter((k) => !skip.has(k)).map((k) => ({
      key: k,
      want: want[k],
      got: got[k],
      ok: fieldEqual(k, want[k], got[k], c.tolerance),
      expectedEmpty: want[k] == null || (Array.isArray(want[k]) && (want[k] as unknown[]).length === 0),
    }));
    return { fields, correct: fields.filter((f) => f.ok).length };
  });
  const best = scored.sort((a, b) => b.correct - a.correct)[0];
  const flagOk = (want: Flag | undefined, gotFlag: boolean) => want === "optional" || (want ?? false) === gotFlag;
  const flagResults = {
    semantic: flagOk(c.semantic, flags.semantic),
    clarify: flagOk(c.clarify, flags.clarify),
    unsupported: flagOk(c.unsupported, flags.unsupported),
  };
  return {
    fields: best.fields,
    flags: flagResults,
    exact: best.fields.every((f) => f.ok) && Object.values(flagResults).every(Boolean),
  };
}

async function evalParse() {
  const cases = read<ParseCase[]>("./parse-cases.json");
  const rows = await pool(cases, 6, async (c) => {
    const t = performance.now();
    try {
      const { output, usage } = await parseQueryDetailed(c.q);
      const ms = performance.now() - t;
      const { filters } = sanitize(output);
      const flags = { semantic: output.semantic_query != null, clarify: output.needs_clarification, unsupported: output.unsupported.length > 0 };
      const cost = (usage.input_tokens * PRICE.in) + (usage.output_tokens * PRICE.out) + ((usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) + ((usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead);
      return { case: c, got: filters, raw: output, ms, cost, ...gradeParse(c, filters, flags) };
    } catch (err) {
      return { case: c, error: (err as Error).message, ms: performance.now() - t, cost: 0, fields: [], flags: { semantic: false, clarify: false, unsupported: false }, exact: false };
    }
  });

  const fields = rows.flatMap((r) => r.fields);
  const wrongFilledIn = fields.filter((f) => f.expectedEmpty && !f.ok).length;
  const expectedEmpty = fields.filter((f) => f.expectedEmpty).length;
  const missed = fields.filter((f) => !f.expectedEmpty && !f.ok).length;
  const expectedSet = fields.filter((f) => !f.expectedEmpty).length;
  const tags = [...new Set(cases.flatMap((c) => c.tags))].sort();
  const byTag = tags.map((t) => {
    const rs = rows.filter((r) => r.case.tags.includes(t));
    return { tag: t, n: rs.length, exact: rs.filter((r) => r.exact).length / rs.length };
  });
  const latencies = rows.map((r) => r.ms);
  const summary = {
    model: PARSE_MODEL,
    cases: rows.length,
    errors: rows.filter((r) => "error" in r).length,
    exactMatch: rows.filter((r) => r.exact).length / rows.length,
    fieldAccuracy: fields.filter((f) => f.ok).length / fields.length,
    madeUpFilterRate: wrongFilledIn / expectedEmpty,
    missedFilterRate: missed / expectedSet,
    clarifyAccuracy: rows.filter((r) => r.flags.clarify).length / rows.length,
    semanticAccuracy: rows.filter((r) => r.flags.semantic).length / rows.length,
    unsupportedAccuracy: rows.filter((r) => r.flags.unsupported).length / rows.length,
    p50ms: Math.round(quantile(latencies, 0.5)),
    p95ms: Math.round(quantile(latencies, 0.95)),
    costPer1kQueries: (rows.reduce((a, r) => a + r.cost, 0) / rows.length) * 1000,
    byTag,
  };
  const failures = rows.filter((r) => !r.exact).map((r) => ({
    q: r.case.q,
    error: "error" in r ? r.error : undefined,
    wrongFields: r.fields.filter((f) => !f.ok).map((f) => `${f.key}: want ${JSON.stringify(f.want)}, got ${JSON.stringify(f.got)}`),
    wrongFlags: Object.entries(r.flags).filter(([, ok]) => !ok).map(([k]) => k),
    semantic_query: "raw" in r ? r.raw?.semantic_query : undefined,
  }));
  write("parse.json", { summary, failures });
  const pass = summary.exactMatch >= THRESHOLDS.parseExact && summary.fieldAccuracy >= THRESHOLDS.parseField;
  return { pass, summary, failures };
}

// ── Retrieval: soft preference → ranked listings ─────────────────────────────
interface RetrievalCase { q: string; trait: Listing["traits"][number]; filters?: Partial<Filters> }

async function evalRetrieval() {
  const cases = read<RetrievalCase[]>("./retrieval-cases.json");
  const rows = await pool(cases, 4, async (c) => {
    const pool_ = applyFilters(LISTINGS, { ...EMPTY_FILTERS, ...c.filters });
    const baseRate = pool_.filter((l) => l.traits.includes(c.trait)).length / pool_.length;
    const ranked = await rankBySimilarity(pool_, c.q);
    const top = ranked.slice(0, 10);
    const p10 = top.filter((r) => r.listing.traits.includes(c.trait)).length / top.length;
    return { q: c.q, trait: c.trait, p10, baseRate, top: top.map((r) => `${r.listing.title} [${r.listing.traits.join(",")}]`) };
  });
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const summary = {
    cases: rows.length,
    precisionAt10: mean(rows.map((r) => r.p10)),
    baseRate: mean(rows.map((r) => r.baseRate)),
    lift: mean(rows.map((r) => r.p10)) / mean(rows.map((r) => r.baseRate)),
    worst: [...rows].sort((a, b) => a.p10 - b.p10).slice(0, 3).map((r) => ({ q: r.q, p10: r.p10 })),
  };
  write("retrieval.json", { summary, rows });
  return { pass: summary.precisionAt10 >= THRESHOLDS.retrievalP10, summary };
}

// ── Ask: grounded answers with citations ─────────────────────────────────────
interface AskCase {
  pick: { model: string; descriptionExcludes?: string };
  question: string;
  grounded: boolean;
  mustInclude?: string[];
  mustNotInclude?: string[];
  mustIncludeField?: "mileage" | "colour" | "area" | "price" | "year";
  mustCite?: string[];
  tags: string[];
}

async function evalAsk() {
  const cases = read<AskCase[]>("./ask-cases.json");
  const rows = await pool(cases, 4, async (c) => {
    const listing = LISTINGS.find((l) => l.model === c.pick.model && (!c.pick.descriptionExcludes || !l.description.includes(c.pick.descriptionExcludes)));
    if (!listing) return { question: c.question, pass: false, problems: [`no listing for ${c.pick.model}`] };
    const res = await askAboutListing(listing.id, c.question);
    const problems: string[] = [];
    const answer = res.answer.toLowerCase();
    const digits = res.answer.replace(/[^\d]/g, "");
    if (res.grounded !== c.grounded) problems.push(`grounded ${res.grounded}, want ${c.grounded}`);
    for (const s of c.mustInclude ?? []) if (!answer.includes(s.toLowerCase())) problems.push(`missing "${s}"`);
    for (const s of c.mustNotInclude ?? []) if (answer.includes(s.toLowerCase())) problems.push(`says "${s}"`);
    if (c.mustIncludeField) {
      const v = String(listing[c.mustIncludeField]);
      const ok = /^\d+$/.test(v) ? digits.includes(v) : answer.includes(v.toLowerCase());
      if (!ok) problems.push(`missing ${c.mustIncludeField} "${v}"`);
    }
    const cited = new Set(res.citations.map((x) => x.id));
    for (const id of c.mustCite ?? []) if (!cited.has(id)) problems.push(`didn't cite ${id}`);
    // Was the right guide section retrieved at all? (separates retrieval misses from answer misses)
    const guideNeeded = (c.mustCite ?? []).filter((id) => id.startsWith("guide:"));
    const retrievedOk = guideNeeded.length === 0 || guideNeeded.every((id) => res.retrieved.some((r) => r.id === id));
    return { question: c.question, listing: listing.title, tags: c.tags, pass: problems.length === 0, problems, retrievedOk, answer: res.answer, citations: [...cited] };
  });
  const guideRows = rows.filter((r) => "retrievedOk" in r && cases.find((c) => c.question === r.question)?.mustCite?.some((id) => id.startsWith("guide:")));
  const summary = {
    cases: rows.length,
    passRate: rows.filter((r) => r.pass).length / rows.length,
    answerableCorrect: ratio(rows, cases, true),
    unanswerableCorrect: ratio(rows, cases, false),
    guideRecallAt3: guideRows.filter((r) => "retrievedOk" in r && r.retrievedOk).length / (guideRows.length || 1),
  };
  write("ask.json", { summary, failures: rows.filter((r) => !r.pass) });
  return { pass: summary.passRate >= THRESHOLDS.ask, summary };
}
function ratio(rows: { question: string; pass: boolean }[], cases: AskCase[], grounded: boolean) {
  const rs = rows.filter((r) => cases.find((c) => c.question === r.question)?.grounded === grounded);
  return rs.filter((r) => r.pass).length / (rs.length || 1);
}

// ── Main ─────────────────────────────────────────────────────────────────────
const which = process.argv[2] ?? "all";
const lines = [`# Eval results`, ``, `Model: \`${PARSE_MODEL}\` · run ${new Date().toISOString().slice(0, 10)}`, ``];
let ok = true;

if (which === "all" || which === "parse") {
  const { pass, summary: s, failures } = await evalParse();
  ok &&= pass;
  lines.push(
    `## Query → filters (${s.cases} labelled queries)`, ``,
    `| Metric | Result |`, `|---|---|`,
    `| Exact match (every filter and flag right) | **${pct(s.exactMatch)}** |`,
    `| Field accuracy (${FILTER_KEYS.length} filters × ${s.cases} queries) | **${pct(s.fieldAccuracy)}** |`,
    `| Made-up filters (set when the user didn't ask) | ${pct(s.madeUpFilterRate)} |`,
    `| Missed filters | ${pct(s.missedFilterRate)} |`,
    `| Clarifying-question decision | ${pct(s.clarifyAccuracy)} |`,
    `| Soft-preference detection | ${pct(s.semanticAccuracy)} |`,
    `| "Not on this marketplace" detection | ${pct(s.unsupportedAccuracy)} |`,
    `| Latency p50 / p95 | ${s.p50ms} ms / ${s.p95ms} ms |`,
    `| Cost per 1,000 queries | $${s.costPer1kQueries.toFixed(3)} |`, ``,
    `Exact match by case type: ${s.byTag.map((t) => `${t.tag} ${pct(t.exact)} (${t.n})`).join(" · ")}`, ``,
  );
  console.log("parse", s, failures.slice(0, 15));
}
if (which === "all" || which === "retrieval") {
  const { pass, summary: s } = await evalRetrieval();
  ok &&= pass;
  lines.push(
    `## Soft preference → ranked listings (${s.cases} queries)`, ``,
    `| Metric | Result |`, `|---|---|`,
    `| Precision@10 (top 10 actually match the intent) | **${pct(s.precisionAt10)}** |`,
    `| Random baseline (share of matching cars) | ${pct(s.baseRate)} |`,
    `| Lift over random | ${s.lift.toFixed(1)}× |`, ``,
  );
  console.log("retrieval", s);
}
if (which === "all" || which === "ask") {
  const { pass, summary: s } = await evalAsk();
  ok &&= pass;
  lines.push(
    `## Grounded answers (${s.cases} questions)`, ``,
    `| Metric | Result |`, `|---|---|`,
    `| Pass rate (right answer, right citations) | **${pct(s.passRate)}** |`,
    `| Answerable questions answered correctly | ${pct(s.answerableCorrect)} |`,
    `| Unanswerable questions correctly declined | ${pct(s.unanswerableCorrect)} |`,
    `| Right guide section retrieved (recall@3) | ${pct(s.guideRecallAt3)} |`, ``,
  );
  console.log("ask", s);
}

if (which === "all") write("summary.md", lines.join("\n"));
console.log(ok ? "\nAll suites passed their thresholds." : "\nA suite is below its threshold.");
process.exit(ok ? 0 : 1);
