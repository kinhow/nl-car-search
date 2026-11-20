import { readFileSync } from "node:fs";
import path from "node:path";
import { EMBED_DIM, dot, embedQuery } from "./embeddings";
import { loadGuide, type GuideChunk } from "./guide";
import { LISTINGS } from "./search";
import type { Listing } from "./types";

// Vectors are precomputed by scripts/embed.ts and stored as raw Float32, in the
// same order as listings.json and guide.md. 2,000 × 512 dims fits in memory, so
// there's no vector database.
const DIR = path.join(process.cwd(), "src/data/vectors");

function loadMatrix(file: string, rows: number): Float32Array[] {
  const buf = readFileSync(path.join(DIR, file));
  const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  if (all.length !== rows * EMBED_DIM) {
    throw new Error(`${file} has ${all.length / EMBED_DIM} rows, expected ${rows}. Run npm run data:embed.`);
  }
  return Array.from({ length: rows }, (_, i) => all.subarray(i * EMBED_DIM, (i + 1) * EMBED_DIM));
}

let listingVecs: Map<string, Float32Array> | null = null;
function listingVectors() {
  if (!listingVecs) {
    const rows = loadMatrix("listings.f32", LISTINGS.length);
    listingVecs = new Map(LISTINGS.map((l, i) => [l.id, rows[i]]));
  }
  return listingVecs;
}

let guide: { chunks: GuideChunk[]; vecs: Float32Array[] } | null = null;
function guideIndex() {
  if (!guide) {
    const chunks = loadGuide();
    guide = { chunks, vecs: loadMatrix("guide.f32", chunks.length) };
  }
  return guide;
}

/** Ranks already-filtered listings by similarity to a soft preference. */
export async function rankBySimilarity(candidates: Listing[], semanticQuery: string) {
  const q = await embedQuery(semanticQuery);
  const vecs = listingVectors();
  return candidates
    .map((l) => ({ listing: l, score: dot(q, vecs.get(l.id)!) }))
    .sort((a, b) => b.score - a.score);
}

export async function searchGuide(question: string, k = 3) {
  const q = await embedQuery(question);
  const { chunks, vecs } = guideIndex();
  return chunks
    .map((c, i) => ({ chunk: c, score: dot(q, vecs[i]) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
