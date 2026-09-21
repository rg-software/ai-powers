# Project adapter

The `he9_*` commands need to know where a project keeps its conventions, specs, debt backlog, and tracker. That is **per-project** information, so it is committed to the project repo as `.opencode/powers.jsonc` — not stored on each machine, so it travels with the code and is visible to CI.

Machine-specific values (install paths, tokens, tracker host) are **never** in this file. They come from environment variables consumed by the installer and CI.

## Rule of thumb

| Describes | Lives | Committed |
|-----------|-------|-----------|
| Repo layout, conventions/specs/debt paths, base branch, tracker kind, review-bot username | `.opencode/powers.jsonc` in the project | yes |
| Install locations, tokens, tracker host/credentials | env vars, `~/.config/opencode/` | no |

## File

`.opencode/powers.jsonc`. Not an opencode config file — opencode only auto-loads `opencode.json(c)` in `.opencode/`, so `powers.jsonc` is inert data the commands read.

All keys are optional. A command uses the key if present, otherwise falls back to defaults, otherwise asks.

```jsonc
{
  "baseBranch": "develop",              // default: detect from origin/HEAD, else "main"
  "conventions": "openspec/conventions.md",
  "specs": "openspec/specs/*/spec.md",
  "debt": "docs/technical-debt.md",
  "docs": ["docs/*.md"],                // extra design docs to cross-check; optional
  "reviewDir": ".opencode/reviews",     // review/response run folders; gitignored
  "tracker": "gitea",                    // "gitea" | "github" | "none"
  "reviewBot": "ai-reviewer",            // username whose PR comments are treated as reviews
  "contract": "he9-review-contract"      // skill name; override only if you fork the contract
}
```

## How commands consume it

1. Read `.opencode/powers.jsonc` if it exists.
2. Apply defaults for missing keys.
3. If a *required* value is missing and has no default (e.g. `tracker` when a step needs one), ask the user once and offer to write it back into the adapter.

## Environment (per machine / CI)

| Variable | Used by | Meaning |
|----------|---------|---------|
| `REVIEWER_MODEL` | `@reviewer` subagent | model for local cross-model review |
| `AI_MODEL_NAME` | CI review workflow | model for the server-side reviewer |
| `GITEA_TOKEN` | `he9_push_pr`, `he9_debt` promote | tracker auth |
| `OPENCODE_CONFIG_DIR` | optional | override the global config dir the installer targets |

## CI note

The PR-review workflow reads the adapter from the **base** SHA, not the PR head, so a PR cannot rewrite the paths its own review is graded against.
