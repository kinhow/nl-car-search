import { isDemo, savedSearch } from "./demo";
import { ParseError, parseQuery } from "./parse-query";
import { LISTINGS, applyFilters, defaultSort, keywordFilters, toCard } from "./search";
import { EMPTY_FILTERS, type Filters, type ParsedQuery, type SearchResponse } from "./types";
import { sanitize } from "./validate";
import { rankBySimilarity } from "./vector-index";

const PAGE = 24;

/** The whole pipeline: query → LLM filters → guardrails → hard filters → semantic rank.
 *  Pass `filters` to skip the LLM (the user edited the chips by hand). */
export async function runSearch(input: { query: string; filters?: Filters; semanticQuery?: string | null }): Promise<SearchResponse> {
  const t0 = performance.now();
  let mode: SearchResponse["mode"] = "llm";
  let filters: Filters;
  let semanticQuery: string | null = input.semanticQuery ?? null;
  let clarifyingQuestion: string | null = null;
  let unsupported: string[] = [];
  const notes: string[] = [];

  const demo = isDemo();
  const applyParsed = (parsed: ParsedQuery) => {
    const clean = sanitize(parsed);
    notes.push(...clean.notes);
    semanticQuery = parsed.semantic_query;
    clarifyingQuestion = parsed.needs_clarification ? parsed.clarifying_question : null;
    unsupported = parsed.unsupported;
    return clean.filters;
  };

  if (input.filters) {
    filters = { ...EMPTY_FILTERS, ...input.filters };
  } else if (demo) {
    const saved = savedSearch(input.query);
    if (saved) {
      mode = "demo-saved";
      filters = applyParsed(saved);
    } else {
      mode = "keyword-fallback";
      filters = keywordFilters(input.query);
      notes.push("Demo mode: the AI search is off, so basic keyword matching was used. Pick an example search to see a saved Claude result.");
    }
  } else {
    try {
      filters = applyParsed(await parseQuery(input.query));
    } catch (err) {
      if (!(err instanceof ParseError)) throw err;
      mode = "keyword-fallback";
      filters = keywordFilters(input.query);
      notes.push(`Smart search is unavailable (${err.message}), so basic keyword matching was used.`);
    }
  }
  const t1 = performance.now();

  if (clarifyingQuestion) {
    return { query: input.query, mode, demo, filters, semanticQuery, clarifyingQuestion, unsupported, notes, total: 0, results: [], timingMs: { parse: ms(t1 - t0), search: 0 } };
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
    timingMs: { parse: ms(t1 - t0), search: ms(performance.now() - t1) },
  };
}

const ms = (n: number) => Math.round(n);
