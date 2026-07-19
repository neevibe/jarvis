import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const KNOWLEDGE_DIR = join(ROOT, "knowledge");

let cache: { key: string; text: string } | null = null;

/**
 * Renders every knowledge/*.md file (except *.example.md) into one block for
 * the stable prompt. Human-curated and read-only from the agent's side.
 *
 * Cached on a fingerprint of file names + modification times, so an edit to
 * any knowledge file lands on the next turn — same living-file contract as
 * the identity.
 */
export function loadKnowledge(): string {
  const files = readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.endsWith(".md") && !f.endsWith(".example.md"))
    .sort();

  const key = files
    .map((f) => `${f}:${statSync(join(KNOWLEDGE_DIR, f)).mtimeMs}`)
    .join("|");

  if (!cache || cache.key !== key) {
    if (files.length === 0) {
      cache = { key, text: "" };
    } else {
      const rendered = files.map((f) => {
        const body = readFileSync(join(KNOWLEDGE_DIR, f), "utf-8").trim();
        return `<knowledge file="${f}">\n${body}\n</knowledge>`;
      });
      cache = {
        key,
        text: [
          "# Core knowledge",
          "",
          "Facts you always know — no one should ever have to re-tell you these.",
          "They are human-curated and read-only: you cite and apply them, you do",
          "not rewrite them. If one seems outdated, say so instead of silently",
          "overriding it.",
          "",
          rendered.join("\n\n"),
        ].join("\n"),
      };
    }
  }
  return cache.text;
}
