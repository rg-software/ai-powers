---
name: receiving-code-review
description: How to respond to code review feedback with technical rigor instead of performative agreement — verify before implementing, clarify ambiguous items before touching anything, and assign one disposition per finding in a disposition table. Use when receiving review feedback from a person, bot, or subagent, or when asked to respond to a review. Uses the he9-review-contract vocabulary.
---

# Receiving Code Review

Code review is technical evaluation, not social performance.

**Core principle:** verify before implementing; ask before assuming; technical correctness over social comfort.

## Before you respond

**Load the `he9-review-contract` skill.** It defines the vocabulary you must answer in: severity, category, scope, action, and — most importantly — the **disposition** values (`accepted`, `rejected`, `deferred`, `already-addressed`) and the responder output format. Every finding gets exactly one disposition. A response missing a disposition for any finding is incomplete.

This skill is the counterpart to `code-review-expert`: that one produces findings, this one answers them, and both use the contract so the two halves line up 1:1.

## The response process

```
1. READ:      the complete review without reacting
2. UNDERSTAND: restate each requirement in your own words
3. VERIFY:    check each against the codebase, tests, and specs
4. EVALUATE:  is it technically sound for THIS codebase?
5. DECIDE:    assign a disposition to every finding
6. RESPOND:   emit the disposition table, with reasoning for rejects
7. IMPLEMENT: accepted items one at a time, test each
```

## Handling unclear feedback

```
IF any item is unclear:
  STOP - do not implement anything yet
  ASK for clarification on the unclear items

WHY: items may be related; partial understanding produces a wrong implementation.
```

Example — you understand 1, 2, 3, 6 but not 4 and 5:

- Wrong: implement 1, 2, 3, 6 now, ask about 4 and 5 later.
- Right: "I understand 1, 2, 3, 6. I need clarification on 4 and 5 before proceeding."

## Source-specific handling

The reviewer is not always the user. Establish which it is before you weigh a finding.

### From the user directly

- Trusted — implement after understanding.
- Still ask if the scope is unclear.
- Skip the ceremony: state the requirement or just act.

### From an external reviewer, bot, or subagent

```
BEFORE implementing:
  1. Technically correct for THIS codebase?
  2. Does it break existing functionality?
  3. Why is the current code the way it is?
  4. Does it hold on all platforms/versions in scope?
  5. Does the reviewer have the full context?

IF the suggestion seems wrong:  push back with technical reasoning and evidence.
IF you cannot verify:          say so, and ask how to proceed.
IF it conflicts with a prior decision of the user's: stop and discuss with the user first.
```

A `@reviewer` subagent and a CI bot both fall in this bucket — verify, do not defer to them. Cross-model review is only useful if you check it.

## YAGNI check

```
IF the reviewer suggests "doing it properly":
  grep the codebase for actual usage
  IF unused: "This isn't called anywhere. Remove it (YAGNI)?"
  IF used:   then do it properly
```

If you and the reviewer both report to the user, the user decides whether an unused feature is worth building. Do not add scope because a review implied it.

## Implementation order

```
1. Clarify anything unclear FIRST
2. Then implement in this order:
   - P0/P1 findings (blocking: breaks, security, correctness)
   - simple fixes (typos, imports, naming)
   - P2 fixes in touched scope
   - larger refactors (only if agreed as fix-now)
3. Test each fix individually
4. Verify no regressions
```

Severities come from the contract. Deferred items go to the backlog, not into this branch.

## When to push back

Push back when:

- The suggestion breaks existing functionality.
- The reviewer lacks full context.
- It violates YAGNI (unused feature).
- It is technically incorrect for this stack.
- Legacy or compatibility reasons exist.
- It conflicts with the user's architectural decisions.

How: technical reasoning, not defensiveness; specific questions; reference working tests and code; involve the user if it is architectural. If pushing back feels uncomfortable, name that and raise the issue anyway.

## Tone

Active voice over gratitude. Actions show you heard the feedback; the fix is the acknowledgement.

- Prefer: "Fixed in `file:line`." / "Checked X — it does Y, so this needs the fallback instead."
- Avoid: "You're absolutely right!", "Great point!", "Thanks for catching that!", and gratitude generally.

This is a **tone** rule, not a technical one. It is separated here deliberately: do not let the style preference substitute for the verification in the process above.

## When you were wrong

```
CORRECT WITH:  "You were right - I checked X and it does Y. Implementing now."
NOT WITH:      a long apology, a defence of the original pushback, or over-explaining.
```

State the correction factually and move on.

## Output

Emit the **responder output format from the contract** — the per-finding disposition table, the items proposed for this branch, and any dispositions needing a human decision. If this is a GitHub/Gitea inline review, reply in the comment thread (`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies` for GitHub), not as a top-level comment.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Performative agreement | State the requirement or just act |
| Blind implementation | Verify against the codebase first |
| Batch without testing | One at a time, test each |
| Assuming the reviewer is right | Check whether it breaks things |
| Avoiding pushback | Technical correctness over comfort |
| Partial implementation | Clarify all items first |
| Missing disposition | Every finding gets exactly one |
| Cannot verify, proceeding anyway | State the limitation and ask |
