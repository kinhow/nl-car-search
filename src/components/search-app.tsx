"use client";

import { useState } from "react";
import type { AskResponse } from "@/lib/ask";
import { EXAMPLES } from "@/lib/examples";
import type { FilterKey, Filters, ListingCard, SearchResponse } from "@/lib/types";


const rm = (n: number) => `RM${n.toLocaleString("en-MY")}`;
const km = (n: number) => `${n.toLocaleString("en-MY")} km`;

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
    case "fuel": return v === "ev" ? "Electric" : String(v)[0].toUpperCase() + String(v).slice(1);
    case "body": return v === "suv" || v === "mpv" ? String(v).toUpperCase() : String(v)[0].toUpperCase() + String(v).slice(1);
    case "states": return (v as string[]).join(", ");
    default: return String(v);
  }
}

const CHIP_ORDER: FilterKey[] = ["make", "model", "body", "fuel", "transmission", "price_min", "price_max", "year_min", "year_max", "mileage_max", "seats_min", "states"];

export function SearchApp() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [asking, setAsking] = useState<ListingCard | null>(null);

  async function search(body: { query: string; filters?: Filters; semanticQuery?: string | null }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function submit(q: string) {
    if (!q.trim()) return;
    setQuery(q);
    setClarifyAnswer("");
    search({ query: q });
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
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
      >
        <label htmlFor="q" className="sr-only">Describe the car you want</label>
        <input
          id="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. auto Myvi bawah 40k, low mileage, Selangor"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
          maxLength={300}
        />
        <button type="submit" disabled={loading} className="rounded-lg bg-accent px-5 py-3 font-medium text-background disabled:opacity-60">
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => submit(ex)} className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted hover:border-accent hover:text-foreground">
            {ex}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-6 rounded-lg bg-warn-soft p-3 text-sm text-warn">{error}</p>}

      {data && (
        <section className="mt-8" aria-live="polite">
          {data.clarifyingQuestion ? (
            <form
              className="rounded-lg border border-border bg-surface p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (clarifyAnswer.trim()) submit(`${data.query}, ${clarifyAnswer.trim()}`);
              }}
            >
              <p className="font-medium">{data.clarifyingQuestion}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input value={clarifyAnswer} onChange={(e) => setClarifyAnswer(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2" placeholder="Your answer" aria-label="Your answer" />
                <button className="rounded-lg bg-accent px-4 py-2 font-medium text-background">Continue</button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {CHIP_ORDER.map((k) => {
                  const label = chipLabel(k, data.filters);
                  if (!label || (k === "make" && data.filters.model)) return null;
                  const shown = k === "model" ? `${data.filters.make} ${label}` : label;
                  return (
                    <span key={k} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-sm">
                      {shown}
                      <button onClick={() => removeChip(k === "model" ? "make" : k)} aria-label={`Remove ${shown}`} className="rounded-full px-2 text-muted hover:text-foreground">×</button>
                    </span>
                  );
                })}
                {data.semanticQuery && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent py-1 pl-3 pr-1 text-sm">
                    Ranked by: {data.semanticQuery}
                    <button onClick={() => search({ query: data.query, filters: data.filters, semanticQuery: null })} aria-label="Stop ranking by preference" className="rounded-full px-2 text-muted hover:text-foreground">×</button>
                  </span>
                )}
              </div>

              {[...data.unsupported.map((u) => `Not on this marketplace: ${u}`), ...data.notes].map((n) => (
                <p key={n} className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{n}</p>
              ))}

              <p className="mt-4 text-sm text-muted">
                {data.total.toLocaleString()} cars match
                {data.total > data.results.length && `, showing the top ${data.results.length}`}
                {" · "}
                {data.demo ? (data.mode === "demo-saved" ? "demo mode · saved Claude result" : "demo mode") : data.mode === "llm" ? "AI search" : "keyword fallback"} · parsed in {data.timingMs.parse} ms
              </p>

              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.results.map((l) => (
                  <li key={l.id} className="flex flex-col rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-medium leading-snug">{l.title}</h2>
                      <span className="shrink-0 font-semibold text-accent">{rm(l.price)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {km(l.mileage)} · {l.transmission === "auto" ? "Auto" : "Manual"} · {l.fuel} · {l.seats} seats · {l.area}, {l.state}
                    </p>
                    <p className="mt-3 line-clamp-3 flex-1 text-sm">{l.description}</p>
                    <button onClick={() => setAsking(l)} className="mt-4 self-start text-sm font-medium text-accent hover:underline">
                      Ask about this car →
                    </button>
                  </li>
                ))}
              </ul>
              {data.results.length === 0 && <p className="mt-4 text-sm">No cars match. Try removing a filter above.</p>}
            </>
          )}
        </section>
      )}

      {asking && <AskPanel listing={asking} onClose={() => setAsking(null)} />}
    </div>
  );
}

const SUGGESTED = ["How much is the road tax?", "Can I use this for e-hailing?", "Is the mileage normal for its age?", "Has it been in a flood?"];

function AskPanel({ listing, onClose }: { listing: ListingCard; onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    if (!q.trim()) return;
    setQuestion(q);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId: listing.id, question: q }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't answer");
      setAnswer(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Ask about ${listing.title}`} className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-surface p-5 sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{listing.title}</h2>
            <p className="text-sm text-muted">{rm(listing.price)} · {km(listing.mileage)} · {listing.area}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded px-2 text-xl text-muted hover:text-foreground">×</button>
        </div>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask anything about this car" aria-label="Your question" maxLength={300} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2" />
          <button disabled={loading} className="rounded-lg bg-accent px-4 py-2 font-medium text-background disabled:opacity-60">{loading ? "…" : "Ask"}</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED.map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent hover:text-foreground">{s}</button>
          ))}
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-warn">{error}</p>}
        {answer && (
          <div className="mt-5 rounded-lg bg-background p-4" aria-live="polite">
            {!answer.grounded && !answer.demo && <p className="mb-2 text-xs font-medium uppercase tracking-wide text-warn">Not in the listing or guide</p>}
            <p className="text-sm">{answer.answer}</p>
            {answer.citations.length > 0 && (
              <p className="mt-3 text-xs text-muted">Sources: {answer.citations.map((c) => (c.id === "listing" ? "this listing" : c.title)).join(" · ")}</p>
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
