# Testing the review loop

Acceptance script for the responder round-trip. It is written for a real project, because the parts that matter — the forge API, the comment thread, the second push — cannot be exercised by the unit tests. Run it against a project whose workflow was copied from the same revision as the skills.

The loop has one opt-in condition worth checking first: the prompt wiring lives in the **project's** `pull-request-review.yml`, not in ai-powers. Updating `AI_POWERS_REF` alone updates the agent and skills but does not activate reconciliation; the workflow file must be re-copied.

## Before you start

- [ ] The project's PR-review workflow is the new `ci/pull-request-review.yml`, not the previous copy.
- [ ] `AI_POWERS_REF` resolves to the revision under test (or `main`).
- [ ] Local skills are the same revision: `npx skills update -g`.
- [ ] The branch carries two deliberate P2 findings: one you will **reject** with a spec- or code-backed reason, one you will **defer** to `technical-debt.md`.
- [ ] You can read raw comment bodies (`gh api .../issues/{n}/comments`, or `tea pr <n> --comments --output json`). List renderers may truncate markers.

## 1. Local review — no PR involved

Run `/he9-review branch` on the branch.

Expected:

- [ ] It announces `Reviewing party: reviewer`. If the subagent is missing, it stops and offers a self-review; it does not silently self-review.
- [ ] The review uses the contract format: summary, findings with `R-<n>`, severity/category/scope/rule/evidence/impact/suggestion/action.
- [ ] The response table gives exactly one disposition per finding.
- [ ] It asks **A** fix all / **B** choose / **C** defer before writing anything.
- [ ] **No comment is posted anywhere.** A local review has no transport.
- [ ] Nothing is written to `technical-debt.md` before you answer.
- [ ] After you choose **C**, a self-contained debt entry appears, with evidence and `file:line`.

Failure signs: a forge comment appears; debt is written before the choice; a finding has no disposition.

## 2. PR review — first round

Open the PR and let the workflow run.

Expected:

- [ ] Exactly one new comment, body starts with `<!-- he9-reviewer:v1 -->`.
- [ ] `## Prior Findings` is present and says `None (no prior response).`
- [ ] The footer records `ai-powers@<sha>`.
- [ ] Findings carry stable ids and the contract fields.

Then run `/he9-review respond <n>`.

Expected:

- [ ] It reads the **newest marked review** and the existing responder slot (none yet).
- [ ] It prints the same table it will publish.
- [ ] It asks you to confirm the dispositions and choose A/B/C.
- [ ] **No responder comment exists yet.** This is the human gate; publishing before this answer is a failure.

Overrule one disposition in the chat, then answer.

Expected:

- [ ] Exactly one comment starts with `<!-- he9-responder:v1 -->`.
- [ ] Its `Review:` line names the review comment it answers.
- [ ] The overruled row shows your decision, not the model's original.
- [ ] `accepted` rows say `fixing` or cite a commit sha; `deferred` rows name a `TD-###`.
- [ ] Deferred items are in `technical-debt.md`; rejected items are not.
- [ ] Only the issues you chose are being fixed.

Run `/he9-review respond <n>` again without a new review.

Expected:

- [ ] It **edits** the existing responder comment. There is still exactly one.

## 3. PR review — second push (the gap this closes)

Push a trivial commit. Do **not** fix the rejected or deferred finding.

Expected:

- [ ] A new review comment is posted.
- [ ] `## Prior Findings` lists the rejected one as rejected, with the reasoning, and the deferred one as deferred to its `TD-###`.
- [ ] Neither appears again under `## Findings`.
- [ ] Re-raised findings keep their original ids; new findings are numbered above the highest prior id.
- [ ] Every id from the previous review appears in `## Prior Findings`. A missing id is a reconciliation failure, not a clean review.

## 4. The disagreement guard

Remove or weaken the evidence a rejection cited — or write a rejection with no test, spec, or `file:line` — then push.

Expected:

- [ ] The finding is re-raised.
- [ ] The review names which ground fired: evidence absent, premise changed, or the reason violates the contract's policy.
- [ ] It is not silently suppressed by the response. The diff wins.

## 5. The fixed case

Fix an `accepted` finding and push.

Expected:

- [ ] `## Prior Findings` says `fixed in <file:line>`.
- [ ] No finding for it appears under `## Findings`.

## 6. No response (old client, or a deliberate skip)

Push without running `respond`.

Expected:

- [ ] `## Prior Findings` says `None (no prior response).`
- [ ] The review behaves as the previous stateless version: findings are re-derived from the diff.
- [ ] No error, and no stale suppression from an earlier round.

## 7. Version skew

- [ ] **New server, old local skills:** no responder comment is posted, so §6 holds. The only visible change is the `## Prior Findings` line.
- [ ] **Old server, new local skills:** the responder comment is posted and ignored by the old reviewer; nothing fails. After the server is updated, that comment is read without migration.

## Not covered by this script

- Comment truncation at 12,000 / 8,000 characters (unit-tested only).
- Two pushes landing while a review is in flight.
- A third-party PR author fabricating a response comment; the reviewer treats it as a claim, but that is a prompt-level mitigation, not a hard guarantee.
