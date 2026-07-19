import { query } from "@anthropic-ai/claude-agent-sdk";

/**
 * One-shot completion on a small fast model — used for background chores
 * (summaries, extraction, briefings), never for Jarvis's own voice.
 */
export async function complete(
  prompt: string,
  opts: { system?: string; model?: string } = {},
): Promise<string> {
  const q = query({
    prompt,
    options: {
      model: opts.model ?? "haiku",
      allowedTools: [],
      maxTurns: 1,
      ...(opts.system ? { systemPrompt: opts.system } : {}),
    },
  });
  let out = "";
  for await (const msg of q) {
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "text") out += block.text;
      }
    }
  }
  return out.trim();
}
