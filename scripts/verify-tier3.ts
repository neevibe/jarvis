/**
 * Tier 3 verification — core knowledge, always loaded:
 *
 * In a FRESH session (no conversation history), ask something answerable only
 * from a knowledge file — never mentioned this session. Jarvis must answer
 * directly, without asking. The fact used: GitHub username + work email,
 * which live in knowledge/me.md and nowhere in the identity file.
 */
import { openEphemeralSession, runTurn } from "../src/agent.js";

const session = openEphemeralSession();

console.log("— Fresh session; asking a knowledge-only question —");
const t = await runTurn(
  session,
  "What is my GitHub username, and what's my work email? One line, no questions back.",
);
console.log(`reply: ${t.text.trim()}\n`);

const hasGithub = t.text.toLowerCase().includes("neevibe");
const hasEmail = t.text.toLowerCase().includes("neeraj.p@bialairport.com");

console.log(hasGithub ? "✅ knows GitHub username (neevibe) — from knowledge/me.md"
                      : "❌ did not produce the GitHub username");
console.log(hasEmail ? "✅ knows work email — from knowledge/me.md"
                     : "❌ did not produce the work email");
process.exitCode = hasGithub && hasEmail ? 0 : 1;
