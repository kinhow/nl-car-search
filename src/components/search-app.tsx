"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AskResponse } from "@/lib/ask";
import { EXAMPLES } from "@/lib/examples";
import type { FilterKey, Filters, ListingCard, SearchMode, SearchResponse } from "@/lib/types";

const rm = (n: number) => `RM${n.toLocaleString("en-MY")}`;
const km = (n: number) => `${n.toLocaleString("en-MY")} km`;
const secs = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`);
const GITHUB_EVALS = "https://github.com/kinhow/nl-car-search/blob/main/evals/results/summary.md";

function chipLabel(key: FilterKey, f: Filters): string | null {
  const v = f[key];
  if (v == null || (Array.isArray(v) && v.length === 0)) return null;
  switch (key) {
    case "price_min": return `From ${rm(v as number)}`;
    case "price_max": return `Up to ${rm(v as number)}`;
    case "year_min": return `${v} or newer`;
    case "year_max": return `${v} or older`;
    case "mileage_max": return `Under ${km(v as number)}`;
    case "seats_min": return `${v}+ seats`;
    case "transmission": return v === "auto" ? "Automatic" : "Manual";
    case "fuel": return v === "ev" ? "Electric" : capital(String(v));
    case "body": return v === "suv" || v === "mpv" ? String(v).toUpperCase() : capital(String(v));
    case "states": return (v as string[]).join(", ");
    default: return String(v);
  }
}
const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

const CHIP_ORDER: FilterKey[] = ["make", "model", "body", "fuel", "transmission", "price_min", "price_max", "year_min", "year_max", "mileage_max", "seats_min", "states"];

/** User-facing names for how the query was read. Same words as GLOSSARY.md. */
const MODE_LABEL: Record<SearchMode, string> = {
  llm: "AI search",
  cached: "Cached result",
  "fast-path": "Fast path",
  "demo-saved": "Saved Claude result (demo mode)",
  "keyword-fallback": "Keyword fallback",
  edited: "Your edited filters",
};
const MODE_HELP: Record<SearchMode, string> = {
  llm: "Claude Haiku read the query into filters and a preference.",
  cached: "This query was read before, so the same filters were used again without the LLM.",
  "fast-path": "Every word was a make, model, place, price or year, so the query was read without the LLM.",
  "demo-saved": "Demo mode makes no paid calls. This is a real Claude result, recorded earlier.",
  "keyword-fallback": "The LLM was not used, so only basic keywords were read.",
  edited: "You removed a filter, so the query was not read again.",
};

type Result = SearchResponse & { clientMs: number };
type SearchBody = { query: string; filters?: Filters; semanticQuery?: string | null };
type EvalFigure = { label: string; value: string; detail: string };

export function SearchApp({ evals }: { evals: EvalFigure[] }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [asking, setAsking] = useState<ListingCard | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const closeAsk = useCallback(() => setAsking(null), []);

  const search = useCallback(async (body: SearchBody) => {
    // A new search stops the one before it, so an old answer never replaces a new one.
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "The search failed. Try again.");
      setData({ ...json, clientMs: Math.round(performance.now() - t0) });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      if (inFlight.current === ctrl) {
        inFlight.current = null;
        setLoading(false);
      }
    }
  }, []);

  // The query lives in the URL (?q=), so Back, reload and shared links keep the search.
  useEffect(() => {
    const fromUrl = () => {
      const q = new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
      setQuery(q);
      setClarifyAnswer("");
      if (q) search({ query: q });
      else {
        inFlight.current?.abort();
        setData(null);
        setLoading(false);
      }
    };
    fromUrl();
    window.addEventListener("popstate", fromUrl);
    return () => window.removeEventListener("popstate", fromUrl);
  }, [search]);

  function submit(q: string) {
    const clean = q.trim();
    if (!clean) return;
    setQuery(clean);
    setClarifyAnswer("");
    const url = new URL(window.location.href);
    url.searchParams.set("q", clean);
    window.history.pushState(null, "", url);
    search({ query: clean });
  }

  function removeChip(key: FilterKey) {
    if (!data) return;
    const filters = { ...data.filters, [key]: key === "states" ? [] : null } as Filters;
    if (key === "make") filters.model = null;
    search({ query: data.query, filters, semanticQuery: data.semanticQuery });
  }

  return (
    <div>
      <form
        role="search"
        className="sign shadow-[0_2px_0_var(--sign-deep)]"
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
      >
        <div className="sign-inner overflow-hidden">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
            <label htmlFor="q" className="sr-only">Describe the car you want</label>
            <input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="auto Myvi bawah 40k, low mileage, Selangor"
              className="min-w-0 flex-1 bg-transparent px-1 text-xl font-bold text-sign-ink outline-none placeholder:font-semibold placeholder:text-sign-ink/55 focus-visible:outline-none sm:text-2xl"
              maxLength={300}
              autoComplete="off"
              enterKeyHint="search"
            />
            <button type="submit" className="rounded-lg bg-sign-ink px-6 py-3 text-base font-bold text-sign hover:bg-sign-ink/90">
              Search
            </button>
          </div>
          <div className={loading ? "lane" : "h-1"} aria-hidden="true" />
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm">
        <span className="text-muted">Try</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => submit(ex)} className="text-left text-foreground underline decoration-border decoration-2 underline-offset-4 hover:decoration-kerb">
            {ex}
          </button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">{loading ? "Searching" : data ? `${data.total} cars match` : ""}</p>

      {error && (
        <p role="alert" className="mt-8 rounded-lg bg-warn-soft p-4 text-sm text-warn">
          {error} Your query is still in the box. Press Search to try again.
        </p>
      )}

      {!data && !loading && <HowItWorks evals={evals} />}
      {!data && loading && <SkeletonResults />}

      {data && (
        <section className="mt-8" aria-busy={loading}>
          {data.clarifyingQuestion ? (
            <form
              className="max-w-2xl rounded-xl border-l-8 border-kerb bg-surface p-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (clarifyAnswer.trim()) submit(`${data.query}, ${clarifyAnswer.trim()}`);
              }}
            >
              <p className="text-lg font-bold">{data.clarifyingQuestion}</p>
              <p className="mt-1 text-sm text-muted">Your query was too open to search. Add one detail, such as a budget or what the car is for.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input value={clarifyAnswer} onChange={(e) => setClarifyAnswer(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2" placeholder="For example: under 50k, for Grab" aria-label="Your answer" />
                <button className="rounded-lg bg-sign px-5 py-2 font-bold text-sign-ink">Continue</button>
              </div>
            </form>
          ) : (
            <div className={loading ? "pointer-events-none opacity-45 transition-opacity" : "transition-opacity"}>
              <FilterTabs data={data} onRemove={removeChip} onClearPreference={() => search({ query: data.query, filters: data.filters, semanticQuery: null })} />

              {[...data.unsupported.map((u) => `This marketplace doesn't have ${u}.`), ...data.notes].map((n) => (
                <p key={n} className="mt-3 max-w-3xl rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{n}</p>
              ))}

              <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b-2 border-border pb-3">
                <p className="text-lg">
                  <strong className="font-extrabold">{data.total.toLocaleString()}</strong> {data.total === 1 ? "car matches" : "cars match"}
                  {data.total > data.results.length && <span className="text-muted">, top {data.results.length} shown</span>}
                </p>
                <p className="text-sm text-muted">
                  Results in <strong className="font-bold text-foreground">{secs(data.clientMs)}</strong>
                  <span className="mx-2 text-border" aria-hidden="true">|</span>
                  {MODE_LABEL[data.mode]}
                </p>
              </div>

              <AiPanel data={data} />

              {data.results.length > 0 ? (
                <ResultGrid results={data.results} onAsk={setAsking} />
              ) : (
                <p className="mt-8 max-w-xl text-base">No cars match all of these filters. Remove a yellow filter above to see more cars.</p>
              )}
            </div>
          )}
        </section>
      )}

      {asking && <AskPanel listing={asking} onClose={closeAsk} />}
    </div>
  );
}

