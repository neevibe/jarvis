/**
 * Tier 4 verification — working memory that survives. Three phases, each run
 * as a SEPARATE PROCESS by `npm run verify:tier4` (that's the point):
 *
 *   seed    — new persisted session; establish what we're working on.
 *   resume  — fresh process simulating a restart; Jarvis must still have the
 *             thread of what we were doing, unprompted.
 *   window  — run with a tiny JARVIS_WINDOW_MAX; after enough turns the
 *             rolling summary must kick in (bounded window) AND a fact from
 *             the compressed-away turns must survive via the summary.
 */
import { openSession, runTurn } from "../src/agent.js";
import { allTurns } from "../src/session.js";

const phase = process.argv[2];

if (phase === "seed") {
  const { meta } = openSession(true);
  const t = await runTurn(
    meta,
    "We're debugging the XOVIS queue model for Gate 14 — tomorrow we tune the wait-time threshold. Acknowledge in under ten words.",
  );
  console.log(`seeded session ${meta.id}`);
  console.log(`jarvis: ${t.text.trim()}`);
} else if (phase === "resume") {
  const { meta, resumed } = openSession(false);
  if (!resumed || meta.messages < 2) {
    console.log("❌ did not resume the previous session");
    process.exit(1);
  }
  console.log(`resumed session ${meta.id} in a NEW process (${meta.messages} messages)`);
  const t = await runTurn(meta, "Quick — what exactly were we just doing? One line.");
  console.log(`jarvis: ${t.text.trim()}`);
  const ok = /xovis|gate\s*14|queue/i.test(t.text);
  console.log(ok ? "✅ survived the restart — still has the thread"
                 : "❌ lost the thread after restart");
  process.exitCode = ok ? 0 : 1;
} else if (phase === "window") {
  const { meta } = openSession(true);
  await runTurn(meta, "The codeword is MANGO-42. Confirm with one word.");
  await runTurn(meta, "Filler turn one. Reply with just OK.");
  await runTurn(meta, "Filler turn two. Reply with just OK.");
  // With JARVIS_WINDOW_MAX=4 / KEEP=2, the next turn must trigger compression.
  const t = await runTurn(meta, "What is the codeword? One word only.");
  console.log(`jarvis: ${t.text.trim()}`);
  const summarized = Boolean(meta.summary) && (meta.summarizedThrough ?? 0) > 0;
  const recalled = /mango/i.test(t.text);
  console.log(summarized
    ? `✅ window bounded — ${meta.summarizedThrough} messages compressed into rolling summary`
    : "❌ window never compressed");
  console.log(recalled
    ? "✅ codeword survived compression via the summary"
    : "❌ codeword lost in compression");
  console.log(`(transcript intact on disk: ${allTurns(meta).length} messages)`);
  process.exitCode = summarized && recalled ? 0 : 1;
} else {
  console.log("usage: verify-tier4.ts <seed|resume|window>");
  process.exit(1);
}
