# Project inputs

The `he9-*` skills need to know a project's base branch, where its conventions, specs, and debt backlog live, and which forge it uses. **None of that is required configuration.** The skills probe the standard layout and infer the rest; the adapter file exists only to override.

## How inputs are resolved

| Input | Default | Override |
|-------|---------|----------|
| `baseBranch` | `origin/HEAD`; ask if unset | `baseBranch` |
| `conventions` | `openspec/conventions.md` if present | `conventions` |
| `specs` | `openspec/specs/*/spec.md` if present | `specs` |
| `debt` | `openspec/technical-debt.md` if present | `debt` |
| `docs` | `docs/*.md` if present | `docs` |
| `tracker` | auto: the git remote host's forge, else ask | `tracker` (a forge name: `github`, `gitea`, `gitlab`) |
| `contract` | `he9-review-contract` | `contract` |

A probed path that does not exist is **skipped**, never guessed: if a project has no specs directory, the steps that would read specs simply do not run, and the command says so.

`baseBranch` is different, because its fallback is not a path. `origin/HEAD` is a **local symbolic ref** (`refs/remotes/origin/HEAD`) that `git clone` creates — so it is absent in a repo set up with `git init` + `git remote add`, in a bare/mirror clone, or when nobody has run `git remote set-head origin -a`; it can also be stale if the remote's default branch changed. A wrong base branch silently produces a wrong diff, and in `he9-push-pr` a PR against the wrong target, so when neither the adapter nor `origin/HEAD` yields one the commands **ask instead of guessing**.

## The adapter file (optional)

`.opencode/powers.jsonc`. Not an opencode config file — opencode only auto-loads `opencode.json(c)` in `.opencode/`, so `powers.jsonc` is inert data the commands read. It contains **overrides only**; anything omitted is probed as above. See `examples/powers.jsonc` for the full annotated shape.

Standard-layout projects need no adapter at all. Create it when a project deviates: a non-standard conventions path, a specs layout outside `openspec/`, a different base branch, or an explicit `tracker` when auto-detection is ambiguous.

## Tracker

`tracker` selects the forge the **local skills** use for issues and pull requests:

- `he9-start`, `he9-debt` list/open issues
- `he9-push-pr` creates and finds pull requests
- `he9-review respond` reads PR review comments

### How it resolves

The procedure is defined in the `he9-review-contract` skill, which every workflow loads — that is the copy the model reads, and it ships with the install. Summarised here for humans:

1. **Explicit** — `tracker` in `.opencode/powers.jsonc` wins: `"gitea"`, `"github"`, or `"gitlab"`.
2. **Git remote host** — read `git remote get-url origin` and match the host. `github.com` → github, a host matching `gitlab` → gitlab, anything else → ask.
3. **Ask** — one question, then offer to record the answer in the adapter.

Having chosen the forge, use a CLI rather than an MCP server. A forge CLI is already authenticated, prints text a model can read, and needs no per-call approval:

| Forge | Tool | Auth |
|-------|------|------|
| github | `gh` | `gh auth login`, or `GH_TOKEN` / `GITHUB_TOKEN` |
| gitea | `tea` | `tea login --name <host>`, or `GITEA_TOKEN` |
| gitlab | `glab` | `glab auth login`, or `GITLAB_TOKEN` |

If the CLI is missing or unauthenticated, say which one and how to fix it rather than falling back to a different forge or inventing an API call. Prefer a forge MCP server only when the CLI is genuinely unavailable.

Set `tracker` explicitly when auto-detection is wrong or ambiguous: a self-hosted forge on an unrecognisable host, or a repo whose issues live somewhere other than its git remote.

## What the adapter does not control

The keys configure the **local skills** only. They do **not** reconfigure CI: the PR-review workflow is a forge-specific file (Gitea `.gitea/workflows/`, GitHub `.github/workflows/`) with its own variables and secrets. See `docs/ci.md`.

The reviewer's identity is not configurable here and not matched by user name. The CI reviewer stamps every review with the marker `<!-- he9-reviewer:v1 -->`, and `he9-review respond` matches that marker. Renaming the token's user does not affect the cycle.

