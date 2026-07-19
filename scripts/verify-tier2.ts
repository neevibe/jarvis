/**
 * Tier 2 verification — the two-block prompt:
 *
 * 1. Dynamic freshness: two turns ask for the current time (with seconds).
 *    The answers must differ — proof the dynamic block is rebuilt per turn.
 * 2. Cache reuse: turn 2+ must report cache_read_input_tokens > 0 — proof the
 *    stable block (the full identity) is served from prompt cache rather than
 *    re-billed, while still being present in full on every turn.
 */
import { runTurn } from "../src/agent.js";

const ask = "What is the current time, to the second? Reply with only the time.";

console.log("— Turn 1 —");
const t1 = await runTurn(ask);
console.log(`reply: ${t1.text.trim()}`);
console.log(`usage: input=${t1.usage?.inputTokens} cacheWrite=${t1.usage?.cacheCreationTokens} cacheRead=${t1.usage?.cacheReadTokens}\n`);

await new Promise((r) => setTimeout(r, 3000));

console.log("— Turn 2 (3s later, same session) —");
const t2 = await runTurn(ask);
console.log(`reply: ${t2.text.trim()}`);
console.log(`usage: input=${t2.usage?.inputTokens} cacheWrite=${t2.usage?.cacheCreationTokens} cacheRead=${t2.usage?.cacheReadTokens}\n`);

const fresh = t1.text.trim() !== t2.text.trim();
const cached = (t2.usage?.cacheReadTokens ?? 0) > 0;

console.log(fresh ? "✅ dynamic block is fresh each turn (times differ)"
                  : "❌ times identical — dynamic block not updating");
console.log(cached ? `✅ stable block served from cache on turn 2 (${t2.usage?.cacheReadTokens} tokens read from cache)`
                   : "❌ no cache reads on turn 2 — stable block is being re-billed");
process.exitCode = fresh && cached ? 0 : 1;
