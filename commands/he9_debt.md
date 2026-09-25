---
description: "Track internal technical debt: scan a scope for debt, or promote an entry to the external tracker"
---

# Technical debt workflow

Goal: identify and record internal technical debt — including documentation drift — without turning it into unfocused branch-wide refactoring and without polluting the public tracker. This is the workflow for improving an existing codebase; `he9_review` is the workflow for reviewing a change.

Two backlogs, split by **audience**:

- **Internal** — the resolved `debt` document, committed and developer-facing. Debt found locally (by a developer, a review, or a scan) lands here. Entries are almost always worked from here, not filed as tracker issues.
- **External** — the resolved `tracker`. Issues reported by clients or users, or work that genuinely concerns outsiders, live there.

`promote` is the one-way bridge: escalate an internal entry to the external tracker when outsiders turn out to care. Most debt never needs it — it is picked up with `he9_start` and fixed directly.

A scan is doubly-checked: a separate reviewer party finds candidates, the responder party verifies and disposes of them, and the human arbitrates the exceptions. A list that both finds and approves its own findings is the weakest possible review.

**Project inputs (optional adapter).** Read `.opencode/powers.jsonc` if present; it overrides the defaults below. This command uses: `conventions` (`openspec/conventions.md`), `specs` (`openspec/specs/*/spec.md`), `docs` (`docs/*.md`), `debt` (`openspec/technical-debt.md`), `tracker` (auto: configured forge MCP, else git remote host, else ask), `contract` (`he9-review-contract`). Probe for paths; if one is absent, skip that step rather than guessing.

## Argument

`$ARGUMENTS` selects the mode:

- `scan <scope>`: find debt in a scope, verify it in a second pass, arbitrate the exceptions, and record it. This is the default when the argument is empty.
- `promote <item-id>`: escalate one entry to the external tracker and remove it from the internal document.

## Grading

One axis: **Priority**, on the contract's `P` scale. Load `he9-review-contract` and read its "Mapping to the debt backlog". In short:

- `P1` — will cause defects or block work soon.
- `P2` — the maintainability / architecture / docs / tests class, no current behavioral impact.
- `P3` — polish.
- `P0` is **never** a debt entry. A P0 is fixed, not deferred; if a scan finds one, report it for immediate action instead of recording it.

Do not invent a second scale, and do not add a second axis. An undocumented system is a debt entry in its own right ("X has no covering doc"), not a severity of some other entry.

## Mode: scan <scope>

`<scope>` is one of:

- `codebase` — every tracked file: `git ls-files`. **Unbounded.** Without a path, say so and suggest narrowing; a whole-repo scan produces low-value nitpicks and does not scale.
- a path (`Assets/Features/InGame`) — that folder and below.
- a capability or domain name — the spec area and the code it covers.

1. Resolve the scope from the argument; if none was given, ask.
2. **Identify, via the separate reviewer party.** Invoke the `@reviewer` subagent so the candidate list is produced by a different mind than the one that will judge it. If no `reviewer` subagent is configured, do not fail with a raw error: say so (see `docs/adapter.md` → "Local reviewer agent") and offer a self-audit instead. Give it this task:

   > Audit `<scope>` for technical debt using the `code-review-expert` checklists (SOLID, security/reliability, code quality). Report candidates with `file:line`, the symptom, why it matters, a suggested direction, and a proposed Priority (`he9-review-contract` → "Mapping to the debt backlog"). Cover three lenses: code and architecture drift from the resolved conventions file and specs glob; docs → code accuracy (claims in the resolved specs glob and docs glob that the source no longer matches); and code → docs coverage (significant systems with no covering doc).
   >
   > Do not record anything. Report candidates only.

3. **Dispose.** Verify each candidate yourself against the code, using the `receiving-code-review` discipline, and give every one a disposition from `he9-review-contract` → "Dispositions in a debt scan": `accepted`, `rejected`, `already-addressed`, `deferred`. `already-addressed` is duplicate detection — match against the debt document before adding anything, and link the existing `TD-###` rather than creating a second copy. A reviewer-party candidate you cannot reproduce is `rejected`, with the reason.
4. **Arbitrate with the human — exceptions only.** Present the candidate list with its point-by-point response, then ask the human to confirm or overturn the items that need judgement:
   - every `rejected` and `deferred` candidate, with the reason — a false rejection is lossy and invisible, so it gets a second pair of eyes;
   - every `P1` candidate;
   - any candidate whose disposition you are unsure of.

   Do not record anything until this step is done. Routine `accepted` items need no discussion.
5. Write the **accepted** entries into the resolved debt document, using that document's own item template. Do not restate the template here. Each entry must be **self-contained** (see `he9-review-contract` → "Mapping to the debt backlog"): inline the evidence, symptom, `file:line`, and rationale, because no review report is kept.
6. **Gardening pass over the whole document.** This is the maintenance that used to be a separate mode, and it does not implement code changes:
   - re-check each entry against the code and mark one that no longer holds `resolved` for removal;
   - merge duplicates and group closely related entries;
   - split oversized entries, clarify scope and impact, and re-check Priority.

   An entry whose fix has already merged should have been removed by the fixer on that branch; if one lingers, remove it here.
7. Report what was recorded and the gardening outcome. Then ask whether any entry should be picked up now (via `he9_start <TD-id>`, the normal path) or promoted (escalation, rare).

## Mode: promote <item-id>

Escalation only. Picking up an entry to fix it is `he9_start <TD-id>`; this mode is for when an internal item turns out to concern outsiders.

1. Find the entry in the resolved debt document.
2. **Re-check that it is still true** against the code. If it is already fixed, mark it `resolved` instead of promoting it.
3. Summarize the entry and tell the user you are escalating it to the external tracker; confirm before acting.
4. List existing issues through the resolved `tracker` first and avoid duplicates.
5. Create the issue. It must stand alone for its external audience: do not leak internal `TD-###` ids or internal-only context into the body. Keep provenance in the commit that removes the entry, not in the public issue.
6. On success, **remove the entry from the debt document** in the same change, so the issue and the document never track the same item twice. Note the promotion in the commit message.
