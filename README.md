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
npx skills add rg-software/ai-powers -g -a opencode -y
```

That installs every skill in this repo into `~/.config/opencode/skills/` — the global location opencode reads — and covers updates too:

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
  - `~/.agents/skills/{code-review-expert,receiving-code-review,he9-review-contract}` — the old install target; `npx skills` uses `~/.config/opencode/skills/`, and a duplicate ID in the older location is shadowed but confusing
- `npx skills update -g` refreshes skills only. Commands in `ci/` are not installed on machines and update with the pinned `AI_POWERS_REF`.
- Restart opencode if a newly installed skill does not appear; opencode reloads config and commands on its own in recent versions.

## License

MIT — see `LICENSE`.