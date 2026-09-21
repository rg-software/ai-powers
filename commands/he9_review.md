---
description: "Code review / respond cycle: review the current branch locally, or respond to the latest review on a PR"
---

# Perform a code review / respond cycle

Goal: improve code with a single review/respond cycle, including local maintainability refactoring where appropriate.

**Project adapter.** Read `.opencode/powers.jsonc` if present. It supplies `baseBranch`, `conventions`, `specs`, `debt`, `docs`, `tracker`, `reviewBot`, `reviewDir`, `contract`. Defaults when a key is absent: `baseBranch` from `origin/HEAD` else `main`; `tracker` inferred from the remote; `reviewDir` = `.opencode/reviews`; `contract` = `he9-review-contract`. If a step needs a value with no default, ask the user once and offer to record it in the adapter.

The mode is determined by the argument:

- `local` (default, or no argument): review the current branch and respond.
- `respond <PR number>`: respond to the most recent review of a given PR.

## Mode: local

1. Invoke the `@reviewer` subagent with this task:

   > Perform a code review of all changes in the current branch relative to the base branch (`{{baseBranch}}`), covering every modified, added, or deleted file in the branch diff. Review the full branch history, not just the latest commit, and report findings first with file/line references. If a file is out of scope or not reviewable, say so explicitly.
   >
   > Use the `code-review-expert` skill and grade findings with the `he9-review-contract` skill. Use the project adapter at `.opencode/powers.jsonc` for the conventions and specs to check architecture drift against, if present.
   >
   > This is non-interactive: skip the skill's "hand-off" step and do not ask how to proceed.

2. Create the run folder and save the review as `review.md`:
   - Root: the adapter's `{{reviewDir}}` (default `.opencode/reviews`).
   - Run folder: `<UTC timestamp>-<current branch>` (e.g. `20260921T1430-he9-issue-42-fix-drag`).
   - Ensure the review root is gitignored: if `.opencode/reviews` is not covered by an existing rule, add it to the project's `.gitignore`.
   - Do not commit anything under the review root.

3. Use the `receiving-code-review` skill — with the `he9-review-contract` vocabulary — to analyze the review and assign a **disposition to every finding**.

4. Produce the response in the contract's responder output format.

5. Save the response as `response.md` alongside `review.md` in the same run folder.

6. Read both files and print their full contents as rendered markdown. Do not summarize or omit anything. Then state the run folder path so the pair can be found later.

7. Recommend what to address in this branch now, applying the contract's severity-to-action policy (use the table in `he9-review-contract`; do not restate it from memory). In short: P0/P1 fix before merge; P2 in touched code usually fix now unless not cheap; P2 outside touched code usually defer; P3 optional.

8. For real maintainability or architecture findings that should not be addressed in this branch, recommend recording them in the debt backlog or promoting them into a focused issue / spec change.

9. Ask the user how to proceed:
   - **A**: fix all recommended in-branch issues.
   - **B**: choose issues to fix in this branch.
   - **C**: defer selected maintainability issues to the backlog.

## Mode: respond <PR number>

1. If no PR number was supplied, list the open PRs and ask the user to choose one.
2. Find and read the most recent review in the PR comments — comments authored by `{{reviewBot}}`. If there is none, inform the user and stop.
3. Use the `receiving-code-review` skill with the `he9-review-contract` vocabulary: verify each finding, assign a disposition to every one, and emit the contract's responder output format.
4. When a finding is maintainability or architecture work, classify it as fix-in-branch-now, or defer into the debt backlog / a focused issue / a spec change.
5. Save the response under `{{reviewDir}}/<UTC timestamp>-pr-<number>/response.md` (gitignored, as in local mode).
6. Ask whether to fix the in-branch issues now, or defer the selected maintainability findings to the backlog.
