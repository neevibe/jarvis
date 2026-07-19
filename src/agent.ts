import { query } from "@anthropic-ai/claude-agent-sdk";
import { buildStableBlock, buildDynamicBlock } from "./prompt.js";

let sessionId: string | undefined;

export interface TurnUsage {
  inputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface TurnResult {
  text: string;
  sessionId: string | undefined;
  usage: TurnUsage | null;
}

/**
 * Runs one conversational turn. Each turn is its own query() call that resumes
 * the same underlying session:
 *  - the STABLE block is passed as the system prompt, byte-identical across
 *    turns, so the provider serves it from prompt cache;
 *  - the DYNAMIC block (time, per-turn state) is prepended to the user turn,
 *    where changing content belongs.
 */
export async function runTurn(userText: string): Promise<TurnResult> {
  const q = query({
    prompt: `${buildDynamicBlock()}\n\n${userText}`,
    options: {
      systemPrompt: buildStableBlock(),
      // Pure brain for now — no tools until the memory tiers add them.
      allowedTools: [],
      ...(sessionId ? { resume: sessionId } : {}),
    },
  });

  let text = "";
  let usage: TurnUsage | null = null;
  for await (const msg of q) {
    if (msg.type === "system" && msg.subtype === "init") {
      sessionId = msg.session_id;
    }
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "text") text += block.text;
      }
    }
    if (msg.type === "result" && "usage" in msg && msg.usage) {
      usage = {
        inputTokens: msg.usage.input_tokens ?? 0,
        cacheCreationTokens: msg.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
      };
    }
  }
  return { text, sessionId, usage };
}

export function resetSession(): void {
  sessionId = undefined;
}
