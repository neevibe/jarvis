import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const MEMORY_DIR = join(ROOT, "memory");
export const INDEX_PATH = join(MEMORY_DIR, "index.md");

/**
 * The type shapes when a memory is worth recalling:
 *  - identity-fact: durable facts about Neeraj himself
 *  - preference:    how he wants things done / corrections he has made
 *  - decision:      a decision plus the context and reasoning behind it
 *  - project:       ongoing work and its state
 *  - person:        people in his world and what matters about them
 *  - reference:     pointers to external resources (URLs, docs, datasets)
 */
export const MEMORY_TYPES = [
  "identity-fact",
  "preference",
  "decision",
  "project",
  "person",
  "reference",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface Memory {
  /** File name without .md — the memory's stable id. */
  name: string;
  type: MemoryType;
  /** One-line searchable summary. */
  hook: string;
  /** The fact itself, why it matters, and how to apply it. */
  body: string;
  created: string;
  updated: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 8)
    .join("-");
}

function render(m: Memory): string {
  return [
    "---",
    `type: ${m.type}`,
    `hook: ${m.hook}`,
    `created: ${m.created}`,
    `updated: ${m.updated}`,
    "---",
    "",
    m.body.trim(),
    "",
  ].join("\n");
}

function parse(name: string, raw: string): Memory | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (!fields.type || !fields.hook) return null;
  if (!MEMORY_TYPES.includes(fields.type as MemoryType)) return null;
  return {
    name,
    type: fields.type as MemoryType,
    hook: fields.hook,
    body: match[2].trim(),
    created: fields.created ?? today(),
    updated: fields.updated ?? today(),
  };
}

const pathOf = (name: string) => join(MEMORY_DIR, `${name}.md`);

/** Every valid memory file on disk. The files ARE the source of truth. */
export function listMemories(): Memory[] {
  if (!existsSync(MEMORY_DIR)) return [];
  const memories: Memory[] = [];
  for (const f of readdirSync(MEMORY_DIR).sort()) {
    if (!f.endsWith(".md") || f === "index.md" || f.endsWith(".example.md"))
      continue;
    const m = parse(f.replace(/\.md$/, ""), readFileSync(join(MEMORY_DIR, f), "utf-8"));
    if (m) memories.push(m);
  }
  return memories;
}

export function readMemory(name: string): Memory | null {
  if (!existsSync(pathOf(name))) return null;
  return parse(name, readFileSync(pathOf(name), "utf-8"));
}

export function saveMemory(input: {
  type: MemoryType;
  hook: string;
  body: string;
  name?: string;
}): Memory {
  mkdirSync(MEMORY_DIR, { recursive: true });
  let name = input.name ?? slugify(input.hook);
  if (!name) name = `memory-${Date.now()}`;

  const existing = readMemory(name);
  const m: Memory = {
    name,
    type: input.type,
    hook: input.hook,
    body: input.body,
    created: existing?.created ?? today(),
    updated: today(),
  };
  writeFileSync(pathOf(name), render(m));
  rebuildIndex();
  return m;
}

/** Deletion is deliberate — callers must confirm with the user first. */
export function deleteMemory(name: string): boolean {
  if (!existsSync(pathOf(name))) return false;
  rmSync(pathOf(name));
  rebuildIndex();
  return true;
}

/**
 * The index is DERIVED — a browsable table of contents rebuilt from the
 * files at any time. Never the source of truth.
 */
export function rebuildIndex(): string {
  mkdirSync(MEMORY_DIR, { recursive: true });
  const memories = listMemories();
  const lines: string[] = [
    "# Memory index",
    "",
    "_Generated from the memory files — edit the files, not this list._",
    "",
  ];
  for (const type of MEMORY_TYPES) {
    const ofType = memories.filter((m) => m.type === type);
    if (!ofType.length) continue;
    lines.push(`## ${type}`, "");
    for (const m of ofType)
      lines.push(`- [${m.hook}](${m.name}.md) — updated ${m.updated}`);
    lines.push("");
  }
  if (memories.length === 0) lines.push("_No memories yet._", "");
  const text = lines.join("\n");
  writeFileSync(INDEX_PATH, text);
  return text;
}
