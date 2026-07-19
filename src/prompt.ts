import { buildCapabilities } from "./capabilities.js";
import { loadIdentity } from "./identity.js";
import { loadKnowledge } from "./knowledge.js";
import { MEMORY_TYPES, listMemories } from "./memory.js";

const MEMORY_GUIDANCE = `# Memory

You have a long-term memory: tools save_memory, recall_memory, forget_memory.

SAVE — the moment it appears, without being asked: decisions Neeraj makes
(always with the reasoning: "chose X over Y because Z"), corrections he gives
you, durable facts about him / his work / named people, his preferences, and
references he uses. The body records the fact, why it matters, and how to
apply it.

DO NOT SAVE: transient task state, the current conversation itself, anything
already in your core knowledge, small talk — and NEVER credentials, secrets,
or credit-card/account numbers, even if asked.

FORGET: only when Neeraj asks. First tell him exactly what would be deleted
and get his explicit yes; only then call forget_memory with confirmed: true.

RECALL: relevant memories are surfaced to you automatically each turn; use
recall_memory yourself when past decisions, people, or project context might
matter and nothing surfaced.`;

function renderMemoryIndex(): string {
  const memories = listMemories();
  if (!memories.length) return `${MEMORY_GUIDANCE}\n\nYour memory is currently empty.`;
  const lines = [MEMORY_GUIDANCE, "", "Everything you currently remember (hooks only — recall_memory for details):"];
  for (const type of MEMORY_TYPES) {
    const ofType = memories.filter((m) => m.type === type);
    if (ofType.length)
      lines.push(...ofType.map((m) => `- [${type}] ${m.hook} (id: ${m.name})`));
  }
  return lines.join("\n");
}

/**
 * Two-block prompt assembly.
 *
 * STABLE BLOCK — becomes the system prompt. Contains the full identity (and,
 * in later tiers, core knowledge and the capability list). It must stay
 * byte-identical across turns so the provider's prompt cache serves it
 * cheaply — which is what lets the entire personality stay resident on every
 * turn. It only changes when a human edits the underlying files, and then the
 * next turn picks it up (one deliberate cache refresh).
 *
 * DYNAMIC BLOCK — prepended to each user turn. Current time and per-turn
 * state. Never put anything time-varying in the stable block: a single
 * changing byte there invalidates the cache from that point on.
 */

export function buildStableBlock(): string {
  const identity = loadIdentity();
  const knowledge = loadKnowledge();
  const sections = [
    identity,
    ...(knowledge ? [knowledge] : []),
    renderMemoryIndex(),
    buildCapabilities(),
  ];
  return sections.join("\n\n---\n\n");
}

export function buildDynamicBlock(): string {
  const now = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "medium", // includes seconds — verifiably fresh each turn
  });
  return [
    "<current-state>",
    `Current date and time: ${now} (IST)`,
    "</current-state>",
  ].join("\n");
}
