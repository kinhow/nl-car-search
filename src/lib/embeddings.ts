// Voyage AI embeddings. Claude has no embeddings endpoint; Voyage is the
// provider Anthropic recommends. voyage-3.5-lite handles English and Malay.

export const EMBED_MODEL = "voyage-3.5-lite";
export const EMBED_DIM = 512;
const URL = "https://api.voyageai.com/v1/embeddings";
const BATCH = 128;

interface VoyageResponse {
  data: { embedding: number[]; index: number }[];
  usage: { total_tokens: number };
}

export async function embed(texts: string[], inputType: "query" | "document"): Promise<Float32Array[]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set.");
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetchWithRetry(() =>
      fetch(URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ input: batch, model: EMBED_MODEL, input_type: inputType, output_dimension: EMBED_DIM }),
      }),
    );
    const json = (await res.json()) as VoyageResponse;
    for (const d of json.data.sort((a, b) => a.index - b.index)) out.push(normalize(Float32Array.from(d.embedding)));
  }
  return out;
}

async function fetchWithRetry(call: () => Promise<Response>, attempts = 4): Promise<Response> {
  for (let n = 1; ; n++) {
    const res = await call();
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || n >= attempts) throw new Error(`Voyage API error ${res.status}: ${await res.text()}`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (n - 1)));
  }
}

export function normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

/** Cosine similarity of two normalized vectors. */
export function dot(a: Float32Array, b: Float32Array) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

const queryCache = new Map<string, Float32Array>();
export async function embedQuery(text: string): Promise<Float32Array> {
  const key = text.trim().toLowerCase();
  const hit = queryCache.get(key);
  if (hit) return hit;
  const [v] = await embed([text], "query");
  if (queryCache.size > 500) queryCache.clear();
  queryCache.set(key, v);
  return v;
}
