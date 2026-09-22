---
description: "Track technical debt: scan a scope for debt, triage the debt document, or promote an item into focused work"
---

# Technical debt workflow

Goal: identify, track, and deliberately schedule technical debt — including documentation drift — without turning it into unfocused branch-wide refactoring. This is the workflow for improving an existing codebase; `he9_review` is the workflow for reviewing a change.

Both flows have the same shape: **identify** with a separate reviewer party, **dispose** with the responder party, then **act** — fix now, defer into the debt document, or promote into focused work. The reviewer party is what makes the list doubly-checked instead of self-confirmed.

**Project inputs (optional adapter).** Read `.opencode/powers.jsonc` if present; it overrides the defaults below. This command uses: `conventions` (`openspec/conventions.md`), `specs` (`openspec/specs/*/spec.md`), `docs` (`docs/*.md`), `debt` (`openspec/technical-debt.md`), `tracker` (auto: configured forge MCP, else git remote host, else ask), `contract` (`he9-review-contract`). Probe for paths; if one is absent, skip that step rather than guessing.

## Argument

`$ARGUMENTS` selects the mode:

- `scan <scope>`: find debt in a scope, verify it in a second pass, and record it.
- `triage` (default, or empty): maintain the debt document and re-check it for staleness.
- `promote <item-id>`: turn one entry into a focused issue or spec change.

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
4. Write the **accepted** entries into the resolved debt document, using that document's own item template. Do not restate the template here.
5. Report candidates grouped by disposition: what was recorded, and what was rejected and why. Then ask whether any entry should be promoted now.

## Mode: triage

This maintains the debt document. It is the only mode that sweeps the whole document, and it does not implement code changes.

1. Read the resolved debt document.
2. **Staleness pass.** Re-check each entry against the code. If an entry no longer holds — the code changed, the system was removed, the gap closed — mark it `resolved` for removal on the next cleanup.
3. **Maintenance.** Merge duplicates, split oversized entries, clarify scope and impact, adjust Priority, and advance status.
4. Report the proposed or applied refinements, separating "no longer true" from "still true, tidied".
5. Ask whether any entry should be promoted.

## Mode: promote <item-id>

1. Find the entry in the resolved debt document.
2. **Re-check that it is still true** against the code. If it is already fixed, mark it `resolved` instead of promoting it.
3. Summarize the entry and its recommended direction to the user.
4. Choose the path:
   - a tracked issue if it is a bounded implementation task;
   - a spec/design change if it affects behavior contracts, architecture, or multiple subsystems;
   - for doc drift, fix the doc directly when straightforward — apply spec fixes through the appropriate change command/skill rather than editing the specs tree by hand.
5. If creating an issue: list existing issues through the resolved `tracker` first and avoid duplicates.
6. If creating a change: use the appropriate change-proposal command/skill.
7. Report back and update the entry's status in the resolved debt document.
