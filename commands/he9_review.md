---
description: "Code review / respond cycle: review a target locally (branch, uncommitted work, a commit, a range), or respond to the latest review on a PR"
---

# Perform a code review / respond cycle

Goal: improve code with a single review/respond cycle, including local maintainability refactoring where appropriate.

**Project inputs (optional adapter).** Read `.opencode/powers.jsonc` if present; it overrides the defaults below. This command uses: `baseBranch` (default `origin/HEAD`; if unset, ask and offer to record it), `conventions` (`openspec/conventions.md`), `specs` (`openspec/specs/*/spec.md`), `debt` (`openspec/technical-debt.md`), `tracker` (auto: configured forge MCP, else git remote host, else ask), `contract` (`he9-review-contract`). Probe for paths; if one is absent, skip that step rather than guessing.

## Argument

`$ARGUMENTS` selects a **review target** (what is being reviewed). If it begins with `respond`, use the respond mode instead. A review target is distinct from a finding's `scope` in the contract (`in-touched`/`adjacent`/`project-wide`).

| target | resolved diff spec |
|--------|--------------------|
| `branch` (default, or empty) | `<base>...HEAD` — every commit on the branch, not just the latest |
| `worktree` | uncommitted work: `git diff HEAD` **plus untracked files** |
| `staged` | `git diff --cached` |
| `commit` | `git show HEAD` (the last commit; also correct for the root commit) |
| `range <A>..<B>` | the given range |
| `path <p>` | the default target restricted to a path: `(<base>...HEAD) -- <p>` |

`<base>` is the resolved `baseBranch`.

Note: `git diff` **invisibly omits untracked files**. For `worktree`, enumerate them with `git status --porcelain` and read their contents; otherwise new files are reviewed by name only.

## Mode: review a target

0. This mode requires a `reviewer` subagent (see `docs/adapter.md` → "Local reviewer agent"). If it is not configured, do not surface a raw subagent-not-found error: tell the user the mode needs a `reviewer` subagent, point at that section, and offer to continue with a self-review using the same skills instead.

1. Resolve the target to an explicit diff spec from the table. State the resolved spec before reviewing.

2. Invoke the `@reviewer` subagent with this task:

   > Perform a code review of this change set: `<resolved diff spec>`. List the files included. For untracked files, read each one in full and review it as added code. If any file is out of scope or not reviewable, say so explicitly.
   >
   > Use the `code-review-expert` skill and grade findings with the `he9-review-contract` skill. Use `.opencode/powers.jsonc` (if present) for the conventions and specs to check architecture drift against. Populate the review's `Not reviewed` section, including any graded input that was absent.
   >
   > This is non-interactive: skip the skill's "hand-off" step and do not ask how to proceed.

3. Use the `receiving-code-review` skill — with the `he9-review-contract` vocabulary — to analyze the review and assign a **disposition to every finding**.

4. Produce the response in the contract's responder output format.

5. Present both in full as rendered markdown: the review, then the response. Do not summarize or omit anything. Reports are **print-only** — do not persist them; the durable artifact is the code change and any debt entry, not the review.

6. Recommend what to address now, applying the contract's severity-to-action policy (use the table in `he9-review-contract`; do not restate it from memory). In short: P0/P1 fix before merge; P2 in touched code usually fix now unless not cheap; P2 outside touched code usually defer; P3 optional.

7. Act on the dispositions. For every `defer-debt` finding, **write a self-contained entry into the resolved `debt` document**, using that document's own item template and grading it per `he9-review-contract` → "Mapping to the debt backlog": inline the evidence, symptom, and `file:line`, because the review is not kept (the finding `id` may remain as provenance only). For `promote-issue` / `promote-change` findings, recommend the focused issue or spec change rather than creating it here — promotion is a deliberate step. `fix-now` findings are this branch's work and are not recorded.

8. Ask the user how to proceed:
   - **A**: fix all recommended issues.
   - **B**: choose issues to fix.
   - **C**: defer selected maintainability issues into the resolved `debt` document.

## Mode: respond <PR number>

1. If no PR number was supplied, list the open PRs through the resolved `tracker` and ask the user to choose one.
2. Find and read the most recent review comment carrying the marker `<!-- he9-reviewer:v1 -->` (the CI reviewer stamps every review with it). If none exists, inform the user and stop.
3. Use the `receiving-code-review` skill with the `he9-review-contract` vocabulary: verify each finding, assign a disposition to every one, and emit the contract's responder output format.
4. Act on the dispositions: write every `defer-debt` finding into the resolved `debt` document as a self-contained entry (item template; inline the evidence, symptom, and `file:line`; the finding `id` may remain as provenance only), and recommend a focused issue or spec change for `promote-issue` / `promote-change` findings rather than creating them here.
5. Ask whether to fix the in-branch issues now, or defer the selected findings into the resolved `debt` document.
