import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SESSIONS_DIR = join(ROOT, "sessions");

export interface Turn {
  role: "user" | "jarvis";
  text: string;
  at: string;
}

export interface SessionMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Total persisted messages (user + jarvis). */
  messages: number;
  /** Engine session to resume across process restarts. */
  sdkSessionId?: string;
  /** Rolling summary of messages older than the active window. */
  summary?: string;
  /** How many transcript messages the summary already covers. */
  summarizedThrough?: number;
  /** True → nothing touches disk (used by verification scripts). */
  ephemeral?: boolean;
}

const dirOf = (id: string) => join(SESSIONS_DIR, id);
const metaPath = (id: string) => join(dirOf(id), "meta.json");
const transcriptPath = (id: string) => join(dirOf(id), "transcript.jsonl");

export function createSession(ephemeral = false): SessionMeta {
  const now = new Date().toISOString();
  const meta: SessionMeta = {
    id: now.replace(/[:.]/g, "-"),
    createdAt: now,
    updatedAt: now,
    messages: 0,
    ...(ephemeral ? { ephemeral: true } : {}),
  };
  if (!ephemeral) {
    mkdirSync(dirOf(meta.id), { recursive: true });
    saveMeta(meta);
  }
  return meta;
}

export function saveMeta(meta: SessionMeta): void {
  if (meta.ephemeral) return;
  writeFileSync(metaPath(meta.id), JSON.stringify(meta, null, 2) + "\n");
}

export function latestSession(): SessionMeta | null {
  if (!existsSync(SESSIONS_DIR)) return null;
  const ids = readdirSync(SESSIONS_DIR)
    .filter((d) => existsSync(metaPath(d)))
    .sort()
    .reverse();
  return ids.length
    ? (JSON.parse(readFileSync(metaPath(ids[0]), "utf-8")) as SessionMeta)
    : null;
}

/** Persisted BEFORE the model call, so a crash mid-turn loses nothing. */
export function appendTurn(
  meta: SessionMeta,
  role: Turn["role"],
  text: string,
): void {
  meta.messages += 1;
  meta.updatedAt = new Date().toISOString();
  if (meta.ephemeral) return;
  const turn: Turn = { role, text, at: meta.updatedAt };
  appendFileSync(transcriptPath(meta.id), JSON.stringify(turn) + "\n");
  saveMeta(meta);
}

export function allTurns(meta: SessionMeta): Turn[] {
  if (meta.ephemeral || !existsSync(transcriptPath(meta.id))) return [];
  return readFileSync(transcriptPath(meta.id), "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Turn);
}
