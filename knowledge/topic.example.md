# <Topic> (template)

Each `knowledge/*.md` file is a curated set of stable facts the agent should
ALWAYS know — rendered into the cached system prompt on every turn. Keep files
small and factual; one topic per file. The agent treats them as read-only.

Good candidates: who the owner is, the organization and key people, the data
and systems landscape, working preferences.

Bad candidates: anything transient (that's working memory), anything learned in
conversation (that's long-term memory), anything secret (that's nowhere).

Copy to `knowledge/<topic>.md` — real knowledge files are gitignored and never
leave the owner's machine.
