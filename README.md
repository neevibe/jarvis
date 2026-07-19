# Jarvis

A digital-twin agent with a durable identity and a real memory system, built on
the [Claude Agent SDK](https://docs.anthropic.com/en/api/agent-sdk/overview).

Most agents can *answer*. Jarvis is built to **stay itself** and **remember**:
a personality that doesn't drift in long conversations, knowledge it never has
to be told twice, working memory that survives restarts, and a long-term memory
it writes to and reads from on its own.

## Architecture

| Piece | Where | What it does |
|---|---|---|
| Living identity | `identity/jarvis.md` | Who the agent is, in plain prose. Re-read on every turn — edit it and the next response changes. No redeploy. |
| Two-block prompt | `src/prompt.ts` | Cached stable block (identity + knowledge) so the full personality is resident every turn, cheaply. Fresh dynamic block (time, state). |
| Core knowledge | `knowledge/` | Curated facts the agent always knows. Human-owned, read-only to the agent. |
| Working memory | `sessions/` | Persisted transcripts, bounded context window, session resume. |
| Long-term memory | `memory/` | One markdown file per durable fact — typed, hooked, human-editable. Files are the source of truth; the index is disposable. |

## Privacy by layout

Everything personal — `identity/`, `knowledge/`, `memory/`, `sessions/`,
`data/`, `.env` — is **gitignored from the first commit**. This repository
contains the brain's *code*; the brain's *contents* never leave the owner's
machine. `*.example.md` templates show the expected shape so you can raise
your own agent from a clone.

## Run it

```bash
npm install
cp identity/jarvis.example.md identity/jarvis.md   # then make it yours
npm run chat
```

Requires Node 20+ and a logged-in [Claude Code](https://claude.com/claude-code)
CLI (`claude /login`) — the SDK reuses its credentials.

## Status

Building in public, one verified tier at a time:

- [x] **Tier 1 — Living identity file** (edit mid-run, next reply reflects it)
- [x] **Tier 2 — Two-block cached system prompt** (identity cached & resident every turn; dynamic state stays fresh)
- [x] **Tier 3 — Core knowledge, always loaded** (answers from curated facts it was never told in-session)
- [x] **Tier 4 — Working memory that survives restarts** (resume across processes; bounded window with rolling summary)
- [x] **Tier 5 — Long-term memory store** (typed markdown files, human-editable, derived index)
- [x] **Tier 6 — Recall (keyword-first, semantic-ready)** (local search; disposable self-healing index)
- [x] **Tier 7 — Memory tools + automatic extractor** (saves decisions on its own; recalls them in fresh sessions; dedupes; skips chatter)
- [ ] Tier 8 — Self-knowledge
- [ ] Tier 9 — Personality checkpoint against drift
