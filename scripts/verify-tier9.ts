/**
 * Tier 9 verification — the personality checkpoint (structural, no model
 * calls: the injection logic is deterministic, so we verify it directly).
 *
 * 1. Short conversations: no checkpoint — it must not clutter normal chats.
 * 2. Deep conversations (past the threshold): checkpoint present in the
 *    dynamic extras, every turn from then on.
 * 3. Threshold is env-tunable (JARVIS_CHECKPOINT_AFTER).
 */
process.env.JARVIS_CHECKPOINT_AFTER = "6";
const { composeExtras, openEphemeralSession } = await import("../src/agent.js");

let ok = true;
const check = (cond: boolean, label: string) => {
  console.log(`${cond ? "✅" : "❌"} ${label}`);
  ok &&= cond;
};
const hasCheckpoint = (extras: string[]) =>
  extras.some((e) => e.includes("<personality-checkpoint>"));

const meta = openEphemeralSession();

meta.messages = 1;
check(!hasCheckpoint(await composeExtras(meta, "hello")), "turn 1: no checkpoint (short conversations stay clean)");

meta.messages = 5;
check(!hasCheckpoint(await composeExtras(meta, "still early")), "below threshold: still no checkpoint");

meta.messages = 6;
check(hasCheckpoint(await composeExtras(meta, "getting deep now")), "at threshold: checkpoint appears");

meta.messages = 30;
const deep = await composeExtras(meta, "way past threshold");
check(hasCheckpoint(deep), "deep conversation: checkpoint persists every turn");
check(
  deep.find((e) => e.includes("personality-checkpoint"))!.includes("length") &&
    deep.find((e) => e.includes("personality-checkpoint"))!.includes("voice"),
  "checkpoint audits both axes: length and voice",
);

process.exitCode = ok ? 0 : 1;