function FilterTabs({ data, onRemove, onClearPreference }: { data: Result; onRemove: (k: FilterKey) => void; onClearPreference: () => void }) {
  const tabs = CHIP_ORDER.flatMap((k) => {
    const label = chipLabel(k, data.filters);
    if (!label || (k === "make" && data.filters.model)) return [];
    return [{ key: k, text: k === "model" ? `${data.filters.make} ${label}` : label }];
  });
  if (tabs.length === 0 && !data.semanticQuery) {
    return <p className="text-sm text-muted">No filters. All cars are shown, newest first.</p>;
  }
  // Remount on each new result, so the tabs drop in again.
  const runKey = `${data.query}|${data.mode}|${data.clientMs}`;
  return (
    <ul key={runKey} className="flex flex-wrap items-center gap-2" aria-label="Filters">
      {tabs.map((t, i) => (
        <li key={t.key} className="tab-in inline-flex items-center rounded-md bg-kerb pl-3 text-sm font-bold text-kerb-ink" style={{ animationDelay: `${i * 45}ms` }}>
          {t.text}
          <button type="button" onClick={() => onRemove(t.key === "model" ? "make" : t.key)} aria-label={`Remove ${t.text}`} className="ml-1 rounded-r-md px-2.5 py-1.5 hover:bg-black/10">
            ×
          </button>
        </li>
      ))}
      {data.semanticQuery && (
        <li className="tab-in inline-flex items-center rounded-md border-2 border-kerb bg-surface pl-3 text-sm" style={{ animationDelay: `${tabs.length * 45}ms` }}>
          <span><span className="text-muted">Ranked by</span> <span className="font-semibold">{data.semanticQuery}</span></span>
          <button type="button" onClick={onClearPreference} aria-label="Stop ranking by this preference" className="ml-1 px-2.5 py-1.5 text-muted hover:text-foreground">
            ×
          </button>
        </li>
      )}
    </ul>
  );
}

