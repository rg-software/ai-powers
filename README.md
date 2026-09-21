# ai-powers

Personal AI powers for opencode-based projects: portable **skills**, shared **slash commands**, and the single **review contract** that both sides of a code review speak.

The point of this repo is one shared vocabulary. The reviewer (`code-review-expert`), the responder (`receiving-code-review`), and the `he9_*` commands all reference the same rubric — `he9-review-contract` — so severity, action, and disposition mean the same thing everywhere, and a finding can be handed from review to response without translation.

## Layout

```text
skills/
  he9-review-contract/     # the shared rubric: axes, severities, finding schema, dispositions
  code-review-expert/      # reviewer (forked, aligned to the contract)
  receiving-code-review/   # responder (forked, aligned to the contract)
commands/
  he9_review.md            # local review / respond cycle
  he9_pr_review.md         # server-side PR review (CI)
  he9_start.md  he9_commit.md  he9_push_pr.md  he9_debt.md
install/
  install.ps1  install.sh  # install skills + commands (single mechanism for this repo)
docs/
  adapter.md               # per-project adapter: what goes in the repo vs the machine
examples/
  powers.jsonc             # example project adapter
ci/
  pull-request-review.yml  # example server-side review workflow (pinned to this repo)
  README.md                # CI invariants, variables, adapter rules
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

Each project commits a small adapter at `.opencode/powers.jsonc` describing where its conventions, specs, debt backlog, and tracker live. Commands read it and fall back to defaults. See `docs/adapter.md` and `examples/powers.jsonc`.

## CI

The PR-review workflow clones this repo at a pinned commit SHA into a trusted directory and copies the commands and skills into the runner's global directories. It never reads instructions from the PR checkout. Reproducible, and the reviewer runs the same contract revision as local.

## Migration notes

- Stop `npx skills` from managing the two forked skills, so it can never clobber them:
  `npx skills remove code-review-expert receiving-code-review -g`. Then install with this repo's script.
- The global `~/.config/opencode/commands/` copy of `he9_pr_review.md` may diverge from a project copy; this repo is canonical once installed.
- Restart opencode after installing; config and commands are loaded at startup.
