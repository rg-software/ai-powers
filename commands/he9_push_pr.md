---
description: "Push the current branch and open a pull request (auto-drafts title/body from commits and links the tracked issue from the branch name)"
---

# Push and create a pull request

Goal: push the current feature branch and open a pull request.

**Project inputs (optional adapter).** Read `.opencode/powers.jsonc` if present; it overrides these defaults: `baseBranch` from `origin/HEAD` else `main`; `conventions` = `openspec/conventions.md`; `specs` = `openspec/specs/*/spec.md`; `debt` = `docs/technical-debt.md`; `docs` = `docs/*.md`; `reviewDir` = `.opencode/reviews`; `tracker` = auto (configured forge MCP, else git remote host, else ask); `contract` = `he9-review-contract`. Probe for paths; if one is absent, skip that step rather than guessing. Use the resolved tracker's tooling.

If invoked as `he9_push_pr commit`, run the `he9_commit` workflow without asking first, then continue.

## Step 1. Prepare and push

- Verify the working tree is clean (`git status`).
- If there are uncommitted changes and the command was **not** invoked as `he9_push_pr commit`: inform the user, suggest committing, and stop. Do not update or push the branch.
- If there are uncommitted changes and it **was** invoked as `he9_push_pr commit`: run the `he9_commit` workflow without prompting, then continue.
- Ensure the branch is up to date; fetch and merge/rebase against `{{baseBranch}}` if needed.
- Push the branch; set upstream on first push (`git push -u origin <branch>`).

## Step 2. Draft PR content

- Title from the branch's commits: `git log {{baseBranch}}..HEAD --oneline`, preferring the primary Conventional Commit subject.
- Body from the commit history and the diff against `{{baseBranch}}`: what changed and why; include the verification performed (per `he9_commit`).
- Link the tracked issue from the branch name (`issue-{id}`): `Resolves #123` or `Fixes #123`. Skip if not issue-based.

## Step 3. Open the PR

- Check whether an open PR already exists for the branch (via the tracker's tooling).
  - If one exists: show its link, reuse it, and do **not** create a second PR. Only update its title/body if the user explicitly asks.
  - If none exists: create the PR targeting `{{baseBranch}}`.

## Step 4. Respect existing PRs

- If the branch already has an open PR, the push is the final step.
- Do not ask for confirmation before pushing.
- Do not open a duplicate PR.
