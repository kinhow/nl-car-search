import { BODY_TYPES, CATALOG, findModel, type BodyType, type State } from "@/data/catalog";
import { EMPTY_FILTERS, type Filters } from "./types";

// Fast path: read a simple query without the LLM.
// It is strict on purpose. Every word must be one that it knows, or it returns
// null and the LLM reads the query. So it never guesses a preference, never
// skips a clarifying question, and never maps a car that the marketplace
// doesn't stock. `npm run eval:fastpath` checks it against the labelled queries.

const PLACES: Record<string, State[]> = {
  "kuala lumpur": ["Kuala Lumpur"], kl: ["Kuala Lumpur"], cheras: ["Kuala Lumpur"], kepong: ["Kuala Lumpur"], bangsar: ["Kuala Lumpur"],
  selangor: ["Selangor"], pj: ["Selangor"], "petaling jaya": ["Selangor"], "shah alam": ["Selangor"], subang: ["Selangor"],
  klang: ["Selangor"], puchong: ["Selangor"], cyberjaya: ["Selangor"], "klang valley": ["Selangor", "Kuala Lumpur"],
  johor: ["Johor"], jb: ["Johor"], "johor bahru": ["Johor"],
  penang: ["Penang"], "pulau pinang": ["Penang"], butterworth: ["Penang"],
  perak: ["Perak"], ipoh: ["Perak"], "negeri sembilan": ["Negeri Sembilan"], seremban: ["Negeri Sembilan"],
  melaka: ["Melaka"], pahang: ["Pahang"], kedah: ["Kedah"], kelantan: ["Kelantan"], terengganu: ["Terengganu"],
  sabah: ["Sabah"], sarawak: ["Sarawak"],
};

const TRANSMISSION: Record<string, Filters["transmission"]> = { auto: "auto", automatic: "auto", automatik: "auto", manual: "manual" };
// Words that carry no filter. "car" and "kereta" are here; "murah" (cheap) is not, because it is a preference.
const FILLER = new Set(["in", "kat", "di", "near", "area", "kereta", "car", "used", "any", "a", "and", ",", "dan"]);
const PRICE_MAX = new Set(["under", "below", "bawah", "max", "budget", "<"]);
const PRICE_MIN = new Set(["above", "atas"]);

/** Phrases longest first, so "honda city" wins over "honda" and "klang valley" over "klang". */
const PHRASES: { words: string[]; apply: (f: Filters) => boolean }[] = [];
const add = (text: string, apply: (f: Filters) => boolean) => PHRASES.push({ words: text.toLowerCase().split(" "), apply });

const setOnce = <K extends keyof Filters>(f: Filters, k: K, v: Filters[K]) => {
  if (f[k] != null && f[k] !== v) return false;
  f[k] = v;
  return true;
};

for (const c of CATALOG) {
  const setModel = (f: Filters) => setOnce(f, "model", c.model) && setOnce(f, "make", c.make);
  const forms = new Set([c.model, c.model.replace(/-/g, ""), c.model.replace(/-/g, " ")]);
  for (const m of forms) {
    add(m, setModel);
    add(`${c.make} ${m}`, setModel);
  }
}
for (const make of new Set(CATALOG.map((c) => c.make))) add(make, (f) => setOnce(f, "make", make));
for (const [place, states] of Object.entries(PLACES)) {
  add(place, (f) => {
    for (const s of states) if (!f.states.includes(s)) f.states.push(s);
    return true;
  });
}
for (const [word, t] of Object.entries(TRANSMISSION)) add(word, (f) => setOnce(f, "transmission", t));
for (const b of BODY_TYPES) add(b, (f) => setOnce(f, "body", b as BodyType));
PHRASES.sort((a, b) => b.words.length - a.words.length);

/** "80k", "rm80k", "rm80,000", "80,000" → 80000. A bare "80" is not a price: it could mean RM80k or 80,000 km. */
function readPrice(tokens: string[], i: number): { value: number; used: number } | null {
  let j = i;
  if (tokens[j] === "rm") j++;
  const t = tokens[j];
  if (t == null) return null;
  const m = t.match(/^(?:rm)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?k)$/);
  if (!m) return null;
  // "100k km" is mileage, not price.
  if (tokens[j + 1] === "km" || /km$/.test(t)) return null;
  const raw = m[1];
  const value = raw.endsWith("k") ? Math.round(Number(raw.slice(0, -1)) * 1000) : Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(value) || value < 1000) return null;
  return { value, used: j - i + 1 };
}

const isYear = (t: string | undefined) => t != null && /^(19[9]\d|20[0-2]\d)$/.test(t);

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/,(?!\d{3})/g, " , ")
    .split(/\s+/)
    .filter(Boolean);
}

export function fastPath(query: string): Filters | null {
  const tokens = tokenize(query);
  if (tokens.length === 0 || tokens.length > 16) return null;
  const f: Filters = { ...EMPTY_FILTERS, states: [] };
  let i = 0;

  outer: while (i < tokens.length) {
    const t = tokens[i];
    if (FILLER.has(t)) { i++; continue; }

    if (PRICE_MAX.has(t) || PRICE_MIN.has(t)) {
      const p = readPrice(tokens, i + 1);
      if (!p) return null;
      if (!setOnce(f, PRICE_MAX.has(t) ? "price_max" : "price_min", p.value)) return null;
      i += 1 + p.used;
      continue;
    }

    // "after 2018", "from 2018", "before 2018"
    if ((t === "after" || t === "from" || t === "before") && isYear(tokens[i + 1])) {
      const y = Number(tokens[i + 1]);
      if (!(t === "before" ? setOnce(f, "year_max", y - 1) : setOnce(f, "year_min", y))) return null;
      i += 2;
      continue;
    }
    // "2018 and above", "2018 onwards", "2018 or newer", "2018 ke atas"
    if (isYear(t)) {
      const rest = tokens.slice(i + 1, i + 3).join(" ");
      const tail = ["and above", "or newer", "ke atas"].find((p) => rest === p) ?? (tokens[i + 1] === "onwards" ? "onwards" : null);
      if (!tail) return null;
      if (!setOnce(f, "year_min", Number(t))) return null;
      i += 1 + tail.split(" ").length;
      continue;
    }

    for (const p of PHRASES) {
      if (p.words.every((w, k) => tokens[i + k] === w)) {
        if (!p.apply(f)) return null;
        i += p.words.length;
        continue outer;
      }
    }
    return null; // A word that the fast path doesn't know: let the LLM read it.
  }

  if (f.make && f.model && !findModel(f.make, f.model)) return null;
  const anyFilter = Object.values(f).some((v) => (Array.isArray(v) ? v.length > 0 : v != null));
  return anyFilter ? f : null;
}
