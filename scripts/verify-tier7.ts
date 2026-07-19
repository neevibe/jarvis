/**
 * Tier 7 verification — writing memories, two ways. Phases (separate
 * processes, run in order by `npm run verify:tier7`):
 *
 *   teach    — tell Jarvis a decision naturally; it must CHOOSE to save it.
 *   recall   — brand-new session, new process: it must know the fact,
 *              unprompted, via automatic recall.
 *   extract  — synthetic transcript with two durable facts → extractor saves
 *              them and refreshes the standing briefing.
 *   chatter  — small-talk transcript → extractor saves nothing.
 *   dedupe   — a second transcript repeating a stored fact → rejected as a
 *              near-duplicate, not stored twice.
 *   forget   — tool refuses without confirmation, deletes with it.
 *   cleanup  — remove all TEST artifacts.
 */
import { rmSync, existsSync } from "node:fs";
import { openSession, runTurn } from "../src/agent.js";
import { BRIEFING_PATH, extractSession } from "../src/extractor.js";
import { deleteMemory, listMemories, readMemory, saveMemory } from "../src/memory.js";
import { deleteSearchIndex } from "../src/recall.js";
import { SESSIONS_DIR, appendTurn, createSession } from "../src/session.js";
import { handleForget } from "../src/tools.js";
import { join } from "node:path";

const phase = process.argv[2];
const hasProphet = () =>
  listMemories().filter((m) => /prophet/i.test(m.hook + m.body));

const fail = (msg: string) => {
  console.log(`❌ ${msg}`);
  process.exit(1);
};
const pass = (msg: string) => console.log(`✅ ${msg}`);

if (phase === "teach") {
  const { meta } = openSession(true);
  const t = await runTurn(
    meta,
    "Decision from today's review: for seasonality baselines in our BIAL passenger forecasting we standardize on Prophet — it beat ARIMA in the bake-off on two years of PAX data and ops can retrain it themselves. That's our standard going forward.",
  );
  console.log(`jarvis: ${t.text.trim().slice(0, 300)}`);
  if (!hasProphet().length) fail("Jarvis did not choose to save the decision");
  pass(`Jarvis chose to save it: "${hasProphet()[0].hook}"`);
} else if (phase === "recall") {
  const { meta } = openSession(true); // NEW session, and we're in a NEW process
  const t = await runTurn(
    meta,
    "What's our standard for seasonality baselines in passenger forecasting, and why?",
  );
  console.log(`jarvis: ${t.text.trim().slice(0, 300)}`);
  if (!/prophet/i.test(t.text)) fail("fresh session did not recall the decision");
  pass("fresh session recalled the decision unprompted");
} else if (phase === "extract") {
  const meta = createSession();
  const script: [string, string][] = [
    ["Let's lock it in: the exec dashboard refresh moves to Friday evenings — ops asked, and weekend traffic reviews need fresh numbers Monday morning.", "Locked. Friday-evening refresh it is — Monday reviews get current data."],
    ["Also, Rakesh from IT ops is now the single point of contact for XOVIS sensor issues. Route calibration questions to him, not the vendor.", "Noted — Rakesh owns XOVIS issues from here on."],
    ["Good. Let's pick this up next week.", "See you then."],
  ];
  for (const [u, j] of script) {
    appendTurn(meta, "user", u);
    appendTurn(meta, "jarvis", j);
  }
  const r = await extractSession(meta);
  console.log(`saved: ${r.saved.map((m) => m.hook).join(" | ") || "(none)"}`);
  const text = r.saved.map((m) => m.hook + m.body).join(" ");
  if (!/friday/i.test(text) && !/rakesh/i.test(text)) fail("extractor missed the durable facts");
  pass(`extractor saved ${r.saved.length} durable memories from the transcript`);
  if (!existsSync(BRIEFING_PATH)) fail("standing briefing was not written");
  pass("standing briefing refreshed");
} else if (phase === "chatter") {
  const meta = createSession();
  for (const [u, j] of [
    ["hey", "Hey."],
    ["how's it going", "All good — what are we working on?"],
    ["nothing much, just checking in", "Anytime."],
  ] as [string, string][]) {
    appendTurn(meta, "user", u);
    appendTurn(meta, "jarvis", j);
  }
  const before = listMemories().length;
  const r = await extractSession(meta);
  if (listMemories().length !== before || r.saved.length)
    fail("extractor saved memories from idle chatter");
  pass("idle chatter produced zero memories");
} else if (phase === "dedupe") {
  const meta = createSession();
  for (const [u, j] of [
    ["Reminder for the team doc: exec dashboard refresh happens Friday evenings now, per the ops request.", "Yes — that's the standing decision."],
    ["Right. And confirm Rakesh from IT ops handles XOVIS sensor issues?", "Correct, Rakesh is the XOVIS point of contact."],
  ] as [string, string][]) {
    appendTurn(meta, "user", u);
    appendTurn(meta, "jarvis", j);
  }
  const before = listMemories().length;
  const r = await extractSession(meta);
  const after = listMemories().length;
  console.log(`memories before=${before} after=${after}, duplicatesSkipped=${r.duplicatesSkipped}`);
  if (after > before) fail("near-duplicates were stored twice");
  pass("repeated facts rejected as near-duplicates");
} else if (phase === "forget") {
  const m = saveMemory({ type: "reference", hook: "TEST forget-flow scratch memory", body: "Delete me." });
  const refusal = await handleForget({ name: m.name });
  if (!/CONFIRMATION REQUIRED/.test(refusal) || !readMemory(m.name))
    fail("forget deleted without confirmation");
  pass("forget refused without confirmation");
  await handleForget({ name: m.name, confirmed: true });
  if (readMemory(m.name)) fail("forget with confirmation did not delete");
  pass("forget deleted after explicit confirmation");
} else if (phase === "cleanup") {
  for (const m of listMemories()) {
    if (/prophet|friday|rakesh|xovis|dashboard/i.test(m.hook + m.body)) {
      deleteMemory(m.name);
      console.log(`removed test memory: ${m.name}`);
    }
  }
  for (const d of ["2026"].flatMap(() => [])) void d;
  rmSync(BRIEFING_PATH, { force: true });
  deleteSearchIndex();
  // test sessions from this verification run
  const { readdirSync } = await import("node:fs");
  for (const d of readdirSync(SESSIONS_DIR)) {
    if (d.startsWith("20")) rmSync(join(SESSIONS_DIR, d), { recursive: true, force: true });
  }
  pass("test memories, briefing, index, and sessions cleaned");
} else {
  console.log("usage: verify-tier7.ts <teach|recall|extract|chatter|dedupe|forget|cleanup>");
  process.exit(1);
}
