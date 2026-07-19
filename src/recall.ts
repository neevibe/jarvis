import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { MEMORY_DIR, type Memory, type MemoryType, listMemories } from "./memory.js";

/**
 * Recall over the long-term store.
 *
 * Keyword-first and fully local — zero API calls, nothing leaves the machine.
 * The search index is DERIVED from the memory files and self-healing: if it's
 * missing or older than any memory file it is rebuilt automatically. Deleting
 * it is always safe.
 *
 * Semantic recall is a documented upgrade path: implement `SemanticRetriever`
 * (local embedding model) and wire it into recall() — callers never change.
 * Recall must degrade, never break: keyword search is the permanent floor.
 */

export const SEARCH_INDEX_PATH = join(MEMORY_DIR, ".search-index.json");

interface IndexEntry {
  name: string;
  type: MemoryType;
  hook: string;
  updated: string;
  /** term → weight (hook terms count 3×, body terms 1×) */
  terms: Record<string, number>;
}

interface SearchIndex {
  builtAt: string;
  entries: IndexEntry[];
}

export interface RecallHit {
  name: string;
  type: MemoryType;
  hook: string;
  updated: string;
  score: number;
}

/** Future slot: a local embedding model implements this. */
export interface SemanticRetriever {
  search(queryText: string, limit: number): Promise<RecallHit[]>;
}

const STOPWORDS = new Set(
  "a an and are as at be but by for from has have i in is it its me my of on or our so that the this to was we what when where which who will with you your".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function indexOne(m: Memory): IndexEntry {
  const terms: Record<string, number> = {};
  for (const t of tokenize(m.hook)) terms[t] = (terms[t] ?? 0) + 3;
  for (const t of tokenize(m.body)) terms[t] = (terms[t] ?? 0) + 1;
  return { name: m.name, type: m.type, hook: m.hook, updated: m.updated, terms };
}

export function buildSearchIndex(): SearchIndex {
  const index: SearchIndex = {
    builtAt: new Date().toISOString(),
    entries: listMemories().map(indexOne),
  };
  writeFileSync(SEARCH_INDEX_PATH, JSON.stringify(index, null, 2));
  return index;
}

function indexIsStale(): boolean {
  if (!existsSync(SEARCH_INDEX_PATH)) return true;
  const builtAt = statSync(SEARCH_INDEX_PATH).mtimeMs;
  if (!existsSync(MEMORY_DIR)) return false;
  return readdirSync(MEMORY_DIR).some((f) => {
    if (!f.endsWith(".md") || f === "index.md" || f.endsWith(".example.md"))
      return false;
    return statSync(join(MEMORY_DIR, f)).mtimeMs > builtAt;
  });
}

function loadSearchIndex(): SearchIndex {
  if (indexIsStale()) return buildSearchIndex();
  try {
    return JSON.parse(readFileSync(SEARCH_INDEX_PATH, "utf-8")) as SearchIndex;
  } catch {
    return buildSearchIndex(); // corrupt index — derived, so just rebuild
  }
}

export function deleteSearchIndex(): void {
  if (existsSync(SEARCH_INDEX_PATH)) rmSync(SEARCH_INDEX_PATH);
}

function keywordSearch(
  queryText: string,
  limit: number,
  type?: MemoryType,
): RecallHit[] {
  const index = loadSearchIndex();
  const queryTerms = tokenize(queryText);
  if (!queryTerms.length) return [];

  const hits: RecallHit[] = [];
  for (const entry of index.entries) {
    if (type && entry.type !== type) continue;
    let score = 0;
    for (const q of queryTerms) {
      if (entry.terms[q]) {
        score += entry.terms[q];
        continue;
      }
      // prefix credit: "dashboards" finds "dashboard", "governance" ~ "govern"
      for (const [term, w] of Object.entries(entry.terms)) {
        if (term.startsWith(q) || q.startsWith(term)) {
          score += w * 0.5;
          break;
        }
      }
    }
    if (score > 0)
      hits.push({ name: entry.name, type: entry.type, hook: entry.hook, updated: entry.updated, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Wire a local embedding model here when one is available. */
const semanticRetriever: SemanticRetriever | null = null;

export async function recall(
  queryText: string,
  opts: { limit?: number; type?: MemoryType } = {},
): Promise<RecallHit[]> {
  const limit = opts.limit ?? 5;
  if (semanticRetriever) {
    try {
      const hits = await semanticRetriever.search(queryText, limit);
      if (hits.length) return hits;
    } catch {
      // semantic layer down — fall through to keywords, never go blind
    }
  }
  return keywordSearch(queryText, limit, opts.type);
}
