// Local embeddings with transformers.js: a small open model that runs inside the
// app, so search by meaning costs nothing and needs no API key.
// paraphrase-multilingual-MiniLM-L12-v2 covers English and Malay. On the
// retrieval eval it scored 80% precision@10, against 60% for English-only MiniLM.
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export const EMBED_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const EMBED_DIM = 384;
const BATCH = 32;

/** `npm run build` downloads these into models/ (scripts/fetch-model.ts), and Vercel ships them. */
export const MODEL_DIR = path.join(process.cwd(), "models");
export const MODEL_FILES = ["config.json", "tokenizer.json", "tokenizer_config.json", "onnx/model_quantized.onnx"];

// Use the bundled model when it is there. If not (a fresh clone before a build),
// download it once. Serverless file systems are read-only except /tmp, so cache it there.
env.localModelPath = MODEL_DIR;
env.allowLocalModels = existsSync(path.join(MODEL_DIR, EMBED_MODEL, MODEL_FILES[3]));
env.cacheDir = process.env.HF_CACHE_DIR ?? path.join(os.tmpdir(), "hf-cache");

let extractor: Promise<FeatureExtractionPipeline> | null = null;
const getExtractor = () => (extractor ??= pipeline("feature-extraction", EMBED_MODEL, { dtype: "q8" }));

/** Start to load the model now, so that it loads while the LLM reads the query. */
export function warmEmbeddings() {
  getExtractor().catch(() => {
    extractor = null; // embed() tries again and reports the error.
  });
}

export async function embed(texts: string[]): Promise<Float32Array[]> {
  const ex = await getExtractor();
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const tensor = await ex(batch, { pooling: "mean", normalize: true });
    const data = tensor.data as Float32Array;
    for (let j = 0; j < batch.length; j++) out.push(data.slice(j * EMBED_DIM, (j + 1) * EMBED_DIM));
  }
  return out;
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
  const [v] = await embed([text]);
  if (queryCache.size > 500) queryCache.clear();
  queryCache.set(key, v);
  return v;
}
