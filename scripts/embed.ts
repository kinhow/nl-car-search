// Precomputes embeddings for every listing and guide section.
// Run once after generating data: npm run data:embed (free, runs locally; downloads the model once).
import { mkdirSync, writeFileSync } from "node:fs";
import { embed, EMBED_DIM } from "../src/lib/embeddings";
import { loadGuide } from "../src/lib/guide";
import { LISTINGS } from "../src/lib/search";

function save(file: string, vecs: Float32Array[]) {
  const out = new Float32Array(vecs.length * EMBED_DIM);
  vecs.forEach((v, i) => out.set(v, i * EMBED_DIM));
  writeFileSync(`src/data/vectors/${file}`, Buffer.from(out.buffer));
  console.log(`Wrote ${vecs.length} vectors to src/data/vectors/${file}`);
}

mkdirSync("src/data/vectors", { recursive: true });

// Embed what a buyer reads: the title and description. Hidden traits are never embedded.
save("listings.f32", await embed(LISTINGS.map((l) => `${l.title}. ${l.body}, ${l.fuel}, ${l.seats} seats. ${l.description}`)));
save("guide.f32", await embed(loadGuide().map((c) => `${c.title}\n${c.text}`)));
