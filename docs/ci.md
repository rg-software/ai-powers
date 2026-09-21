# CI review

The PR-review workflow runs the `he9_pr_review` command headless and posts the result as a PR comment. It must run under a trusted configuration, because the PR checkout is attacker-controlled.

## Forge support

The workflow is written to work on both **Gitea Actions** and **GitHub Actions** — the actions it uses (`actions/checkout`, `actions/github-script`) and the `github.rest.*` (octokit) calls are implemented by both. What differs per forge is only the **file location** and the **token secret name**:

| Forge | Put the file at | Token secret |
|-------|-----------------|--------------|
| Gitea | `.gitea/workflows/pull-request-review.yml` | `AIR_GITEA_API_TOKEN` (must be able to comment on issues/PRs) |
| GitHub | `.github/workflows/pull-request-review.yml` | `GITHUB_TOKEN`, or a PAT if you need cross-repo access |

Nothing else in the workflow is forge-specific.

## Invariants (do not weaken)

- The workflow is loaded from the PR **base** branch (`pull_request_target`), never the PR head.
- All executed artifacts are **trusted and pinned**: ai-powers at `AI_POWERS_REF`, and tools from the registry. Nothing from the PR checkout is ever executed.
- The reviewer runs read-only: `edit`/`write`/`question` denied, `webfetch`/`websearch` denied, `bash` restricted to read-only git and listing commands. This stops PR-injected content from exfiltrating the model key through tools.
- The project adapter is read from the **base** SHA, so a PR cannot rewrite the conventions or specs its own review is graded against.

## Where things come from

| Artifact | Source | Pinned |
|----------|--------|--------|
| Workflow + helper scripts | `AI_POWERS_REPO` (`ci/scripts/*.js`) | `AI_POWERS_REF` |
| `ci/commands/he9_pr_review.md`, review skills, contract | `AI_POWERS_REPO` | `AI_POWERS_REF` |
| Project conventions/specs/adapter | PR **base** SHA (via the checkout) | base SHA |

The server-only review command lives at `ci/commands/`, beside the workflow that runs it, and is **not** installed on developer machines — the local installer ships only `commands/`. The workflow copies both sets into the runner's global commands directory.

The workflow commits no project-local helper scripts: it ships its own (`ci/scripts/get-issue-data.js`, `ci/scripts/extract-review-text.js`), so adopting a project is one YAML file plus variables.

## Pinning

`AI_POWERS_REF` may be a **branch** or a **commit SHA**.

- A SHA is fully reproducible: the same PR is reviewed by the same contract revision forever.
- A branch auto-updates, but it means whoever can push to `ai-powers` changes what runs in every consuming repo's CI, with no diff in the consuming repo. To make branch refs safe, protect `ai-powers` main (require review), or bump by PR.
- Either way, the workflow records the **resolved** SHA in the review footer (`ai-powers@<sha>`), so every posted review is traceable to a contract revision.

## Variables and secrets

| Name | Kind | Meaning |
|------|------|---------|
| `AI_POWERS_REPO` | var | `owner/ai-powers` |
| `AI_POWERS_REF` | var | branch or SHA of ai-powers to use |
| `AI_MODEL_NAME` | var | reviewer model id |
| `AI_REVIEW_MENTION` | var, optional | comment text that triggers a manual review (default `@ai-reviewer`) |
| `OPENROUTER_API_KEY` | secret | model provider key |
| `AIR_GITEA_API_TOKEN` | secret | token used to post the review comment |

## Reviewer identity

The reviewer is **not** matched by user name and is not configurable. Every posted review begins with the marker `<!-- he9-reviewer:v1 -->`, and `he9_review respond` matches that marker. Rename the token's user, or post with a different token, and the cycle still works.

`AI_REVIEW_MENTION` is a separate concept: it is the text a *human* writes in a comment to trigger a manual review (default `@ai-reviewer`). It is a plain substring test and need not name a real user.

## Adopting in a new project

1. Copy `ci/pull-request-review.yml` to `.gitea/workflows/` or `.github/workflows/`.
2. Set the variables and secrets above on the forge.
3. (Optional) Add a project adapter `.opencode/powers.jsonc` only if the project deviates from the standard layout — see `docs/adapter.md`.
4. On each developer machine, run this repo's `install/install.ps1` (or `.sh`) to get the commands and skills.
