import { readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const IDENTITY_PATH = join(ROOT, "identity", "jarvis.md");

let cache: { mtimeMs: number; text: string } | null = null;

/**
 * The identity file is re-read whenever its modification time changes, so an
 * edit takes effect on the very next turn — without hitting disk for the full
 * file content on every turn in between.
 */
export function loadIdentity(): string {
  const { mtimeMs } = statSync(IDENTITY_PATH);
  if (!cache || cache.mtimeMs !== mtimeMs) {
    cache = { mtimeMs, text: readFileSync(IDENTITY_PATH, "utf-8") };
  }
  return cache.text;
}
