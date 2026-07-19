/**
 * Tier 1 verification: edit the identity file MID-RUN (no restart) and prove
 * the very next response reflects the edit.
 *
 * 1. Turn 1 — ask who it is (baseline, original identity).
 * 2. Append a marker rule to identity/jarvis.md while the process keeps running.
 * 3. Turn 2 — the reply must obey the new rule (contain the marker token).
 * 4. Restore the identity file exactly as it was.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { runTurn } from "../src/agent.js";
import { IDENTITY_PATH } from "../src/identity.js";

const MARKER = "EDIT-LIVE-7";
const original = readFileSync(IDENTITY_PATH, "utf-8");

try {
  console.log("— Turn 1 (original identity) —");
  const t1 = await runTurn("In one sentence: who are you and whose twin are you?");
  console.log(t1.text, "\n");

  console.log(`— Editing identity mid-run: adding rule to end replies with "${MARKER}" —\n`);
  writeFileSync(
    IDENTITY_PATH,
    original +
      `\n## Temporary verification rule\n\nEnd every reply with the exact token: ${MARKER}\n`,
  );

  console.log("— Turn 2 (same process, no restart) —");
  const t2 = await runTurn("Say hello in one short sentence.");
  console.log(t2.text, "\n");

  const pass = t2.text.includes(MARKER);
  console.log(pass ? "✅ PASS — identity edit took effect on the next turn, no restart"
                   : "❌ FAIL — marker not found in turn 2 reply");
  process.exitCode = pass ? 0 : 1;
} finally {
  writeFileSync(IDENTITY_PATH, original);
  console.log("(identity file restored to original)");
}
