---
description: "Start a task: pick a tracked issue, a spec change, or an ad-hoc task, then prepare context and create a feature branch"
---

# Start a task

Goal: identify the current task and prepare a feature branch for it.

**Project inputs (optional adapter).** Read `.opencode/powers.jsonc` if present; it overrides these defaults: `baseBranch` from `origin/HEAD` else `main`; `conventions` = `openspec/conventions.md`; `specs` = `openspec/specs/*/spec.md`; `debt` = `openspec/technical-debt.md`; `docs` = `docs/*.md`; `reviewDir` = `.opencode/reviews`; `tracker` = auto (configured forge MCP, else git remote host, else ask); `contract` = `he9-review-contract`. Probe for paths; if one is absent, skip that step rather than guessing. Branch naming rules live in the conventions file when present.

## Step 1. Identify the task source

- If the user supplied a tracked issue number, use it (Step 2a).
- If the user supplied a name matching an active change under the changes directory, use it (Step 2b).
- If the user described a task in freeform, use it as an ad-hoc task (Step 2c).
- If no task was supplied, derive it from the list of currently added/modified/deleted files (Step 2c).
- If the task still cannot be identified, inform the user and stop.
- If in doubt, list the open issues and the active changes and ask the user to choose.

## Step 2a. Tracked issue task

- Fetch the issue title and body by number or from the open list.
- Summarize the goal to the user.
- Treat the issue as the current context for the remaining steps.
- Derive the branch name per the conventions: `{user}/issue-{id}-{short-task-desc}`.

## Step 2b. Spec-change task

- Confirm the change exists and summarize its goal to the user.
- Treat the change as the current context.
- Implementation proceeds via the change-apply skill on this branch.
- Derive the branch name per the conventions: `{user}/opsx-{change-name}`.

## Step 2c. Ad-hoc task

- Derive a short description from the user's input or the changed files.
- Derive the branch name per the conventions: `{user}/{short-task-desc}`.

## Step 3. Switch to the feature branch

- If there are uncommitted changes, `git stash` them first.
- Switch to `{{baseBranch}}` and pull the latest from the remote.
- Create the feature branch if it does not exist, then switch to it.
- If you stashed changes earlier, `git stash pop`.

Note: `{user}` is `git config user.name`. Branch naming details live in the adapter's conventions file.
