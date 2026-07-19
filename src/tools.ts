import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  MEMORY_TYPES,
  deleteMemory,
  readMemory,
  saveMemory,
} from "./memory.js";
import { recall } from "./recall.js";

/**
 * Single source of truth for tool metadata — the MCP server registers from
 * this AND the self-knowledge block (Tier 8) is generated from it, so what
 * Jarvis claims it can do cannot drift from what is actually registered.
 */
export const TOOL_SPECS = {
  save_memory:
    "Save a durable fact to long-term memory the moment it appears: decisions Neeraj makes (with their reasoning), corrections he gives, durable facts about him/his work/his people, preferences, references. The body must record the fact, why it matters, and how to apply it.",
  recall_memory:
    "Search long-term memory. Use when past decisions, preferences, people, or project context could be relevant to the current question.",
  forget_memory:
    "Delete a memory by id. Deletion is deliberate: first call returns what would be deleted; you must get Neeraj's explicit confirmation, then call again with confirmed: true.",
} as const;

/** Handlers are exported plain so verification can unit-test them. */

export async function handleSave(args: {
  type: (typeof MEMORY_TYPES)[number];
  hook: string;
  body: string;
}): Promise<string> {
  const m = saveMemory(args);
  return `Saved memory "${m.name}" (${m.type}): ${m.hook}`;
}

export async function handleRecall(args: {
  query: string;
  type?: (typeof MEMORY_TYPES)[number];
}): Promise<string> {
  const hits = await recall(args.query, { limit: 5, type: args.type });
  if (!hits.length) return "No memories match that query.";
  return hits
    .map((h) => {
      const m = readMemory(h.name);
      return `[${h.type}] ${h.hook} (id: ${h.name})\n${m?.body ?? ""}`;
    })
    .join("\n\n---\n\n");
}

export async function handleForget(args: {
  name: string;
  confirmed?: boolean;
}): Promise<string> {
  const m = readMemory(args.name);
  if (!m) return `No memory named "${args.name}".`;
  if (!args.confirmed) {
    return `CONFIRMATION REQUIRED — not deleted. Tell Neeraj exactly what would be forgotten ("${m.hook}") and ask for his explicit yes. Only then call forget_memory again with confirmed: true.`;
  }
  deleteMemory(args.name);
  return `Forgotten: ${m.hook}`;
}

export const memoryServer = createSdkMcpServer({
  name: "memory",
  version: "1.0.0",
  tools: [
    tool(
      "save_memory",
      TOOL_SPECS.save_memory,
      {
        type: z.enum(MEMORY_TYPES).describe("What kind of memory this is"),
        hook: z.string().max(120).describe("One-line searchable summary"),
        body: z
          .string()
          .describe("The fact, why it matters, and how to apply it"),
      },
      async (args) => ({
        content: [{ type: "text", text: await handleSave(args) }],
      }),
    ),
    tool(
      "recall_memory",
      TOOL_SPECS.recall_memory,
      {
        query: z.string().describe("What to look for"),
        type: z.enum(MEMORY_TYPES).optional().describe("Narrow to one type"),
      },
      async (args) => ({
        content: [{ type: "text", text: await handleRecall(args) }],
      }),
    ),
    tool(
      "forget_memory",
      TOOL_SPECS.forget_memory,
      {
        name: z.string().describe("Memory id (file name without .md)"),
        confirmed: z
          .boolean()
          .optional()
          .describe("true only after Neeraj explicitly confirmed"),
      },
      async (args) => ({
        content: [{ type: "text", text: await handleForget(args) }],
      }),
    ),
  ],
});

export const MEMORY_TOOL_NAMES = [
  "mcp__memory__save_memory",
  "mcp__memory__recall_memory",
  "mcp__memory__forget_memory",
];
