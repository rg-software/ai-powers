# CI review

The PR-review workflow runs the `he9_pr_review` command headless and posts the result as a PR comment. It must run under a trusted configuration, because the PR checkout is attacker-controlled.

## Invariants (do not weaken)

- The workflow is loaded from the PR **base** branch (`pull_request_target`), never the PR head.
- All executed artifacts are **trusted and pinned**: the workflow scripts, the review command, and the ai-powers skills all come from a pinned revision, never from the PR checkout.
- The reviewer runs read-only: `edit`/`write`/`question` denied, `webfetch`/`websearch` denied, `bash` restricted to read-only git and listing commands. This keeps PR-injected content from exfiltrating the model key through tools.

## Where things come from

| Artifact | Source | Pinned |
|----------|--------|--------|
| Workflow + helper scripts | PR base branch | base SHA |
| `he9_pr_review` command, review skills, contract | `AI_POWERS_REPO` | `AI_POWERS_REF` (commit SHA) |
| Project conventions/specs/adapter | PR **base** SHA (via the checkout) | base SHA |

Pinning `AI_POWERS_REF` to a commit SHA is what makes the reviewer reproducible and keeps it on the same contract revision as local machines. Update it deliberately, in its own commit.

## Variables

| Name | Kind | Meaning |
|------|------|---------|
| `AI_POWERS_REPO` | var | `owner/ai-powers` |
| `AI_POWERS_REF` | var | commit SHA of ai-powers to use |
| `AI_MODEL_NAME` | var | model id for the reviewer |
| `OPENROUTER_API_KEY` | secret | model provider key |
| `AIR_GITEA_API_TOKEN` | secret | token used to post the review comment |

## Adapter

`he9_pr_review` reads the project adapter at `.opencode/powers.jsonc` from the **base** SHA, so a PR cannot rewrite the conventions or specs its own review is graded against.

## Note on the comment author

`he9_review respond` looks for PR comments authored by the project's `reviewBot` (default `ai-reviewer`). Whatever user `AIR_GITEA_API_TOKEN` belongs to must match that value, or respond mode will not find the review.
