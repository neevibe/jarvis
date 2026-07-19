/**
 * Tier 6 verification — recall with a safety net (no model calls):
 *
 * 1. Seed several memories; a keyword query must rank the right one first.
 * 2. Type filter narrows results.
 * 3. Delete the search index entirely → recall still works (auto-rebuild
 *    from the files — the index is derived, never the source of truth).
 * 4. Add a memory AFTER the index was built → recall sees it (staleness
 *    detection self-heals).
 */
import { existsSync } from "node:fs";
import { deleteMemory, saveMemory } from "../src/memory.js";
import { SEARCH_INDEX_PATH, buildSearchIndex, deleteSearchIndex, recall } from "../src/recall.js";

let ok = true;
const check = (cond: boolean, label: string) => {
  console.log(`${cond ? "✅" : "❌"} ${label}`);
  ok &&= cond;
};

const seeded = [
  saveMemory({
    type: "decision",
    hook: "TEST — chose XGBoost over LSTM for the Gate 14 queue model",
    body: "Gradient boosting beat the LSTM on sparse sensor data; simpler to retrain and explain to operations leadership.",
  }),
  saveMemory({
    type: "preference",
    hook: "TEST — executive summaries first, detail after",
    body: "Neeraj wants the recommendation up front; supporting analysis follows.",
  }),
  saveMemory({
    type: "person",
    hook: "TEST — vendor contact for XOVIS sensor calibration",
    body: "Calibration questions go to the XOVIS vendor team.",
  }),
];

// 1 — keyword relevance
const q1 = await recall("what did we decide about the queue model");
check(q1.length > 0 && q1[0].hook.includes("XGBoost"), `keyword query ranks the right memory first (${q1[0]?.name})`);

// 2 — type filter
const q2 = await recall("XOVIS", { type: "person" });
check(q2.length === 1 && q2[0].type === "person", "type filter narrows to the person memory");

// 3 — index is disposable
deleteSearchIndex();
check(!existsSync(SEARCH_INDEX_PATH), "search index deleted");
const q3 = await recall("gate 14 XGBoost decision");
check(q3.length > 0 && q3[0].hook.includes("XGBoost") && existsSync(SEARCH_INDEX_PATH), "recall auto-rebuilt the index from the files, intact");

// 4 — staleness self-heal
buildSearchIndex();
await new Promise((r) => setTimeout(r, 20)); // ensure newer mtime than the index
const late = saveMemory({
  type: "project",
  hook: "TEST — briefing dashboard refresh moved to Fridays",
  body: "Refresh cadence decision for the exec dashboard.",
});
const q4 = await recall("when does the briefing dashboard refresh");
check(q4.some((h) => h.name === late.name), "memory added after index build is still found (stale index self-heals)");

// cleanup
for (const m of [...seeded, late]) deleteMemory(m.name);
deleteSearchIndex();
const q5 = await recall("XGBoost");
check(q5.length === 0, "store and index clean after the test");

process.exitCode = ok ? 0 : 1;
