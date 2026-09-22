---
name: he9-review-contract
description: Shared code-review rubric — severity P0-P3 with non-overlapping triggers, category, scope, action (fix-now vs defer), disposition, finding schema, and review/response output formats. Load it when reviewing code or responding to a review, before assigning a severity or deciding whether something is fixed in-branch or deferred. Referenced by code-review-expert, receiving-code-review, and the he9_review / he9_pr_review commands.
license: MIT
---

# Review Contract

One vocabulary for both sides of a code review. The reviewer grades with it; the responder answers with it. Any document that reviews or responds should reference this file rather than restating it.

## Why this exists

A rubric does not make two reviewers agree. It makes disagreement **legible**: two people can point at the same axis and see exactly where they differ. That is the whole value — not objectivity, but cheap arbitration.

## Non-goals

- Not a substitute for tests. A finding is "no behavioral impact" only if a test or a spec says so.
- Not a merge gate by itself. It feeds a human decision.
- Not a style guide. Project style lives in the project — its conventions file (the adapter's `conventions` key) and `.editorconfig`.

---

## The four axes

Keep these separate. Fusing them is the most common source of argument.

| Axis | Question it answers | Values |
|------|--------------------|--------|
| **Severity** | How bad if shipped as-is? | `P0` `P1` `P2` `P3` |
| **Category** | What kind of problem? | see below |
| **Scope** | Where does it live relative to this change? | `in-touched` `adjacent` `project-wide` |
| **Action** | What do we do about it? | see below |

Decided by different criteria on purpose: **severity** by impact, **action** by scope and cost. A `P2` in touched code is fixed now only when it is *cheap* (see Action); the same `P2` outside the touched scope is deferred. Severity does not decide action; scope and cost do.

---

## Severity (P0-P3)

Triggers are non-overlapping by construction. Grade at the **highest** level whose trigger fires, and cite the trigger in the finding.

### P0 - Critical

At least one of:

- An exploitable security vulnerability (injection, authz bypass, secret exposure, unsafe deserialization, a missing tenancy check).
- Data loss or corruption: wrong data written to persistence, or an unrecoverable state, reachable from normal use.
- A crash or hang on a mainline path, **or any crash that discards unsaved work**.
- Breaks the build, or breaks an existing passing test, for everyone.

**Action:** block merge. Never defer silently.

### P1 - High

At least one of:

- Incorrect behavior on a reachable path in the change's intended use — including a **silent wrong result** that neither persists nor is a security outcome. **A logic error is P1, not P0.**
- A regression of existing tested behavior.

**Action:** fix before merge.

### The P0/P1 boundary

The test is **blast radius and reversibility**, not how bad it feels:

- **P0** is damage you cannot take back — data lost or corrupted, a secret exposed, a whole team blocked — or a mainline path that does not run at all.
- **P1** is a wrong result you can fix by shipping a patch.

Tie-break when two reviewers disagree: *can a follow-up patch undo it?* If it cannot — the data is gone, the secret leaked — it is P0.

### P2 - Medium

- A defect **introduced or aggravated by this change** with no current behavioral impact: maintainability or architecture (duplication, a broken responsibility boundary, a testability regression, drift from the project's conventions or specs), a doc this change made wrong, or missing test coverage for behavior it added.

**Action:** fix in-branch if `in-touched` and cheap; otherwise defer to the debt backlog.

### P3 - Low

- Naming, style, formatting, doc polish, or a preference with no functional or structural impact.

**Action:** optional. Do not let P3 noise bury P0-P2; report them last or summarize.

### The overlap rule

`P0` is reserved for its four triggers. If a defect is "incorrect behavior", it is `P1` even if it feels severe. This rule exists because the previous rubric defined `P0 = correctness bug` and `P1 = logic error`, which are the same thing — and two reviewers graded the same defect differently because of it.

---

## Category

`correctness` `security` `data-integrity` `performance` `maintainability` `architecture` `docs` `tests`

Category is descriptive, not hierarchical. It tells the reader what kind of work a fix is, and it drives the deferral target: `docs` and `maintainability` findings usually become debt, `correctness` and `security` usually do not.

### Category defaults

A category implies a default severity and action. Use these unless a trigger overrides them, so two reviewers land in the same place:

| Category | Default | Notes |
|----------|---------|-------|
| `correctness` | P1, fix-now | Escalate to P0 only through a P0 trigger (persisted corruption, mainline crash). |
| `security` | P0, fix-now | Exploitable ⇒ P0. A hardening gap with no exploit path is P2 and may defer. |
| `data-integrity` | P0, fix-now | Persistence, transactions, duplicate or lost writes. |
| `performance` | P2, defer | P1 only for a measured or obvious regression on a hot path. |
| `maintainability` | P2, scope-decided | Fix now only when `in-touched` and cheap. |
| `architecture` | P2, scope-decided | Same; wider refactors always defer. |
| `docs` | P2 | Doc this change made wrong ⇒ fix-now in touched scope. Pre-existing drift ⇒ defer-debt. |
| `tests` | P2 | Missing coverage for behavior this change added ⇒ fix-now if cheap, else defer. A **weakened or removed** test that guarded behavior is P1; a **failing** test is P0. |

---

## Scope

- `in-touched` - in code this change actually modified or added.
- `adjacent` - in files this change touched, but in code it did not modify.
- `project-wide` - elsewhere in the repo.

Project rules (e.g. "refactor only what the task touches") are scope rules. They live in the project's `AGENTS.md`; this contract only supplies the vocabulary.

---

## Action

- `fix-now` - address in this branch before merge.
- `defer-debt` - record in the project's technical-debt backlog.
- `promote-issue` - spin up a focused tracked issue.
- `promote-change` - spin up a spec/design change (behavior or multi-subsystem).
- `wontfix` - explicit decision not to act. Must state why.

Policy:

| Severity | in-touched | adjacent | project-wide |
|----------|-----------|----------|--------------|
| P0 | fix-now | fix-now | fix-now or promote-issue **now** |
| P1 | fix-now | fix-now | promote-issue |
| P2 | fix-now if cheap, else defer-debt | defer-debt | defer-debt |
| P3 | optional | defer-debt or wontfix | wontfix |

"Cheap" is a conjunction, not a feeling. A P2 in touched scope is cheap only if **all** hold:

- it is one mechanical transformation (extract, rename, move, split) confined to the touched files;
- it changes no public interface, persisted format, or on-disk contract;
- it is verifiable by tests that already exist, or by a test the project's harness makes trivial to add;
- it stays under roughly 50 changed lines.

If any fails — in particular, if the fix is large enough to deserve its own review — it is not cheap; defer it.

---

## Disposition (responder only)

Every finding gets exactly one disposition, keyed by finding id:

- `accepted` - I agree; fixed at `<ref>` or will be.
- `rejected` - technically incorrect here; state the reason and the evidence (test, spec, code).
- `deferred` - agreed but out of scope; state the backlog id or issue.
- `already-addressed` - covered by an existing change; cite it.

A response with a finding missing a disposition is incomplete. This is the artifact the responder's skill was missing: a checkable, 1:1 mapping back to the review.

---

## Finding schema

Every finding, from any reviewer, carries:

```
id:        R-<n>            stable within one review
file:line
severity:  P0|P1|P2|P3      cite the trigger
category:  ...
scope:     in-touched|adjacent|project-wide
rule:      spec/convention ref, or "none"   what it is graded against
evidence:  what you observed (code, test, spec, reproduction)
impact:    what happens if not fixed
suggestion: minimal, safe direction
action:    fix-now|defer-debt|promote-issue|promote-change|wontfix
```

`rule` and `evidence` are what make a finding verifiable rather than an opinion. "Drift from conventions" without a `rule` citation is not actionable.

---

## Coverage

When a **graded input is absent** — no conventions file, no specs, no adapter — say so explicitly in the review's `Not reviewed` section: name the input and what therefore was not graded. Absence must never be silent. A review that drops architecture-drift grading because specs were missing must not read as if it were clean.

This matters more than it looks: the commands find what to grade against by probing for these inputs, and a failed probe that goes unmentioned silently narrows the review while leaving its verdict unchanged.

---

## Report formats

### Reviewer output

```
## Code Review Summary
Files reviewed: X (Y lines changed)
Base: <sha>  Head: <sha>
Assessment: APPROVE | REQUEST_CHANGES | COMMENT
Contract: he9-review-contract

## Findings
### P0 - Critical
- R-1 [path:line] title
  category / scope / rule
  evidence:
  impact:
  suggestion:
  action:
### P1 - High
### P2 - Medium
### P3 - Low        (summarize; list individually only if few)

## Deferred
- R-n -> defer-debt: one-line summary (for the backlog)

## Not reviewed
Explicit list of anything in scope you did not assess, and why — including any
graded input that was absent (e.g. no specs found, so drift was not graded
against a contract).
```

### Responder output

```
## Review Response
Review: <ref to the review, e.g. PR #123 comment / local report>

| id  | severity | disposition | note |
|-----|----------|-------------|------|
| R-1 | P0       | accepted    | fixed in <file:line> |
| R-2 | P2       | rejected    | spec says X; see <ref> |
| R-3 | P2       | deferred    | TD-014 |

## Proposed for this branch
- items the responder recommends fixing now

## Dispositions requiring human decision
- items where the responder and reviewer disagree, or that are architectural
```

---

## Mapping to the debt backlog

A deferred finding lands in the project's debt backlog — the adapter's `debt` file, conventionally `openspec/technical-debt.md` — with:

- **Priority** = the severity *class* of the deficiency, on this same `P` scale. Do not invent a second one. `P0` is excluded: a P0 is fixed, never deferred.
- **Scope** = the finding's `path:line`, or the affected area. This is a *location* — the `scope` axis above (`in-touched`/`adjacent`/`project-wide`) is change-relative and does not apply to a backlog item.
- The finding's `id` and the review reference, so the deferral is traceable.

Because a backlog item describes code that already exists rather than a change, the severity wording is read **without its change-relative clauses**. The class and the ordering carry over; the "introduced by this change" framing does not:

| Priority | reading for existing code |
|----------|---------------------------|
| `P1` | will cause defects or block work soon |
| `P2` | the maintainability / architecture / docs / tests class, with no current behavioral impact |
| `P3` | polish |

### Dispositions in a debt scan

`he9_debt scan` verifies candidate items with the disposition vocabulary above, read as:

| disposition | meaning for a candidate debt item |
|-------------|-----------------------------------|
| `accepted` | confirmed real; record it |
| `rejected` | not an issue; state why and drop it |
| `already-addressed` | already in the backlog, or already fixed — link the `TD-###` instead of adding a duplicate |
| `deferred` | real, but not worth recording now |

### Removal scales

A removal/cutdown plan is **not** severity. Use `R0` (remove now: obsolete, unreferenced, safe), `R1` (remove this iteration: needs migration or sign-off), `R2` (backlog). Never reuse `P0-P3` for removal priority — the previous skill did, which made one report say `P1` meaning two different things.
