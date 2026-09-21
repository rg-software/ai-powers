# Project inputs

The `he9_*` commands need to know a project's base branch, where its conventions, specs, and debt backlog live, and which forge it uses. **None of that is required configuration.** The commands probe the standard layout and infer the rest; the adapter file exists only to override.

## How inputs are resolved

| Input | Default | Override |
|-------|---------|----------|
| `baseBranch` | `origin/HEAD`, else `main` | `baseBranch` |
| `conventions` | `openspec/conventions.md` if present | `conventions` |
| `specs` | `openspec/specs/*/spec.md` if present | `specs` |
| `debt` | `docs/technical-debt.md` if present | `debt` |
| `docs` | `docs/*.md` if present | `docs` |
| `reviewDir` | `.opencode/reviews` (created and gitignored on demand) | `reviewDir` |
| `tracker` | auto: a configured forge MCP, else the git remote host, else ask | `tracker` |
| `contract` | `he9-review-contract` | `contract` |

A probed path that does not exist is **skipped**, never guessed: if a project has no specs directory, the steps that would read specs simply do not run, and the command says so.

## The adapter file (optional)

`.opencode/powers.jsonc`. Not an opencode config file — opencode only auto-loads `opencode.json(c)` in `.opencode/`, so `powers.jsonc` is inert data the commands read. It contains **overrides only**; anything omitted is probed as above. See `examples/powers.jsonc` for the full annotated shape.

Standard-layout projects need no adapter at all. Create it when a project deviates: a non-standard conventions path, a specs layout outside `openspec/`, a different base branch, or an explicit `tracker` when auto-detection is ambiguous.

## Tracker

`tracker` selects the tooling the **local commands** use for issues and pull requests:

- `he9_start`, `he9_debt` list/open issues
- `he9_push_pr` creates and finds pull requests
- `he9_review respond` reads PR review comments

Auto-detection order: a configured forge MCP (e.g. a `gitea` MCP server) → the git remote host → ask the user once. Set `tracker` explicitly only when that is wrong or ambiguous (e.g. a self-hosted forge with an unrecognisable hostname).

## What the adapter does not control

The keys configure the **local commands** only. They do **not** reconfigure CI: the PR-review workflow is a forge-specific file (Gitea `.gitea/workflows/`, GitHub `.github/workflows/`) with its own variables and secrets. See `docs/ci.md`.

The reviewer's identity is not configurable here and not matched by user name. The CI reviewer stamps every review with the marker `<!-- he9-reviewer:v1 -->`, and `he9_review respond` matches that marker. Renaming the token's user does not affect the cycle.

## Environment (per machine / forge)

| Variable | Used by | Meaning |
|----------|---------|---------|
| `REVIEWER_MODEL` | `@reviewer` subagent | model for local cross-model review |
| `GITEA_TOKEN` | `he9_push_pr`, `he9_debt` promote | tracker auth |
| `OPENCODE_CONFIG_DIR` | optional | override the global config dir the installer targets |

CI-only variables and secrets are listed in `docs/ci.md`.
