/**
 * Tier 5 verification — the long-term memory store:
 *
 * 1. Save a memory → lands as a readable markdown file with type, hook, and
 *    body, and appears in the generated index.
 * 2. Human edit — modify the FILE by hand (that's the contract: files are the
 *    source of truth) → reload sees the edit; rebuilt index reflects it.
 * 3. Delete → file gone, index updated.
 * No model calls; this tier is pure storage.
 */
import { readFileSync } from "node:fs";
import {
  INDEX_PATH,
  MEMORY_DIR,
  deleteMemory,
  listMemories,
  readMemory,
  rebuildIndex,
  saveMemory,
} from "../src/memory.js";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

let ok = true;
const check = (cond: boolean, label: string) => {
  console.log(`${cond ? "✅" : "❌"} ${label}`);
  ok &&= cond;
};

// 1 — save
const m = saveMemory({
  type: "decision",
  hook: "TEST — codeword for tier-5 verification is TAMARIND",
  body: "**The fact.** Verification memory.\n\n**Why it matters.** Proves the store works.\n\n**How to apply it.** Delete after the test.",
});
const onDisk = readMemory(m.name);
check(onDisk !== null, `memory file exists: memory/${m.name}.md`);
check(onDisk?.type === "decision" && onDisk.hook.includes("TAMARIND"), "type + hook parsed back from the file");
check(onDisk?.body.includes("Why it matters") ?? false, "body carries why-it-matters");
check(readFileSync(INDEX_PATH, "utf-8").includes(m.hook), "hook appears in generated index");

// 2 — hand edit the file, as a human would
const raw = readFileSync(join(MEMORY_DIR, `${m.name}.md`), "utf-8");
writeFileSync(
  join(MEMORY_DIR, `${m.name}.md`),
  raw.replace("TAMARIND", "TAMARIND-CORRECTED"),
);
rebuildIndex();
check(readMemory(m.name)?.hook.includes("TAMARIND-CORRECTED") ?? false, "hand-edit to the file is authoritative on reload");
check(readFileSync(INDEX_PATH, "utf-8").includes("TAMARIND-CORRECTED"), "rebuilt index reflects the hand edit");

// 3 — delete
deleteMemory(m.name);
check(readMemory(m.name) === null, "delete removes the file");
check(!readFileSync(INDEX_PATH, "utf-8").includes("TAMARIND"), "index no longer lists it");
check(listMemories().every((x) => !x.hook.includes("TAMARIND")), "store is clean after the test");

process.exitCode = ok ? 0 : 1;
