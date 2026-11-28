import { demoKey } from "./demo";
import type { ParsedQuery } from "./types";

// Cached results: the same query gives the same filters, so a repeat skips the LLM.
// In memory, so it costs nothing. Each server instance has its own copy, and a new
// instance starts empty. A Map keeps insertion order, which makes a small LRU.
const MAX = 500;
const cache = new Map<string, ParsedQuery>();

export function getCached(query: string): ParsedQuery | null {
  const key = demoKey(query);
  const hit = cache.get(key);
  if (!hit) return null;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

export function setCached(query: string, parsed: ParsedQuery) {
  const key = demoKey(query);
  cache.delete(key);
  cache.set(key, parsed);
  if (cache.size > MAX) cache.delete(cache.keys().next().value!);
}

export const clearCache = () => cache.clear();
