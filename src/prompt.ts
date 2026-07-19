import { loadIdentity } from "./identity.js";

/**
 * Assembles the system prompt for one turn.
 *
 * Tier 1 shape: identity + current time. Tier 2 splits this into a cached
 * stable block (identity, core knowledge, capabilities) and an uncached
 * dynamic block (time, session state) — the seam is already here.
 */
export function buildSystemPrompt(): string {
  const identity = loadIdentity();
  const now = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });
  return `${identity}\n\n---\n\nCurrent date and time: ${now} (IST)`;
}
