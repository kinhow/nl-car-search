// Downloads the embedding model into models/ at build time, so the Vercel function
// ships it and a cold start doesn't download ~118 MB from Hugging Face.
// The ONNX file is larger than GitHub's 100 MB limit, so it is not in git.
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EMBED_MODEL, MODEL_DIR, MODEL_FILES } from "../src/lib/embeddings";

for (const file of MODEL_FILES) {
  const dest = path.join(MODEL_DIR, EMBED_MODEL, file);
  if (existsSync(dest) && statSync(dest).size > 0) continue;
  const url = `https://huggingface.co/${EMBED_MODEL}/resolve/main/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${url} returned ${res.status}`);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`Downloaded ${file} (${(statSync(dest).size / 1e6).toFixed(1)} MB)`);
}
console.log(`Model ready in ${path.relative(process.cwd(), path.join(MODEL_DIR, EMBED_MODEL))}`);
