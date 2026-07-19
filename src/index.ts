import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runTurn } from "./agent.js";

const rl = readline.createInterface({ input: stdin, output: stdout });

console.log("Jarvis — online. (Ctrl+C or 'exit' to quit)\n");

while (true) {
  const userText = (await rl.question("you › ")).trim();
  if (!userText) continue;
  if (userText.toLowerCase() === "exit") break;

  const { text } = await runTurn(userText);
  console.log(`\njarvis › ${text}\n`);
}

rl.close();
