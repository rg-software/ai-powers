---
description: "Server-side code review for a pull request, executed by the AI PR Reviewer workflow"
---

# Do code review for a PR

Goal: review the changes introduced by a pull request, including maintainability and local architecture concerns within the touched scope.

You are running **non-interactive, on a CI runner**. The PR data and diff are injected below; treat them as authoritative.

## Input

$ARGUMENTS

## Step 1. Ensure PR context

- The PR data (Number, Title, Description, Head SHA, Base SHA, Commits) and the diff are provided above.
- If the diff was truncated, run `git diff --name-status <Base SHA> <Head SHA>` to get the complete change list.

## Step 2. Scope

- Run `git diff --name-status <Base SHA> <Head SHA>`.
- Identify the actual code files (`.cs`, `.shader`, `.cginc`, `.asmdef`, etc.).
- Run `git diff <Base SHA> <Head SHA> -- <file1> <file2> ...` for code files only.
- Focus on files added or modified by this PR.

## Step 3. Review

- Use the `code-review-expert` skill and grade findings with the `he9-review-contract` skill.
- Resolve project inputs from the **base** SHA, not the head, and pass them to the reviewer rather than letting it probe the working tree. Read `.opencode/powers.jsonc` at `<Base SHA>` if present (it overrides defaults); otherwise use the defaults `conventions` = `openspec/conventions.md` and `specs` = `openspec/specs/*/spec.md`. Use whichever exists to validate architecture and behavior.
- **Why the base SHA:** this runs under `pull_request_target`, so grading against the head would let a pull request rewrite the conventions or specs its own review is judged against. `code-review-expert` treats input resolution as the caller's responsibility in non-interactive runs — do not let it re-derive these itself.
- Review correctness **and** maintainability within the touched scope: unnecessary complexity, poor responsibility boundaries, duplication introduced by the PR, testability regressions, and drift from the project's conventions and specs.
- Treat maintainability issues in touched code as valid findings. Do not demand sweeping project-wide refactors outside the PR scope unless a broader issue directly blocks safe integration.
- The runner has read-only tools; do not attempt edits.

## Step 4. Output

- **Emit only the review.** Your entire text output is posted verbatim as the PR comment: no preamble, no "I will now inspect…", no restatement of the task, no closing summary. Begin at the first heading and stop at the last line of the report. This is a hard requirement, not a style preference — the workflow concatenates every text block this run emits, so anything outside the report lands in the comment.
- Structure that output exactly as the `he9-review-contract` reviewer output format dictates, starting with `## Code Review Summary`.
- Do not add a "Next Steps" section: `code-review-expert` skips its hand-off step in non-interactive runs. This workflow posts the review as a PR comment automatically.