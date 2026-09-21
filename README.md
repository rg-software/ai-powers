# ai-powers

Personal AI powers for opencode-based projects: portable **skills**, shared **slash commands**, and the single **review contract** that both sides of a code review speak.

The point of this repo is one shared vocabulary. The reviewer (`code-review-expert`), the responder (`receiving-code-review`), and the `he9_*` commands all reference the same rubric — `he9-review-contract` — so severity, action, and disposition mean the same thing everywhere, and a finding can be handed from review to response without translation.

## Layout

```text
skills/
  he9-review-contract/     # the shared rubric: axes, severities, finding schema, dispositions
  code-review-expert/      # reviewer (forked, aligned to the contract)
  receiving-code-review/   # responder (forked, aligned to the contract)
commands/                  # installed on dev machines
  he9_review.md            # local review / respond cycle
  he9_start.md  he9_commit.md  he9_push_pr.md  he9_debt.md
install/
  install.ps1  install.sh  # install skills + commands (single mechanism for this repo)
docs/
  adapter.md               # per-project adapter: what goes in the repo vs the machine
  ci.md                    # CI review: forge support, variables, pinning, adoption
examples/
  powers.jsonc             # annotated override example (usually you need nothing)
ci/
  pull-request-review.yml  # server-side review workflow (Gitea or GitHub)
  commands/
    he9_pr_review.md       # server-only command the workflow runs
  scripts/                 # trigger evaluation + review-text extraction
  opencode-version         # pinned opencode CLI version (coupled to the extractor)
scripts/
  validate.mjs             # validates skills + commands (CI and locally)
.github/workflows/
  validate.yml             # runs the validation on every change to main
```

The reviewer and responder skills both load `he9-review-contract`; the commands reference it too. Change the rubric in one place and both sides move together.

## Install (per machine)

This repo is installed by its own script — **skills and commands together**. From a working copy:

```powershell
./install/install.ps1        # Windows
./install/install.sh         # Linux/macOS
```

From the published repo (clones/pulls to a cache, then installs):

```powershell
./install/install.ps1 -FromGit rg-software/ai-powers            # latest default branch
./install/install.ps1 -FromGit rg-software/ai-powers -Ref <sha> # pinned
```

**Do not install this repo with `npx skills`**, since it only manages `SKILL.md` packages and cannot install the slash commands.

The default skills target is `~/.agents/skills`, the default slash commands target is `~/.config/opencode/commands`.

## Per project

Nothing is required. The commands probe the standard layout (`openspec/conventions.md`, `openspec/specs/*/spec.md`, `openspec/technical-debt.md`, `docs/*.md`) and infer the base branch and tracker. A project that deviates from the standard layout can commit a small **optional** adapter at `.opencode/powers.jsonc` containing only the overrides. See `docs/adapter.md` and `examples/powers.jsonc`.

## CI

`ci/pull-request-review.yml` runs the review headless and posts it as a PR comment. It works on Gitea and GitHub — same file, different folder and token secret. It clones this repo at `AI_POWERS_REF` (a branch or SHA; the resolved SHA is stamped in the review footer), copies the commands and skills in, and never executes anything from the PR checkout. It carries its own helper scripts, so adopting a project is one YAML file plus variables. See `docs/ci.md`.

## Migration notes

- Stop `npx skills` from managing the two forked skills, so it can never clobber them:
  `npx skills remove code-review-expert receiving-code-review -g`. Then install with this repo's script.
- The global commands directory is managed by this repo's installer, which also prunes stale `he9_*` commands it no longer ships.
- Restart opencode after installing; config and commands are loaded at startup.

## License

MIT — see `LICENSE`.
