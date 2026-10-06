# ai-powers

Personal AI powers for opencode-based projects: portable **skills** and the single **review contract** that both sides of a code review speak.

The point of this repo is one shared vocabulary. The reviewer (`code-review-expert`), the responder (`receiving-code-review`), and the `he9-*` workflows all reference the same rubric — `he9-review-contract` — so severity, action, and disposition mean the same thing everywhere, and a finding can be handed from review to response without translation.

Everything a developer installs is a **skill**. The single exception is the server-only PR review command, which CI dispatches by name and never installs on a machine.

## Layout

```text
skills/
  he9-review-contract/     # the shared rubric: axes, severities, finding schema, dispositions
  code-review-expert/      # reviewer: how to run a review, including input resolution
  receiving-code-review/   # responder: how to answer one, with the contract vocabulary
  he9-start/               # pick a task, prepare a feature branch
  he9-commit/              # verify and commit with a Conventional Commit message
  he9-push-pr/             # push and open a pull request
  he9-debt/                # scan for debt, or promote an entry to the tracker
  he9-review/              # local review / respond cycle
docs/
  adapter.md               # per-project adapter: what goes in the repo vs the machine
  ci.md                    # CI review: forge support, variables, pinning, adoption
examples/
  powers.jsonc             # annotated override example (usually you need nothing)
  reviewer-agent.jsonc     # local reviewer subagent required by he9-review and he9-debt
ci/
  pull-request-review.yml  # server-side review workflow (Gitea or GitHub)
  commands/
    he9_pr_review.md       # server-only command the workflow runs (not a skill)
  scripts/                 # trigger evaluation + review-text extraction
  opencode-version         # pinned opencode CLI version (coupled to the extractor)
scripts/
  validate.mjs             # validates skills + the server command (CI and locally)
.github/workflows/
  validate.yml             # runs the validation on every change to main
```

The reviewer and responder skills both load `he9-review-contract`; the workflows reference it too. Change the rubric in one place and both sides move together.

## Install (per machine)

With [`npx skills`](https://github.com/vercel-labs/skills):

```bash
npx skills add rg-software/ai-powers -g -a cline -y
```

`-a cline` looks odd for an opencode repo, and it is deliberate: the target is what the flag selects, not what the skills are for. The `skills` CLI maps each agent id to a directory, and `cline` is the id whose global path is `~/.agents/skills`. opencode reads that location natively, so this puts the skills where they belong for a machine-wide install:

| Flag | Installs to | opencode reads it |
|------|-------------|-------------------|
| `-a cline` | `~/.agents/skills/` | yes, native |
| `-a opencode` | `~/.config/opencode/skills/` | yes, native |

Either works. Pick one root per skill and do not install the same skill under both — opencode loads both and lets the later-registered `~/.config/opencode/skills` win, which is confusing to debug. `-a cline` is recommended here because `~/.agents/skills` is shared with other agents, so one install serves them all.

Updates are one command either way:

```bash
npx skills update -g          # pull the latest revision of everything installed
```

On Windows, add `--copy` if symlink creation is not permitted. Add `--list` to either command to preview first.

The workflows are invoked by name — `/he9-review worktree`, `/he9-start 42`, `/he9-debt scan Assets/Features`. The text after the name is the workflow's input: the review target, the task source, the debt scope. Each skill states in its body how it reads that text.

## Per project

Nothing is required. The skills probe the standard layout (`openspec/conventions.md`, `openspec/specs/*/spec.md`, `openspec/technical-debt.md`, `docs/*.md`) and infer the base branch and tracker. Two optional per-project files:

| File | Needed when |
|------|-------------|
| `.opencode/powers.jsonc` | the project deviates from the standard layout — overrides only |
| `reviewer` subagent in `opencode.jsonc` | you want `he9-review` / `he9-debt scan` to use a separate reviewer |

Copy `examples/powers.jsonc` and `examples/reviewer-agent.jsonc` as starting points. The reviewer agent is a snippet to **merge** into an existing config, not a file to overwrite. See `docs/adapter.md`.

## CI

`ci/pull-request-review.yml` runs the review headless and posts it as a PR comment. It works on Gitea and GitHub — same file, different folder and token secret. It clones this repo at `AI_POWERS_REF` (a branch or SHA; the resolved SHA is stamped in the review footer), copies the command and skills in, and never executes anything from the PR checkout. It carries its own helper scripts, so adopting a project is one YAML file plus variables. See `docs/ci.md`.

`ci/commands/he9_pr_review.md` stays a command rather than a skill because the workflow invokes it as `opencode run --command he9_pr_review`, and that lookup resolves against the command registry, where skills do not appear. `scripts/validate.mjs` enforces that separation.

## Migration notes

- Replace the old installer (`install/install.ps1`, `install/install.sh`, now removed) with `npx skills add` above, then delete what it left behind:
  - `~/.config/opencode/commands/he9_*.md` — the old command files, now skills
  - any copy of this repo's skills under `~/.config/opencode/skills/`, if you previously ran `npx skills add -a opencode`. The install command above targets `~/.agents/skills`, so a leftover copy in the other root would shadow it and silently win. Either delete it or keep installing with `-a opencode` instead.
- `npx skills update -g` refreshes skills only. The command in `ci/` is not installed on machines and updates with the pinned `AI_POWERS_REF`.
- Restart opencode if a newly installed skill does not appear; recent versions reload config and skills on their own.
- Invoking a skill by name (`/he9-review worktree`) attaches it and keeps the text after the name as the input, but only when the composer resolves it as an attachment. Typed as plain text with no attachment, it reaches the model as prose and the model may or may not load the skill. Each workflow says what to read, so this degrades rather than breaks.

## License

MIT — see `LICENSE`.