## Environment (per machine / forge)

| Variable | Used by | Meaning |
|----------|---------|---------|
| `REVIEWER_MODEL` | `reviewer` subagent | model for local cross-model review; see "Local reviewer agent" below |
| `GH_TOKEN` / `GITHUB_TOKEN` | any github tracker call | `gh` auth, when not using `gh auth login` |
| `GITEA_TOKEN` | any gitea tracker call | `tea` auth, when not using `tea login` |
| `GITLAB_TOKEN` | any gitlab tracker call | `glab` auth, when not using `glab auth login` |
| `OPENCODE_CONFIG_DIR` | optional | override the global config dir opencode reads |

CI-only variables and secrets are listed in `docs/ci.md`.

## Local reviewer agent

`he9-review`'s review mode and `he9-debt scan` both invoke a **`reviewer` subagent**, so the identifying party differs from the one that disposes of the findings — the doubly-checked property the debt scan depends on. This is **project config — ai-powers does not install it.** Define it in the project's `opencode.jsonc` (or `.opencode/opencode.json`):

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

The snippet above is also in `examples/reviewer-agent.jsonc`. Merge those keys into your existing `opencode.jsonc` — do not overwrite the file, since it usually already carries project settings. The `he9-review-contract` skill carries the same snippet, so a user who installed only the skills still has it.

Without this agent `he9-review` cannot start and `he9-debt scan` loses its second pair of eyes; both name the prerequisite and offer a self-review fallback instead of failing with a raw subagent-not-found error.

The subagent is referenced from the skill body as `reviewer`. Because these are skills, that mention is prompt text the model acts on, not a dispatch the harness resolves — an unavailable subagent arrives as an ordinary turn instead of an error. Both workflows therefore:

- **stop rather than degrade.** With no `reviewer` configured, `he9-review` and `he9-debt scan` say so and stop; they do not quietly become a self-review or self-audit. Each offers one as an explicit opt-in.
- **name the party.** Every report is headed `Reviewing party: reviewer` or `Identifying party: self-audit (not independently identified)`, and `he9-debt` carries the party into each entry's provenance, since no scan report is kept.
- **fail loudly.** If a `reviewer` invocation fails or returns nothing usable, the workflow reports which step failed instead of substituting its own output under the subagent's name.

That last property is why this file matters: an agent defined under a different key is a silent downgrade to a single-mind review, not an error you would notice. `scripts/validate.mjs` enforces the stop rule and the `REVIEWING_PARTY` declaration in any skill that invokes the subagent.

## Two backlogs

The skills keep two separate backlogs, split by **audience**:

- **Internal** — the resolved `debt` document (default `openspec/technical-debt.md`), committed and developer-facing. Local discovery lands here: `he9-debt scan` records new entries, and `he9-review` writes the findings whose action is `defer-debt`. Entries are self-contained (they do not rely on a review report being kept) and are worked via `he9-start <TD-id>`, then removed once the fixing branch or change merges.
- **External** — the resolved `tracker`, for issues reported by clients or users, or work that genuinely concerns outsiders.

The bridge between them is **one-way**: `he9-debt promote <item>` escalates an internal entry to the tracker when outsiders turn out to care, and removes it from the internal document so the two never track the same item. Most debt never needs promoting — it is fixed directly from the internal backlog, which keeps low-value local findings out of the public tracker.

Both flows share one shape: **identify** with the separate `reviewer` party, **dispose** with the responder party, then **act**. The reviewer party is what makes a list doubly-checked rather than self-confirmed — a scan that both finds and approves its own findings is the weakest possible review. `fix-now` findings never enter either backlog; they are the branch's work.

## Reviews are not kept

Local reviews and responses are **print-only**: `he9-review` shows them, and the durable output is the code change and any debt entries, each self-contained. Nothing needs the report after the session, so the skills do not persist one. The CI reviewer still posts its review to the forge, which is what `he9-review respond` reads.
