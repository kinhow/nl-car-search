import { readFileSync } from "node:fs";
import path from "node:path";

export interface GuideChunk {
  id: string;
  title: string;
  text: string;
}

export function loadGuide(): GuideChunk[] {
  const md = readFileSync(path.join(process.cwd(), "src/data/guide.md"), "utf8");
  return md
    .split(/^## /m)
    .slice(1)
    .map((block) => {
      const [head, ...body] = block.split("\n");
      const [id, ...title] = head.split(":");
      return { id: id.trim(), title: title.join(":").trim(), text: body.join("\n").trim() };
    });
}
