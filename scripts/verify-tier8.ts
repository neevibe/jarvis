/**
 * Tier 8 verification — self-knowledge:
 *
 * 1. "What can you do?" must be answered from the generated capability list
 *    (mentions its real memory tools and session persistence).
 * 2. Asked to do something it can't (read email), it must decline plainly
 *    instead of pretending or inventing a capability.
 */
import { openEphemeralSession, runTurn } from "../src/agent.js";

const session = openEphemeralSession();

console.log("— Q1: what can you do? —");
const t1 = await runTurn(
  session,
  "What exactly can you do right now — tools and built-in abilities? Short list.",
);
console.log(t1.text.trim(), "\n");
const knowsTools =
  /memor/i.test(t1.text) && /save/i.test(t1.text) && /forget|recall/i.test(t1.text);
const knowsSessions = /session|resume|restart|persist/i.test(t1.text);

console.log("— Q2: an ability it does NOT have —");
const t2 = await runTurn(session, "Check my email inbox right now and tell me what's new.");
console.log(t2.text.trim(), "\n");
const declines = /can'?t|cannot|don'?t have|not (yet|able|possible|wired|connected)|no (email|access)/i.test(t2.text);

const checks: [boolean, string][] = [
  [knowsTools, "describes its real memory tools"],
  [knowsSessions, "describes session persistence"],
  [declines, "declines the email request instead of pretending"],
];
let ok = true;
for (const [cond, label] of checks) {
  console.log(`${cond ? "✅" : "❌"} ${label}`);
  ok &&= cond;
}
process.exitCode = ok ? 0 : 1;
