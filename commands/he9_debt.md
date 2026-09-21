---
description: "Track technical debt: scan a scope, triage the backlog, or promote an item into focused work"
---

# Technical debt workflow

Goal: identify, track, and deliberately schedule technical debt — including documentation drift — without turning it into unfocused branch-wide refactoring.

**Project inputs (optional adapter).** Read `.opencode/powers.jsonc` if present; it overrides these defaults: `baseBranch` from `origin/HEAD` else `main`; `conventions` = `openspec/conventions.md`; `specs` = `openspec/specs/*/spec.md`; `debt` = `docs/technical-debt.md`; `docs` = `docs/*.md`; `reviewDir` = `.opencode/reviews`; `tracker` = auto (configured forge MCP, else git remote host, else ask); `contract` = `he9-review-contract`. Probe for paths; if one is absent, skip that step rather than guessing.

The mode is determined by the argument:

- `scan <scope>`: inspect a scope and update the backlog.
- `triage` (default): review and refine the existing backlog.
- `promote <item-id>`: turn one backlog item into a focused issue or spec change.

## Grading

Grade every finding with the same two axes the backlog already uses, and keep them distinct (see `he9-review-contract`):

- **Priority** — the same `P1`–`P3` scale as review severity. `P1` significant, `P2` worth scheduling, `P3` minor. Never invent a second P scale; a deferred review finding keeps its severity as its priority.
- **Level** — the backlog's health scale: 🟢 Healthy, 🟡 Slightly Drifted, 🔴 Severely Outdated/Broken, ⚪ Undocumented/Untracked.

Do not log 🟢 Healthy findings — they are report status only, never backlog entries.

## Mode: scan <scope>

1. Identify the scope; if none was given, ask which domain or folder to scan.
2. Inspect it for debt, across code/architecture and documentation:
   - **Code & architecture:** drift from `{{conventions}}` and `{{specs}}`; unclear responsibility boundaries; excessive complexity; duplication; weak testability; dead abstractions or obsolete paths.
   - **Docs → Code (accuracy):** read the canonical docs for the scope (`{{specs}}`, plus relevant `{{docs}}`) and cross-check their claims against the actual source. Flag outdated claims, missing/shipped features, references to deleted systems.
   - **Code → Docs (coverage):** identify primary systems and core files and check whether each is documented. Flag significant systems with no covering doc; ignore minor utilities.
   - Not all docs are spec-based: design notes under the `docs` paths are sources too. Canonical technical truth lives in `{{specs}}`; design intent may live elsewhere.
3. Grade each discrete item by Priority and Level (above).
4. Keep the scan shallow-to-moderate: identify actionable items; do not perform sweeping code or doc changes here.
5. Update `{{debt}}`: add new items, refine existing ones, avoid duplicates.
6. Report findings by level and note which are newly added.
7. Ask whether any item should be promoted now.

## Mode: triage

1. Read `{{debt}}`.
2. Review the backlog for clarity and actionability: merge duplicates, split oversized items, clarify scope and impact, adjust priority and status. The backlog is a planning artifact — do not implement code changes in this mode.
3. Report the proposed or applied refinements.
4. Ask whether any item should be promoted.

## Mode: promote <item-id>

1. Find the item in `{{debt}}`.
2. Summarize it and its recommended direction to the user.
3. Choose the path:
   - a tracked issue if it is a bounded implementation task;
   - a spec/design change if it affects behavior contracts, architecture, or multiple subsystems;
   - for doc drift, fix the doc directly when straightforward — apply spec fixes through the appropriate change command/skill rather than editing `{{specs}}` by hand.
4. If creating an issue: list existing issues first and avoid duplicates.
5. If creating a change: use the appropriate change-proposal command/skill.
6. Report back and update the item's status in `{{debt}}`.
