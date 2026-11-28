import { isDemo, savedSearch } from "./demo";
import { warmEmbeddings } from "./embeddings";
import { fastPath } from "./fast-path";
import { ParseError, parseQueryDetailed } from "./parse-query";
import { getCached, setCached } from "./query-cache";
import { LISTINGS, applyFilters, defaultSort, keywordFilters, toCard } from "./search";
import { EMPTY_FILTERS, type Filters, type ParsedQuery, type SearchResponse } from "./types";
import { sanitize } from "./validate";
import { rankBySimilarity } from "./vector-index";

const PAGE = 24;

/** The whole pipeline: query → filters (cache, fast path or LLM) → guardrails → hard filters → semantic rank.
 *  Pass `filters` to skip reading the query (the user edited the chips by hand). */
export async function runSearch(input: { query: string; filters?: Filters; semanticQuery?: string | null }): Promise<SearchResponse> {
  const t0 = performance.now();
  let mode: SearchResponse["mode"] = "llm";
  let filters: Filters;
  let semanticQuery: string | null = input.semanticQuery ?? null;
  let clarifyingQuestion: string | null = null;
  let unsupported: string[] = [];
  let llmTiming: { firstToken: number; output: number } | null = null;
  const notes: string[] = [];

  const demo = isDemo();
  // The cold load of the embedding model takes about 2 s. Overlap it with the LLM call.
  if (!input.filters) warmEmbeddings();
  const applyParsed = (parsed: ParsedQuery) => {
    const clean = sanitize(parsed);
    notes.push(...clean.notes);
    semanticQuery = parsed.semantic_query;
    clarifyingQuestion = parsed.needs_clarification ? parsed.clarifying_question : null;
    unsupported = parsed.unsupported;
    return clean.filters;
  };

  const cached = input.filters ? null : getCached(input.query);
  const saved = input.filters || cached || !demo ? null : savedSearch(input.query);
  const fast = input.filters || cached || saved ? null : fastPath(input.query);

  if (input.filters) {
    mode = "edited";
    filters = { ...EMPTY_FILTERS, ...input.filters };
  } else if (cached) {
    mode = "cached";
    filters = applyParsed(cached);
  } else if (saved) {
    mode = "demo-saved";
    filters = applyParsed(saved);
  } else if (fast) {
    mode = "fast-path";
    filters = fast;
    semanticQuery = null;
  } else if (demo) {
    mode = "keyword-fallback";
    filters = keywordFilters(input.query);
    notes.push("Demo mode: the AI search is off, so basic keyword matching was used. Pick an example search to see a saved Claude result.");
  } else {
    try {
      const { output, timing } = await parseQueryDetailed(input.query);
      llmTiming = { firstToken: timing.firstTokenMs, output: timing.outputMs };
      setCached(input.query, output);
      filters = applyParsed(output);
    } catch (err) {
      if (!(err instanceof ParseError)) throw err;
      mode = "keyword-fallback";
      filters = keywordFilters(input.query);
      notes.push(`Smart search is unavailable (${err.message}), so basic keyword matching was used.`);
    }
  }
  const t1 = performance.now();
  const timing = (t2: number) => ({ parse: ms(t1 - t0), rank: ms(t2 - t1), total: ms(t2 - t0), ...llmTiming });

  if (clarifyingQuestion) {
    return { query: input.query, mode, demo, filters, semanticQuery, clarifyingQuestion, unsupported, notes, total: 0, results: [], timingMs: timing(t1) };
  }

  const matches = applyFilters(LISTINGS, filters);
  let results: SearchResponse["results"];
  if (semanticQuery && matches.length > 0) {
    try {
      const ranked = await rankBySimilarity(matches, semanticQuery);
      results = ranked.slice(0, PAGE).map((r) => ({ ...toCard(r.listing), score: Number(r.score.toFixed(3)) }));
    } catch (err) {
      notes.push(`Couldn't rank by "${semanticQuery}" (${(err as Error).message}), so results are sorted by year.`);
      results = [...matches].sort(defaultSort).slice(0, PAGE).map(toCard);
    }
  } else {
    results = [...matches].sort(defaultSort).slice(0, PAGE).map(toCard);
  }

  return {
    query: input.query,
    mode,
    demo,
    filters,
    semanticQuery,
    clarifyingQuestion,
    unsupported,
    notes,
    total: matches.length,
    results,
    timingMs: timing(performance.now()),
  };
}

const ms = (n: number) => Math.round(n);
