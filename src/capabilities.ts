import { existsSync, readdirSync } from "node:fs";
import { KNOWLEDGE_DIR } from "./knowledge.js";
import { listMemories } from "./memory.js";
import { TOOL_SPECS } from "./tools.js";

/**
 * Self-knowledge, generated from the running system — the tool list comes
 * from the same spec that registers the tools, so "what can you do?" is
 * answered from fact. The NOT-yet list is as load-bearing as the can-do
 * list: it's what stops Jarvis from claiming powers it doesn't have.
 */
export function buildCapabilities(): string {
  const knowledgeFiles = existsSync(KNOWLEDGE_DIR)
    ? readdirSync(KNOWLEDGE_DIR).filter(
        (f) => f.endsWith(".md") && !f.endsWith(".example.md"),
      )
    : [];
  const memoryCount = listMemories().length;

  return [
    "# Self-knowledge — your actual capabilities",
    "",
    "Generated from the running system. Never claim an ability that is not",
    "listed here; when asked for something below under 'Not yet possible',",
    "say so plainly and note it's a planned upgrade.",
    "",
    "## Tools you can call",
    ...Object.entries(TOOL_SPECS).map(
      ([name, desc]) => `- ${name}: ${desc.split(". ")[0]}.`,
    ),
    "",
    "## Built-in behaviors (no tool call needed)",
    "- Your identity lives in identity/jarvis.md; Neeraj can edit it and the change applies on your very next reply.",
    `- Core knowledge (${knowledgeFiles.join(", ") || "none yet"}) is loaded into every turn.`,
    "- Conversations are persisted as sessions; a restart resumes where you left off; long sessions compress into a rolling summary instead of overflowing.",
    "- Relevant long-term memories surface into your context automatically each turn.",
    "- When a session ends, an extractor distills durable facts into memory and refreshes the standing briefing that opens your next session.",
    `- You currently hold ${memoryCount} long-term ${memoryCount === 1 ? "memory" : "memories"}.`,
    "",
    "## Interface",
    "- Terminal chat on Neeraj's Mac (npm run chat). Text in, text out.",
    "",
    "## Not yet possible — say so when asked",
    "- Browsing the web or searching online",
    "- Reading or sending email",
    "- Accessing files, BIAL datasets, or databases (data/ integration is a planned tier)",
    "- Running code or shell commands",
    "- Voice input/output (planned next phase)",
    "- Calendar, phone, or messaging integrations",
  ].join("\n");
}
