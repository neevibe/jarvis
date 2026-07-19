import { loadIdentity } from "./identity.js";

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
  const sections = [
    identity,
    // Tier 3 will render knowledge/*.md here.
    // Tier 8 will render the generated capability summary here.
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
