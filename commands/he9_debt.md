---
description: "Track technical debt: scan a scope for debt, triage the backlog, or promote an item into focused work"
---

# Technical debt workflow

Goal: identify, track, and deliberately schedule technical debt — including documentation drift — without turning it into unfocused branch-wide refactoring. This is the workflow for improving an existing codebase, where `he9_review` is the workflow for reviewing a change.

**Project inputs (optional adapter).** Read `.opencode/powers.jsonc` if present; it overrides the defaults below. This command uses: `conventions` (`openspec/conventions.md`), `specs` (`openspec/specs/*/spec.md`), `docs` (`docs/*.md`), `debt` (`openspec/technical-debt.md`), `tracker` (auto: configured forge MCP, else git remote host, else ask), `contract` (`he9-review-contract`). Probe for paths; if one is absent, skip that step rather than guessing.

## Argument

`$ARGUMENTS` selects the mode:

- `scan <scope>`: find debt in a scope, verify it, and record it.
- `triage` (default, or empty): maintain the existing backlog.
- `promote <item-id>`: turn one backlog item into a focused issue or spec change.

## Grading

One axis: **Priority**, on the contract's `P` scale. Load `he9-review-contract` and read its "Mapping to the debt backlog". In short:

- `P1` — will cause defects or block work soon.
- `P2` — the maintainability / architecture / docs / tests class, no current behavioral impact.
- `P3` — polish.
- `P0` is **never** a debt item. A P0 is fixed, not deferred; if a scan finds one, report it for immediate action instead of logging it.

Do not invent a second scale, and do not add a second axis. An undocumented system is a debt item in its own right ("X has no covering doc"), not a severity of some other item — that is what an earlier, separate health scale was groping at, and it went unused.

## Mode: scan <scope>

`<scope>` is one of:

- `codebase` — every tracked file: `git ls-files`. **Unbounded.** Without a path, say so and suggest narrowing; a whole-repo scan produces low-value nitpicks and does not scale.
- a path (`Assets/Features/InGame`) — that folder and below.
- a capability or domain name — the spec area and the code it covers.

1. Resolve the scope from the argument; if none was given, ask.
2. Find candidates, using the `code-review-expert` checklists (SOLID, security/reliability, code quality) as the inspection lens, so coverage does not depend on improvisation. Inspect across:
   - **Code & architecture:** drift from the resolved conventions file and specs glob; unclear responsibility boundaries; excessive complexity; duplication; weak testability; dead abstractions or obsolete paths.
   - **Docs → Code (accuracy):** read the canonical docs for the scope (the resolved specs glob, plus the relevant docs glob) and cross-check their claims against the source. Flag outdated claims, missing or shipped features, references to deleted systems.
   - **Code → Docs (coverage):** significant systems and core files with no covering doc become items of their own; ignore minor utilities.
3. Grade each candidate by Priority (above).
4. **Verify before recording.** Run the candidates through the `receiving-code-review` pass and give every one a disposition, using the debt reading in `he9-review-contract` → "Dispositions in a debt scan": `accepted`, `rejected`, `already-addressed`, `deferred`. `already-addressed` is duplicate detection — match against the existing backlog before adding anything, and link the `TD-###` rather than creating a second copy.
5. Update the resolved debt backlog file with the **accepted** items only, using that file's own item template. Do not restate the template here.
6. Report candidates grouped by disposition: what was recorded, and what was rejected and why. Then ask whether any item should be promoted now.

## Mode: triage

Backlog **maintenance**, not verification. It does not re-check items against the code, and it is not a substitute for the scan's verification step — it tidies what is already recorded.

1. Read the resolved debt backlog file.
2. Refine for clarity and actionability: merge duplicates, split oversized items, clarify scope and impact, adjust Priority, and advance status. Items whose work has landed are marked `resolved` and removed on the next cleanup pass. Do not implement code changes here.
3. Report the proposed or applied refinements.
4. Ask whether any item should be promoted.

## Mode: promote <item-id>

1. Find the item in the resolved debt backlog file.
2. **Re-check that it is still true** against the code before spending work on it. If it is already fixed, mark it `resolved` instead of promoting it.
3. Summarize the item and its recommended direction to the user.
4. Choose the path:
   - a tracked issue if it is a bounded implementation task;
   - a spec/design change if it affects behavior contracts, architecture, or multiple subsystems;
   - for doc drift, fix the doc directly when straightforward — apply spec fixes through the appropriate change command/skill rather than editing the specs tree by hand.
5. If creating an issue: list existing issues through the resolved `tracker` first and avoid duplicates.
6. If creating a change: use the appropriate change-proposal command/skill.
7. Report back and update the item's status in the resolved debt backlog file.
