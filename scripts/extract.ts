/**
 * Catch-up extractor: processes every session the exit-hook missed (e.g.
 * closed with Ctrl+C). Run manually or from cron: npm run extract
 */
import { extractSession } from "../src/extractor.js";
import { listSessions } from "../src/session.js";

const pending = listSessions().filter((s) => !s.extracted && s.messages >= 4);
if (!pending.length) {
  console.log("Nothing to extract — all sessions processed.");
} else {
  for (const meta of pending) {
    console.log(`Extracting session ${meta.id} (${meta.messages} messages)…`);
    const { saved, duplicatesSkipped, skipped } = await extractSession(meta);
    if (skipped) console.log(`  (${skipped})`);
    for (const m of saved) console.log(`  + remembered: ${m.hook}`);
    if (duplicatesSkipped) console.log(`  (${duplicatesSkipped} near-duplicates skipped)`);
  }
}
