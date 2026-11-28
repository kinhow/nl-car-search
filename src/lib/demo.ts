import saved from "@/data/demo-searches.json";
import type { ParsedQuery } from "./types";

/** Demo mode: no Claude calls. On when DEMO_MODE=1 or when no API key is set. */
export const isDemo = () => process.env.DEMO_MODE === "1" || !process.env.ANTHROPIC_API_KEY;

export const demoKey = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

const SAVED = saved as Record<string, ParsedQuery>;

/** A real Claude result recorded by `npm run demo:record`, or null. */
export const savedSearch = (q: string): ParsedQuery | null => SAVED[demoKey(q)] ?? null;
