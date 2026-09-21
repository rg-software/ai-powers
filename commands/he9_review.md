---
description: "Code review / respond cycle: review a target locally (branch, uncommitted work, a commit, a range), or respond to the latest review on a PR"
---

# Perform a code review / respond cycle

Goal: improve code with a single review/respond cycle, including local maintainability refactoring where appropriate.

**Project inputs (optional adapter).** Read `.opencode/powers.jsonc` if present; it overrides these defaults: `baseBranch` from `origin/HEAD` else `main`; `conventions` = `openspec/conventions.md`; `specs` = `openspec/specs/*/spec.md`; `debt` = `openspec/technical-debt.md`; `docs` = `docs/*.md`; `reviewDir` = `.opencode/reviews`; `tracker` = auto (configured forge MCP, else git remote host, else ask); `contract` = `he9-review-contract`. Probe for paths; if one is absent, skip that step rather than guessing.

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

`<base>` is the resolved base branch.

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

3. Create the run folder and save the review as `review.md`:
   - Root: the resolved review directory.
   - Run folder: `<UTC timestamp>-<target>-<current branch>` (e.g. `20260921T1430-worktree-fix-drag`).
   - Ensure the review root is gitignored: if it is not covered by an existing rule, add it to the project's `.gitignore`.
   - Do not commit anything under the review root.

4. Use the `receiving-code-review` skill — with the `he9-review-contract` vocabulary — to analyze the review and assign a **disposition to every finding**.

5. Produce the response in the contract's responder output format.

6. Save the response as `response.md` alongside `review.md` in the same run folder.

7. Read both files and print their full contents as rendered markdown. Do not summarize or omit anything. Then state the run folder path so the pair can be found later.

8. Recommend what to address now, applying the contract's severity-to-action policy (use the table in `he9-review-contract`; do not restate it from memory). In short: P0/P1 fix before merge; P2 in touched code usually fix now unless not cheap; P2 outside touched code usually defer; P3 optional.

9. For real maintainability or architecture findings that should not be addressed now, recommend recording them in the debt backlog or promoting them into a focused issue / spec change.

10. Ask the user how to proceed:
    - **A**: fix all recommended issues.
    - **B**: choose issues to fix.
    - **C**: defer selected maintainability issues to the backlog.

## Mode: respond <PR number>

1. If no PR number was supplied, list the open PRs and ask the user to choose one.
2. Find and read the most recent review comment carrying the marker `<!-- he9-reviewer:v1 -->` (the CI reviewer stamps every review with it). If none exists, inform the user and stop.
3. Use the `receiving-code-review` skill with the `he9-review-contract` vocabulary: verify each finding, assign a disposition to every one, and emit the contract's responder output format.
4. When a finding is maintainability or architecture work, classify it as fix-in-branch-now, or defer into the debt backlog / a focused issue / a spec change.
5. Save the response under the resolved review directory in `<UTC timestamp>-respond-pr-<number>/response.md` (gitignored, as in review mode).
6. Ask whether to fix the in-branch issues now, or defer the selected maintainability findings to the backlog.