/** "What the AI did": a distance board that lists each step with its time. */
function AiPanel({ data }: { data: Result }) {
  const t = data.timingMs;
  const network = Math.max(0, data.clientMs - t.total);
  const rows: { step: string; how: string; ms: number; sub?: boolean }[] = [
    { step: "Read the query", how: MODE_LABEL[data.mode], ms: t.parse },
    ...(t.firstToken != null ? [{ step: "First token from Claude", how: "Network and prompt", ms: t.firstToken, sub: true }] : []),
    ...(t.output != null ? [{ step: "Claude writes the filters", how: "JSON output", ms: t.output, sub: true }] : []),
    { step: data.semanticQuery ? "Filter and rank by meaning" : "Filter and sort", how: data.semanticQuery ? "Local embeddings" : "Newest first", ms: t.rank },
    { step: "Network and browser", how: "Request and response", ms: network },
  ];
  const parsed = { ...pickSet(data.filters), semantic_query: data.semanticQuery, unsupported: data.unsupported };
  return (
    <details className="group mt-3">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-sm font-semibold text-accent hover:underline [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">▸</span>
        What the AI did
      </summary>
      <div className="sign mt-2 max-w-3xl">
        <div className="sign-inner p-4 sm:p-5">
          <p className="text-sm text-sign-ink/85">{MODE_HELP[data.mode]}</p>
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">Time for each step</caption>
            <tbody>
              {rows.map((r) => (
                <tr key={r.step} className="border-b border-sign-ink/15 last:border-0">
                  <th scope="row" className={`py-1.5 text-left font-semibold ${r.sub ? "pl-5 font-normal text-sign-ink/80" : ""}`}>{r.step}</th>
                  <td className="py-1.5 text-sign-ink/70">{r.how}</td>
                  <td className="py-1.5 text-right font-bold">{secs(r.ms)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-sign-ink/70">
                <th scope="row" className="pt-2 text-left text-base font-extrabold">Results in</th>
                <td />
                <td className="pt-2 text-right text-base font-extrabold">{secs(data.clientMs)}</td>
              </tr>
            </tbody>
          </table>
          <pre className="mt-4 whitespace-pre-wrap break-words rounded-md bg-sign-deep p-3 font-mono text-xs leading-relaxed text-sign-ink/90">{JSON.stringify(parsed, null, 2)}</pre>
        </div>
      </div>
    </details>
  );
}

const pickSet = (f: Filters) => Object.fromEntries(Object.entries(f).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v != null)));

function ResultGrid({ results, onAsk }: { results: Result["results"]; onAsk: (l: ListingCard) => void }) {
  const scores = results.map((r) => r.score).filter((s): s is number => s != null);
  const hi = Math.max(...scores);
  const lo = Math.min(...scores);
  // Match in 5 steps, relative to the cars on this page: the best car shows 5.
  const steps = (s?: number) => (s == null ? null : hi === lo ? 5 : 1 + Math.round(((s - lo) / (hi - lo)) * 4));
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((l) => {
        const match = steps(l.score);
        return (
          <li key={l.id} className="flex flex-col rounded-xl border border-border bg-surface p-5">
            <h2 className="text-lg font-bold leading-snug">{l.title}</h2>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-4">
              <span className="text-2xl font-extrabold">{rm(l.price)}</span>
              <span className="text-sm text-muted">{km(l.mileage)}</span>
            </p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
              <dt className="text-muted">Gearbox</dt><dd>{l.transmission === "auto" ? "Automatic" : "Manual"}</dd>
              <dt className="text-muted">Fuel</dt><dd>{l.fuel === "ev" ? "Electric" : capital(l.fuel)}, {l.seats} seats</dd>
              <dt className="text-muted">Location</dt><dd>{l.area}, {l.state}</dd>
            </dl>
            {match != null && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                <span className="flex gap-0.5" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`h-2 w-5 rounded-sm ${i <= match ? "bg-kerb" : "bg-skeleton"}`} />
                  ))}
                </span>
                <span>Match {match} of 5</span>
              </div>
            )}
            <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed">{l.description}</p>
            <button type="button" onClick={() => onAsk(l)} className="mt-4 self-start rounded-md py-1 text-sm font-bold text-accent hover:underline">
              Ask about this car
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SkeletonResults() {
  return (
    <div className="mt-8" aria-hidden="true">
      <div className="flex gap-2">
        {[96, 128, 80].map((w) => <div key={w} className="skeleton h-8" style={{ width: w }} />)}
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="rounded-xl border border-border bg-surface p-5">
            <div className="skeleton h-5 w-3/4" />
            <div className="skeleton mt-3 h-7 w-1/2" />
            <div className="skeleton mt-4 h-3 w-2/3" />
            <div className="skeleton mt-2 h-3 w-1/2" />
            <div className="skeleton mt-5 h-12 w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

const STEPS = [
  { title: "You type", body: "Any mix of English, Malay and Manglish: \"kereta 7 seater bawah 70k kat Johor\"." },
  { title: "The AI reads it", body: "Claude Haiku turns your words into filters. Simple queries skip the LLM." },
  { title: "Ranked by meaning", body: "A wish like \"good for Grab\" ranks the cars with local embeddings." },
  { title: "Ask about a car", body: "Answers come only from the listing and a buyer's guide, with sources." },
];

function HowItWorks({ evals }: { evals: EvalFigure[] }) {
  return (
    <section className="mt-12 grid gap-10 lg:grid-cols-[1fr_minmax(0,26rem)]" aria-labelledby="how">
      <div>
        <h2 id="how" className="text-xl font-extrabold">How a search works</h2>
        <ol className="mt-5 grid gap-6 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sign text-base font-extrabold text-sign-ink">{i + 1}</span>
              <div>
                <h3 className="font-bold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="sign self-start">
        <div className="sign-inner p-5">
          <h2 className="text-lg font-extrabold">Measured, not guessed</h2>
          <table className="mt-3 w-full">
            <caption className="sr-only">Results of the last eval run</caption>
            <tbody>
              {evals.map((e) => (
                <tr key={e.label} className="border-b border-sign-ink/20 last:border-0">
                  <th scope="row" className="py-2.5 pr-4 text-left align-top">
                    <span className="block font-semibold">{e.label}</span>
                    <span className="block text-xs font-normal text-sign-ink/75">{e.detail}</span>
                  </th>
                  <td className="py-2.5 text-right align-top text-2xl font-extrabold">{e.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <a href={GITHUB_EVALS} className="mt-3 inline-block text-sm font-semibold text-sign-ink underline decoration-kerb decoration-2 underline-offset-4">
            See every eval result
          </a>
        </div>
      </div>
    </section>
  );
}

const SUGGESTED = ["How much is the road tax?", "Can I use this for e-hailing?", "Is the mileage normal for its age?", "Has it been in a flood?"];

function AskPanel({ listing, onClose }: { listing: ListingCard; onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function ask(q: string) {
    if (!q.trim()) return;
    setQuestion(q);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId: listing.id, question: q }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No answer came back. Try again.");
      setAnswer(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Ask about ${listing.title}`} className="fixed inset-0 z-10 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{listing.title}</h2>
            <p className="text-sm text-muted">{rm(listing.price)}, {km(listing.mileage)}, {listing.area}</p>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="rounded px-2 text-2xl leading-none text-muted hover:text-foreground">×</button>
        </div>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask anything about this car" aria-label="Your question" maxLength={300} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2" />
          <button disabled={loading} className="rounded-lg bg-sign px-4 py-2 font-bold text-sign-ink disabled:opacity-60">{loading ? "Asking" : "Ask"}</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED.map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-md border border-border px-3 py-1 text-xs text-muted hover:border-kerb hover:text-foreground">{s}</button>
          ))}
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-warn">{error}</p>}
        {loading && !answer && <div className="mt-5 space-y-2" aria-hidden="true"><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-5/6" /><div className="skeleton h-3 w-2/3" /></div>}
        {answer && (
          <div className={`mt-5 rounded-lg bg-background p-4 ${loading ? "opacity-50" : ""}`} aria-live="polite">
            {!answer.grounded && !answer.demo && <p className="mb-2 text-sm font-bold text-warn">The listing and the guide don&apos;t answer this.</p>}
            <p className="text-sm leading-relaxed">{answer.answer}</p>
            {answer.citations.length > 0 && (
              <p className="mt-3 text-xs text-muted">Sources: {answer.citations.map((c) => (c.id === "listing" ? "this listing" : c.title)).join(", ")}</p>
            )}
            {answer.demo && answer.retrieved.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm">
                {answer.retrieved.map((r) => <li key={r.id}>{r.title} <span className="text-xs text-muted">({r.score})</span></li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
