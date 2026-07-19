import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { complete } from "./llm.js";
import {
  MEMORY_TYPES,
  type Memory,
  type MemoryType,
  saveMemory,
} from "./memory.js";
import { recall, tokenize } from "./recall.js";
import {
  SESSIONS_DIR,
  type SessionMeta,
  allTurns,
  saveMeta,
} from "./session.js";

export const BRIEFING_PATH = join(SESSIONS_DIR, "briefing.md");

/**
 * The automatic extractor: when a session ends, a cheap model call reads the
 * transcript, proposes durable memories, rejects near-duplicates of what's
 * already stored, and skips sessions that are testing or idle chatter. It
 * also refreshes the standing briefing that opens every new session.
 */

const EXTRACT_SYSTEM = `You extract durable long-term memories from a conversation transcript between Neeraj and his agent Jarvis. You output ONLY a JSON array, nothing else.`;

const extractPrompt = (transcript: string) => `Read this transcript and extract facts worth remembering for MONTHS — not conversation notes.

SAVE ONLY:
- decisions Neeraj made, WITH the reasoning and context ("chose X over Y because Z")
- corrections Neeraj gave ("no, actually…")
- durable facts about Neeraj, his work, his projects, or named people
- stated preferences about how he wants things done
- references to external resources he uses

NEVER SAVE:
- transient task state, scheduling chit-chat, or the conversation itself
- greetings, small talk, or filler
- anything that looks like TESTING the system (codewords, "reply OK", marker tokens, verification phrases)
- secrets, credentials, credit-card or account numbers — under no circumstances

Output a JSON array (possibly empty). Each item:
{"type": one of ${JSON.stringify(MEMORY_TYPES)}, "hook": "one-line searchable summary (max 100 chars)", "body": "the fact, why it matters, and how to apply it"}

If the session is chatter, testing, or contains nothing durable: output []

TRANSCRIPT:
${transcript}`;

function parseProposals(
  raw: string,
): { type: MemoryType; hook: string; body: string }[] {
  const attempt = (s: string) => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };
  const arr = attempt(raw) ?? attempt(raw.match(/\[[\s\S]*\]/)?.[0] ?? "");
  if (!arr) return [];
  return arr.filter(
    (p): p is { type: MemoryType; hook: string; body: string } =>
      p &&
      MEMORY_TYPES.includes(p.type) &&
      typeof p.hook === "string" &&
      p.hook.length > 0 &&
      typeof p.body === "string" &&
      p.body.length > 0,
  );
}

/** Near-duplicate check against the existing store, on the way in. */
export async function isDuplicate(hook: string): Promise<boolean> {
  const hits = await recall(hook, { limit: 1 });
  if (!hits.length) return false;
  const maxScore = 3 * (tokenize(hook).length || 1); // all terms matching existing hooks
  return hits[0].score / maxScore >= 0.5;
}

export interface ExtractResult {
  saved: Memory[];
  duplicatesSkipped: number;
  skipped: string | null;
}

export async function extractSession(
  meta: SessionMeta,
): Promise<ExtractResult> {
  const turns = allTurns(meta);
  if (turns.length < 4) {
    meta.extracted = true;
    saveMeta(meta);
    return { saved: [], duplicatesSkipped: 0, skipped: "session too short" };
  }

  const transcript = turns.map((t) => `${t.role}: ${t.text}`).join("\n");
  const raw = await complete(extractPrompt(transcript), {
    system: EXTRACT_SYSTEM,
  });

  const saved: Memory[] = [];
  let duplicatesSkipped = 0;
  for (const p of parseProposals(raw)) {
    if (await isDuplicate(p.hook)) {
      duplicatesSkipped += 1;
      continue;
    }
    saved.push(saveMemory(p));
  }

  await refreshBriefing(transcript);
  meta.extracted = true;
  saveMeta(meta);
  return { saved, duplicatesSkipped, skipped: null };
}

/**
 * The standing briefing: a compact, auto-maintained summary of active
 * projects, open threads, and recent decisions — injected into the first
 * turn of every new session so Jarvis never starts from scratch.
 */
async function refreshBriefing(transcript: string): Promise<void> {
  const previous = loadBriefing();
  const briefing = await complete(
    `${previous ? `CURRENT BRIEFING:\n${previous}\n\n` : ""}LATEST SESSION TRANSCRIPT:\n${transcript}\n\nUpdate the briefing. Max 250 words. Sections: Active projects · Open threads · Recent decisions · Next steps. Merge, don't append — drop what's resolved or stale. If the transcript is testing or chatter, return the current briefing unchanged (or "(nothing yet)" if none). Output only the briefing.`,
    { system: "You maintain a standing briefing for an executive's agent." },
  );
  writeFileSync(BRIEFING_PATH, briefing + "\n");
}

export function loadBriefing(): string | null {
  if (!existsSync(BRIEFING_PATH)) return null;
  const text = readFileSync(BRIEFING_PATH, "utf-8").trim();
  return text && text !== "(nothing yet)" ? text : null;
}
