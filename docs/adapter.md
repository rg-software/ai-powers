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
  "reviewBot": "ai-reviewer",            // fallback author match; the CI marker is primary
  "contract": "he9-review-contract"      // skill name; override only if you fork the contract
}
```

## What the adapter does not control

`tracker` and the other keys configure the **local commands** only. They do **not** reconfigure CI: the PR-review workflow is a forge-specific file (Gitea `.gitea/workflows/`, GitHub `.github/workflows/`) with its own variables and secrets. See `docs/ci.md`.

The reviewer's identity is not matched by `reviewBot` alone. The CI reviewer stamps every review with the marker `<!-- he9-reviewer:v1 -->`, and `he9_review respond` matches that marker first, falling back to `reviewBot` only when no marked comment exists. Renaming the token's user therefore does not break the cycle.

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

These are **repo variables/secrets** on the forge, used by the CI workflow:

| Name | Kind | Meaning |
|------|------|---------|
| `AI_POWERS_REPO` | var | `owner/ai-powers` to clone |
| `AI_POWERS_REF` | var | branch or commit SHA to use; the resolved SHA is recorded in the review footer |
| `AI_MODEL_NAME` | var | reviewer model |
| `AI_REVIEW_MENTION` | var, optional | comment text that triggers a manual review (default `@ai-reviewer`) |
| `OPENROUTER_API_KEY` | secret | model provider key |
| `AIR_GITEA_API_TOKEN` | secret | token used to post the review comment |

## CI note

The PR-review workflow reads the adapter from the **base** SHA, not the PR head, so a PR cannot rewrite the paths its own review is graded against.
