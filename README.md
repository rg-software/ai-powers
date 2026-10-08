# ai-powers

A universal agentic setup for [OpenSpec](https://github.com/Fission-AI/OpenSpec)-based projects with emphasis on Unity development. In addition to suggested tools and practices, this repository contains several useful skills that can be installed directly with `npx skills`. We suggest installing universal skills and tools globally (into `~/.agents/skills`) rather than per-project, which is reflected in the following instructions. However, local setup will work equally well.

## Installation

The suggested setup includes OpenSpec, Unity skills, and this repo:

```shell
npm install -g @fission-ai/openspec@latest

npx skills add fission-ai/openspec -g
npx skills add Unity-Technologies/skills -g
npx skills add rg-software/ai-powers -g
```

To update installed skills, use

```bash
npx skills update -g
```

You will also need to install [Unity-CLI](https://docs.unity.com/en-us/unity-cli) and configure [Unity Pipeline](https://docs.unity.com/en-us/unity-cli/unity-pipeline/unity-pipeline-package) package. For Github integration, you'll need [Github CLI](https://cli.github.com) tool, for Gitea, you'll need [Tea](https://about.gitea.com/products/tea/). Normally, coding agents know how to use these tools, no skills are needed.

Official OpenSpec docs state that you need to initialize OpenSpec per project and install slash commands, but in practice having global skills is sufficient. They can be invoked as commands (e.g., `/openspec-apply-change`).

The local code review flow presumes you have a "reviewer" subagent configured. For OpenCode, this can be done with the following declaration:

```json
// declaring "reviewer" subagent
// in ~/.config/opencode/opencode.jsonc
// make sure to declare REVIEWER_MODEL env variable, e.g.,
// openrouter/z-ai/glm-5.3-flash

"agent": {
  "reviewer": {
    "mode": "subagent",
    "description": "Reviews code for best practices.",
    "model": "{env:REVIEWER_MODEL}",
    "permission": {
	  "read": "allow",
	  "edit": "deny"
    }
  }
}
```

## Per-project setup

In most cases, you do not need to perform any project-specific setup. However, you can override certain default values by copying `powers.jsonc` into your project directory and supplying custom values.

If you are not happy with the defects identified by code review flows, _do not_ fix the flows. Instead, add more rules and suggestions into your `openspec/conventions.md`.

## Project Memory

Documentation is essential in agentic workflows as it lets the agents to rely on explicit knowledge rather than browse sources all the time. Project memory is kept as a system of manually and OpenSpec-managed markdown files. OpenSpec imposes a predefined document structure, and the documents that do not fit it should be placed elsewhere. We suggest the following setup:

```text
openspec/
├── config.yaml            <-- primary openspec config
├── conventions.md         <-- project-wide conventions
├── technical-debt.md      <-- current known debt
├── specs/                 <-- subsystems (source of truth)
│   ├── /combat-system
│   └── /localization
├── changes/               <-- updates
│   ├── /archive           <-- history (applied updates)
│   ├── /remove-sword      <-- update to be applied
│   └── /add-ja-locale     <-- update to be applied
│   
docs/                      <-- non-spec user-facing documents
├── game-flow.md
├── levels-outline.md
├── game-concept.md
README.md                  <-- user-facing project info
AGENTS.md                  <-- agent-facing project info
```

The non-spec part of this structure can be extended as necessary. For the ease of browsing, we suggest linking the project repo to [Obsidian](https://obsidian.md) via [Folder Bridge](https://github.com/tescolopio/Obsidian_FolderBridge) plugin.

### `config.yaml`

OpenSpec [configuration file](https://github.com/Fission-AI/OpenSpec/blob/main/docs/customization.md) can be used to customize workflows. We normally keep project conventions in a separate file, referenced from `config.yaml`:

```markdown
schema: spec-driven

context: |
  ## Project: [Game Name]

  Canonical sources:
  - Specs: `specs/`
  - Code conventions: `conventions.md`
...
```

```markdown
# Project Conventions (conventions.md)

## Tech Stack

**Engine:** Unity 6 (URP)
**Core Paradigm:** Composition over Inheritance,
                   Event-Driven (C# Events)

## Core Dependencies

- VContainer (Dependency Injection)
- UniTask (Async/Await)
- DOTween

## Code Style

- private fields: `_camelCase`
- public properties: `PascalCase`
- events: `OnActionName`
...
```

### Design documents

Make sure to place design documents (that declare the target _intent_ rather than the expected _current_ state of the system) outside `/openspec` folder to ensure the coding agents don't treat your plans as the actually implemented functionality.

### Architecture Decision Records (ADRs)

A special kind of a non-spec design document is an "ADR": when a major architectural choice is made (e.g., "We will use Event Channels instead of direct references"), we recommend to reflect it in a certain "decision record". Its possible structure is based on "Context", "Decision", and "Consequences" sections ([Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)):

*   **Context:** We needed to decouple UI from HP logic.
*   **Decision:** We chose `ScriptableObject` Event Channels.
*   **Consequences:** UI must verify the Event Channel exists before listening.

### `AGENTS.md`

General rules described in `AGENTS.md` provide _declarative_ guidance: they set certain goals to follow, but do not provide any step-by-step recipes. One important aim of system rules is to keep the project well-organized and consistent. In particular, it must be stated that the documentation and the code must be in sync. It might also be advisable to enforce OpenSpec-driven flows as shown in the following example:

```markdown
- Work flows through OpenSpec changes first; implementation does not run ahead of the plan.
- Use `openspec/specs/*` as the canonical source for technical/runtime documentation.
- For project-level conventions, examine the `context` section of `openspec/config.yaml`.
- For system-specific tasks, read the relevant capability spec under `openspec/specs/<capability>/spec.md` (for example: `world-map`, `player-prefs`, `factories`, `rails-tile-system`).
- Use `openspec/notes/*` as supplemental context only for non-normative ideas and backlog notes.
```

## Code reviews on PR

Copy `ci/pull-request-review.yml` to your project's `.gitea/workflows/` (Gitea) or `.github/workflows/` (GitHub) to setup automated code reviews on pull request. You will need to setup the following variables on the server:

- `AI_MODEL_NAME`: e.g., `openai/gpt-5.6-terra`; all requests go via [OpenRouter](https://openrouter.ai).
- `AI_POWERS_REF`: branch to use in the `ai-powers` repo (normally `main`).
- `AI_POWERS_REPO`: normally `rg-software/ai-powers`.
- `OPENROUTER_API_KEY` (in the secrets section): your OpenRouter key.

See `docs/ci.md` for more details.

## Processes

### General work organization

The proposed Github/Gitea setup is optimized for a typical "git-flow" based process:

1) Identify or retrieve an issue.
2) Create a branch for this issue.
3) Address the issue:
	- a) directly, if it does not entail specs update (a bugfix, upgraded graphics, etc.);
	- b) via an OpenSpec-based workflow otherwise.
4) Ideally, update project test suite.
5) Once the issue is resolved:
	- perform local cleanup/refactoring if needed;
	- do self-code review and address identified issues;
	- initiate a pull request (PR).
6) Receive a server-triggered automated code review for the PR.
7) Update code if necessary, then merge the PR.

We recommend that the PR Description contains a reference to the issue number and a keyword like ["fixes" or "closes"](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/using-keywords-in-issues-and-pull-requests), so the linked issue gets closed automatically.

### Starting a task

The presumed "unit of work" is an "issue" (in Github terms), which in fact can be a relatively large-scale functionality (e.g., the whole subsystem). This issue must be present in a text form, so the user has (a) either to type it; or (b) fetch it from Gitea/Github. Starting work on a task is handled by `he9-start`:

```shell
# pick a Gitea issue, an OpenSpec change, or an ad-hoc task
# (optionally specify the issue number)
/he9-start
```

This command also creates  creates a properly named feature branch for the task.

### Implementing a feature

A recommended approach towards a new feature is via OpenSpec. As [per documentation](https://github.com/Fission-AI/OpenSpec/blob/main/docs/migration-guide.md), "don't overthink it":

- Use `/openspec-propose <feature description>` to generate specs.
- Review specs, then fix/improve them interactively.
- Once specs are okay, use `/openspec-apply` to implement.

As a rule of thumb, use OpenSpec for any change that corresponds to a potential change in documentation. E.g., a small bugfix is likely not such a change (because it makes documentation correct), but a new feature or a refactoring (since it changes classes) are.

Once all the tasks are accomplished, the proposal should be archived (`/openspec-archive`). You can work on several proposals simultaneously.

To commit changes with an autogenerated message, you can a) either call `/he9-commit` or b) add auto-commit rules to `AGENTS.md`.

### Initiating a PR

When the local branch is ready for PR, use the following command to open it:

```shell
/he9-push-pr # push the current branch and initiate a pull request
```

If "code reviews on PR" are enabled, the server will execute `he9_pr_review.md` workflow. Code reviews are structured: all identified defects are ranked according to the `he9-review-contract` skill. Once code review is ready, you can take a second look at the report by running

```shell
/he9-review respond <PR-number>
```

As a result of this double review, you can a) address some defects; b) ignore some defects; c) defer some defects by protocoling them in `technical-debt.md`.

### Local code reviews

You can also perform a scoped review/respond cycle on your local machine using a separate "reviewer" subagent by calling

```shell
/he9-review <scope> # e.g., "branch", "worktree", "staged", "commit"
```

This flow adheres to the same `he9-review-contract` and results in the same actionable report as the PR review/respond cycle. 

### Handling technical debt

Implementation of a complex feature might bring in suboptimal code and documentation drift. Generally, task-based workflows do not require frequent refactoring. Instead, we provide a command for scoped improvements:

```shell
/he9-debt scan <scope>      # find debt in scope
/he9-debt promote <item-id> # escalate entry to the issue tracker
```

In the `scan` mode, this flow can analyze the given scope, such as the whole codebase, a given subsystem or a given path. It generally follows the same review/respond cycle according to `he9-review-contract`, but unlike reviews, it looks at the _current_ codebase snapshot rather than at recent _changes_. The "debt" workflow also does not offer fixing defects: instead, they are only tracked in the `technical-debt.md` document (duplicates are removed/merged automatically). In the `promote` mode, it checks whether the specified debt issue still holds, and moves it from the debt document to the tracker (Github/Gitea issues).
