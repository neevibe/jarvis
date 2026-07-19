import { query } from "@anthropic-ai/claude-agent-sdk";
import { loadBriefing } from "./extractor.js";
import { complete } from "./llm.js";
import { readMemory } from "./memory.js";
import { buildStableBlock, buildDynamicBlock } from "./prompt.js";
import { recall } from "./recall.js";
import { MEMORY_TOOL_NAMES, memoryServer } from "./tools.js";
import {
  type SessionMeta,
  allTurns,
  appendTurn,
  createSession,
  latestSession,
  saveMeta,
} from "./session.js";

/**
 * The active window is bounded: once a session exceeds WINDOW_MAX_MESSAGES
 * beyond what the rolling summary covers, older turns are compressed into the
 * summary (cheap model call) and the engine session is reseeded — recent
 * turns stay verbatim, nothing is silently dropped.
 */
const WINDOW_MAX_MESSAGES = Number(process.env.JARVIS_WINDOW_MAX ?? 120);
const KEEP_MESSAGES = Number(process.env.JARVIS_WINDOW_KEEP ?? 10);

export interface TurnUsage {
  inputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface TurnResult {
  text: string;
  usage: TurnUsage | null;
}

/** Resume the most recent session unless a fresh one is requested. */
export function openSession(fresh = false): {
  meta: SessionMeta;
  resumed: boolean;
} {
  if (!fresh) {
    const last = latestSession();
    if (last) return { meta: last, resumed: true };
  }
  return { meta: createSession(), resumed: false };
}

/** In-memory session for tests/verification — never touches disk. */
export function openEphemeralSession(): SessionMeta {
  return createSession(true);
}

async function exec(
  meta: SessionMeta,
  prompt: string,
  resume: string | undefined,
): Promise<TurnResult> {
  const q = query({
    prompt,
    options: {
      systemPrompt: buildStableBlock(),
      mcpServers: { memory: memoryServer },
      allowedTools: MEMORY_TOOL_NAMES,
      ...(resume ? { resume } : {}),
    },
  });

  let text = "";
  let usage: TurnUsage | null = null;
  for await (const msg of q) {
    if (msg.type === "system" && msg.subtype === "init") {
      meta.sdkSessionId = msg.session_id;
    }
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "text") text += block.text;
      }
    }
    if (msg.type === "result" && "usage" in msg && msg.usage) {
      usage = {
        inputTokens: msg.usage.input_tokens ?? 0,
        cacheCreationTokens: msg.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
      };
    }
  }
  return { text, usage };
}

async function summarize(text: string): Promise<string> {
  return complete(
    `Compress this conversation transcript. Preserve decisions (and why), facts, names, numbers, and open threads. Drop pleasantries. Output only the summary.\n\n${text}`,
    { system: "You compress conversation transcripts into dense, faithful summaries." },
  );
}

/** Local keyword recall, surfaced into the turn automatically — the "never re-brief me" mechanism. */
async function recalledContext(userText: string): Promise<string | null> {
  const hits = (await recall(userText, { limit: 3 })).filter((h) => h.score >= 4);
  if (!hits.length) return null;
  const rendered = hits.map((h) => {
    const body = readMemory(h.name)?.body ?? "";
    return `[${h.type}] ${h.hook} (id: ${h.name})\n${body.slice(0, 500)}`;
  });
  return [
    "<recalled-memories>",
    "Surfaced from your long-term memory as possibly relevant (use recall_memory for more):",
    "",
    rendered.join("\n\n"),
    "</recalled-memories>",
  ].join("\n");
}

function renderTurns(turns: ReturnType<typeof allTurns>): string {
  return turns.map((t) => `${t.role}: ${t.text}`).join("\n");
}

/** Summary + recent verbatim turns — how a reseeded/recovered session re-enters context. */
function sessionContext(meta: SessionMeta, excludeLast: number): string {
  const turns = allTurns(meta);
  const covered = meta.summarizedThrough ?? 0;
  const recent = turns.slice(covered, turns.length - excludeLast).slice(-KEEP_MESSAGES);
  return [
    "<session-context>",
    "You are mid-conversation; this restores your working memory of it.",
    ...(meta.summary ? ["", "Summary of the conversation so far:", meta.summary] : []),
    ...(recent.length ? ["", "Most recent turns, verbatim:", renderTurns(recent)] : []),
    "</session-context>",
  ].join("\n");
}

/** Compress old turns into the rolling summary once the window overflows. */
async function boundWindow(meta: SessionMeta): Promise<boolean> {
  if (meta.ephemeral) return false;
  const covered = meta.summarizedThrough ?? 0;
  if (meta.messages - covered <= WINDOW_MAX_MESSAGES) return false;

  const turns = allTurns(meta);
  const cut = Math.max(covered, turns.length - KEEP_MESSAGES);
  const old = turns.slice(covered, cut);
  if (!old.length) return false;

  const prior = meta.summary ? `Prior summary:\n${meta.summary}\n\n` : "";
  meta.summary = await summarize(prior + renderTurns(old));
  meta.summarizedThrough = cut;
  meta.sdkSessionId = undefined; // fresh engine session, seeded from the summary
  saveMeta(meta);
  return true;
}

export async function runTurn(
  meta: SessionMeta,
  userText: string,
): Promise<TurnResult> {
  appendTurn(meta, "user", userText);
  const reseeded = await boundWindow(meta);

  const extras: string[] = [];
  if (meta.messages === 1) {
    const briefing = loadBriefing();
    if (briefing)
      extras.push(`<standing-briefing>\nWhere things stand, from your last sessions:\n\n${briefing}\n</standing-briefing>`);
  }
  const recalled = await recalledContext(userText);
  if (recalled) extras.push(recalled);

  const needsContext = reseeded || (!meta.sdkSessionId && meta.messages > 1);
  const prompt = [
    buildDynamicBlock(),
    ...(needsContext ? [sessionContext(meta, 1)] : []),
    ...extras,
    userText,
  ].join("\n\n");

  let result: TurnResult;
  try {
    result = await exec(meta, prompt, meta.sdkSessionId);
  } catch (err) {
    if (!meta.sdkSessionId) throw err;
    // Engine session unrecoverable (e.g. its storage was cleaned) — degrade
    // gracefully: rebuild context from our own transcript, never go blind.
    meta.sdkSessionId = undefined;
    result = await exec(
      meta,
      [buildDynamicBlock(), sessionContext(meta, 1), userText].join("\n\n"),
      undefined,
    );
  }

  appendTurn(meta, "jarvis", result.text);
  saveMeta(meta);
  return result;
}
