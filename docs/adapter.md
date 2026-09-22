# Project inputs

The `he9_*` commands need to know a project's base branch, where its conventions, specs, and debt backlog live, and which forge it uses. **None of that is required configuration.** The commands probe the standard layout and infer the rest; the adapter file exists only to override.

## How inputs are resolved

| Input | Default | Override |
|-------|---------|----------|
| `baseBranch` | `origin/HEAD`; ask if unset | `baseBranch` |
| `conventions` | `openspec/conventions.md` if present | `conventions` |
| `specs` | `openspec/specs/*/spec.md` if present | `specs` |
| `debt` | `openspec/technical-debt.md` if present | `debt` |
| `docs` | `docs/*.md` if present | `docs` |
| `reviewDir` | `.opencode/reviews` (created and gitignored on demand) | `reviewDir` |
| `tracker` | auto: a configured forge MCP, else the git remote host, else ask | `tracker` |
| `contract` | `he9-review-contract` | `contract` |

A probed path that does not exist is **skipped**, never guessed: if a project has no specs directory, the steps that would read specs simply do not run, and the command says so.

`baseBranch` is different, because its fallback is not a path. `origin/HEAD` is a **local symbolic ref** (`refs/remotes/origin/HEAD`) that `git clone` creates — so it is absent in a repo set up with `git init` + `git remote add`, in a bare/mirror clone, or when nobody has run `git remote set-head origin -a`; it can also be stale if the remote's default branch changed. A wrong base branch silently produces a wrong diff, and in `he9_push_pr` a PR against the wrong target, so when neither the adapter nor `origin/HEAD` yields one the commands **ask instead of guessing**.

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
| `REVIEWER_MODEL` | `@reviewer` subagent | model for local cross-model review; see "Local reviewer agent" below |
| `GITEA_TOKEN` | `he9_push_pr`, `he9_debt` promote | tracker auth |
| `OPENCODE_CONFIG_DIR` | optional | override the global config dir the installer targets |

CI-only variables and secrets are listed in `docs/ci.md`.

## Local reviewer agent

`he9_review`'s review mode invokes a **`reviewer` subagent**, so the local cycle is a cross-model review rather than the author grading their own work. This is **project config — ai-powers does not install it.** Define it in the project's `opencode.jsonc` (or `.opencode/opencode.json`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "reviewer": {
      "mode": "subagent",
      "description": "Reviews code for best practices.",
      "model": "{env:REVIEWER_MODEL}",
      "permission": { "read": "allow", "edit": "deny" }
    }
  }
}
```

Notes:

- The key is `agent` (singular). `agents` is silently ignored.
- `{env:REVIEWER_MODEL}` interpolates the environment variable at load time, keeping the model id out of the repo — it is deliberately machine-specific and not pinned here.
- Set it in your shell (e.g. `REVIEWER_MODEL=anthropic/claude-sonnet-4-6`), then restart opencode; config is loaded at startup.
- `read: allow` lets the reviewer inspect the diff and specs; `edit: deny` stops a review from modifying the code it is judging. If your project's permissions are restrictive, the reviewer also needs `bash` to scope the target with `git`.

A ready-to-copy file is at `examples/reviewer-agent.jsonc`. Without this agent `he9_review` cannot start; it names the prerequisite and offers a self-review fallback instead of failing with a raw subagent-not-found error.

## The debt document is the action log

Both flows converge on the resolved `debt` file, which is the single log of outstanding work:

- **Feeds it:** `he9_debt scan` records new debt; `he9_review` writes the findings whose action is `defer-debt`, each carrying the finding id and the review that produced it.
- **Maintains it:** `he9_debt triage` dedupes, clarifies, re-prioritises, advances status, and re-checks entries against the code for staleness.
- **Drains it:** `he9_debt promote <item>` turns one entry into a focused issue or spec change.
- **Never enters it:** `fix-now` findings — those are the branch's work, not deferred.

Both flows share one shape: **identify** with the separate `reviewer` party, **dispose** with the responder party, then **act**. The reviewer party is what makes a list doubly-checked rather than self-confirmed — a scan that both finds and approves its own findings is the weakest possible review.
