import { query } from "@anthropic-ai/claude-agent-sdk";
import { buildSystemPrompt } from "./prompt.js";

let sessionId: string | undefined;

export interface TurnResult {
  text: string;
  sessionId: string | undefined;
}

/**
 * Runs one conversational turn. Each turn is its own query() call that resumes
 * the same underlying session, so the system prompt is reassembled fresh every
 * turn (this is what makes the identity file "living") while conversation
 * history carries forward.
 */
export async function runTurn(userText: string): Promise<TurnResult> {
  const q = query({
    prompt: userText,
    options: {
      systemPrompt: buildSystemPrompt(),
      // Pure brain for now — no tools until the memory tiers add them.
      allowedTools: [],
      ...(sessionId ? { resume: sessionId } : {}),
    },
  });

  let text = "";
  for await (const msg of q) {
    if (msg.type === "system" && msg.subtype === "init") {
      sessionId = msg.session_id;
    }
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "text") text += block.text;
      }
    }
  }
  return { text, sessionId };
}

export function resetSession(): void {
  sessionId = undefined;
}
