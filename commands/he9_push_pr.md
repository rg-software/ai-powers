---
description: "Push the current branch and open a pull request (auto-drafts title/body from commits and links the tracked issue from the branch name)"
---

# Push and create a pull request

Goal: push the current feature branch and open a pull request.

**Project inputs (optional adapter).** Read `.opencode/powers.jsonc` if present; it overrides the defaults below. This command uses: `baseBranch` (default `origin/HEAD`; if unset, ask and offer to record it), `tracker` (auto: configured forge MCP, else git remote host, else ask). Probe for paths; if one is absent, skip that step rather than guessing. Use the resolved tracker's tooling.

## Argument

`$ARGUMENTS`: the single word `commit` means "commit first, without prompting, then continue" (see Step 1). An empty argument is the normal path.

## Step 1. Prepare and push

- Verify the working tree is clean (`git status`).
- If there are uncommitted changes and `$ARGUMENTS` is **not** `commit`: inform the user, suggest committing, and stop. Do not update or push the branch.
- If there are uncommitted changes and `$ARGUMENTS` **is** `commit`: run the `he9_commit` workflow without prompting, then continue.
- Ensure the branch is up to date; fetch and merge/rebase against the resolved `baseBranch` if needed.
- Push the branch; set upstream on first push (`git push -u origin <branch>`).

## Step 2. Draft PR content

- Title from the branch's commits: `git log <base>..HEAD --oneline`, where `<base>` is the resolved `baseBranch`; prefer the primary Conventional Commit subject.
- Body from the commit history and the diff against the resolved `baseBranch`: what changed and why; include the verification performed (per `he9_commit`).
- Link the tracked issue from the branch name (`issue-{id}`): `Resolves #123` or `Fixes #123`. Skip if not issue-based.

## Step 3. Open the PR

- Check whether an open PR already exists for the branch (via the resolved tracker's tooling).
  - If one exists: show its link, reuse it, and do **not** create a second PR. Only update its title/body if the user explicitly asks.
  - If none exists: create the PR targeting the resolved `baseBranch`.

## Step 4. Respect existing PRs

- If the branch already has an open PR, the push is the final step.
- Do not ask for confirmation before pushing.
- Do not open a duplicate PR.
