---
description: "Start a task: pick a tracked issue, a debt entry, a spec change, or an ad-hoc task, then prepare context and create a feature branch"
---

# Start a task

Goal: identify the current task and prepare a feature branch for it.

**Project inputs (optional adapter).** Read `.opencode/powers.jsonc` if present; it overrides the defaults below. This command uses: `baseBranch` (default `origin/HEAD`; if unset, ask and offer to record it), `conventions` (`openspec/conventions.md`), `debt` (`openspec/technical-debt.md`), `tracker` (auto: configured forge MCP, else git remote host, else ask). Probe for paths; if one is absent, skip that step rather than guessing. Branch naming rules live in the resolved conventions file when present.

## Argument

`$ARGUMENTS` is the task source: a tracked issue number, a debt id (`TD-###`), the name of an active change, or a freeform description. An empty argument means derive the task (Step 1).

## Step 1. Identify the task source

- If the argument is a tracked issue number, use it (Step 2a).
- If the argument is a debt id (`TD-###`), use it (Step 2d).
- If the argument matches an active change, use it (Step 2b).
- If the argument is freeform, use it as an ad-hoc task (Step 2c).
- If there was no argument, derive the task from the list of currently added/modified/deleted files (Step 2c).
- If the task still cannot be identified, inform the user and stop.
- If in doubt, list the open issues and the active changes and ask the user to choose.

## Step 2a. Tracked issue task

- Fetch the issue title and body through the resolved `tracker`, by number or from the open list.
- Summarize the goal to the user.
- Treat the issue as the current context for the remaining steps.
- Derive the branch name per the conventions: `{user}/issue-{id}-{short-task-desc}`.

## Step 2b. Spec-change task

- Confirm the change exists and summarize its goal to the user.
- Treat the change as the current context.
- Implementation proceeds via the change-apply skill on this branch.
- Derive the branch name per the conventions: `{user}/opsx-{change-name}`.

## Step 2c. Ad-hoc task

- Derive a short description from the argument or the changed files.
- Derive the branch name per the conventions: `{user}/{short-task-desc}`.

## Step 2d. Debt-entry task

- Read the resolved `debt` document and find the `TD-###` entry. If it is absent, say so and stop.
- Summarize the entry and its recommended direction to the user.
- Choose the vehicle: implement directly if it is a bounded bugfix or minor change; use the spec-change path (Step 2b) if it affects behavior contracts, architecture, or multiple subsystems. Ask the user when it is unclear.
- Treat the entry as the current context; implementation proceeds by fixing it on this branch.
- Derive the branch name per the conventions: `{user}/td-{id}-{short-task-desc}`.
- The entry is removed from the debt document as part of this branch's change once the fix is complete and merged — not at start, so an abandoned branch does not silently erase a real item.

## Step 3. Switch to the feature branch

- If there are uncommitted changes, `git stash` them first.
- Switch to the resolved `baseBranch` and pull the latest from the remote.
- Create the feature branch if it does not exist, then switch to it.
- If you stashed changes earlier, `git stash pop`.

Note: `{user}` is `git config user.name`. Branch naming details live in the resolved conventions file.
