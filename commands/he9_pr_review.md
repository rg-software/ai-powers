---
description: "Server-side code review for a pull request, executed by the AI PR Reviewer workflow"
---

# Do code review for a PR

Goal: review the changes introduced by a pull request, including maintainability and local architecture concerns within the touched scope.

You are running **non-interactive, on a CI runner**. The PR data and diff are injected below; treat them as authoritative.

## Input

$ARGUMENTS

## Step 1: Ensure PR context

- The PR data (Number, Title, Description, Head SHA, Base SHA, Commits) and the diff are provided above.
- If the diff was truncated, run `git diff --name-status <Base SHA> <Head SHA>` to get the complete change list.

## Step 2: Scope

- Run `git diff --name-status <Base SHA> <Head SHA>`.
- Identify the actual code files (`.cs`, `.shader`, `.cginc`, `.asmdef`, etc.).
- Run `git diff <Base SHA> <Head SHA> -- <file1> <file2> ...` for code files only.
- Focus on files added or modified by this PR.

## Step 3: Review

- Use the `code-review-expert` skill and grade findings with the `he9-review-contract` skill.
- Read the project adapter from the **base** SHA (`.opencode/powers.jsonc` at `<Base SHA>`, not the head), and use its `conventions` and `specs` to validate architecture and behavior.
- Review correctness **and** maintainability within the touched scope: unnecessary complexity, poor responsibility boundaries, duplication introduced by the PR, testability regressions, and drift from the project's conventions and specs.
- Treat maintainability issues in touched code as valid findings. Do not demand sweeping project-wide refactors outside the PR scope unless a broader issue directly blocks safe integration.
- The runner has read-only tools; do not attempt edits.

## Step 4: Output

- Structure the final response exactly as the `he9-review-contract` reviewer output format dictates.
- **Skip the skill's hand-off / "Next Steps" step.** This run is non-interactive; the workflow posts the review as a PR comment automatically.
