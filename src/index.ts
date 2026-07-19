import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { openSession, runTurn } from "./agent.js";

const fresh = process.argv.includes("--new");
const { meta, resumed } = openSession(fresh);

console.log(
  resumed
    ? `Jarvis — online. Resuming session ${meta.id} (${meta.messages} messages so far).`
    : "Jarvis — online. New session.",
);
console.log("(Ctrl+C or 'exit' to quit; start over anytime with: npm run chat -- --new)\n");

const rl = readline.createInterface({ input: stdin, output: stdout });

while (true) {
  const userText = (await rl.question("you › ")).trim();
  if (!userText) continue;
  if (userText.toLowerCase() === "exit") break;

  const { text } = await runTurn(meta, userText);
  console.log(`\njarvis › ${text}\n`);
}

rl.close();
