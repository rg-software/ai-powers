---
name: he9-tdd
description: "Write failing tests for an OpenSpec change before implementation - RED gate between propose and apply. Use when the user asks to add tests for a change, gate implementation on tests, or run the TDD step. Invocation text is the change name (inferred from context when omitted)."
license: MIT
metadata:
  opencode/autoinvoke: false
---

# TDD gate for an OpenSpec change

Goal: write **real** failing tests from a change's specs and confirm a solid RED before any implementation begins. This skill sits between `propose` and `apply`: it produces the contract `apply` must satisfy, then stops.

**Invocation.** The invocation text is the text that accompanied this skill — the words after the skill name. Read it as the **change name**. If it is empty, infer the change from conversation context; if exactly one active change exists, use it; otherwise list the candidates and ask. Never guess silently.

**Project inputs (optional adapter).** Read `powers.jsonc` if present; it overrides the defaults below. This skill uses: `conventions` (`openspec/conventions.md`), `specs` (`openspec/specs/*/spec.md`). Probe for paths; if one is absent, skip that step rather than guessing. Test framework, test location, and run commands come from the resolved conventions file — never hardcode them.

## Step 0. Resolve test conventions

1. Read the resolved conventions file for: test framework and modes (e.g. EditMode vs PlayMode), test root and naming, the command to run a single test file, and any canonical reference test to mirror (imports, mocks, helpers).
2. If the conventions file is absent or silent on any of these, ask the user — do not fall back to another stack's runner.
3. Announce what you resolved: `Runner: <cmd> · Test root: <path> · Reference: <file|none>`.

## Step 1. Select the change

- Use the invocation change name when given; confirm its directory `openspec/changes/<name>/` exists.
- Otherwise infer from context, or auto-select when only one active change (non-archive) exists.
- If ambiguous, list the active changes and ask.

Announce: `Using change: <name>`.

## Step 2. Parse scenarios from specs

- Read every `specs/**/*.md` under `openspec/changes/<name>/` (the resolved specs for this change, not the main `specs/` tree).
- If none exist, stop: say to run `propose` first so specs with `Scenario:` blocks exist, then re-run this skill.
- For each file, extract every scenario block with its parent requirement name and its WHEN / THEN lines. Skip files with no scenarios and note them.
- Translate each THEN clause into assertion intent now; vague THEN clauses ("UI updates", "handles correctly") are spec quality gaps — flag them in the report, never pad with a stub assertion.

Announce: `<N files> · <M scenarios> · source-of-truth: changes/<name>/specs`.

## Step 3. Derive test file paths

For each capability, in priority order:

1. `design.md` Implementation Map — a table mapping capability to implementation file.
2. `design.md` path mentions — any source path naming the capability or a related module.
3. Project search for the best non-test match (e.g. matching class/file name outside test roots).
4. Ask the user with the candidate list. Never guess silently.

Place the test file per the resolved conventions (same directory, `Tests` sibling, or project test root as conventions dictate). If a test container with the same name already exists, append cases inside it rather than duplicating it.

## Step 4. Write REAL failing tests

- Import and exercise the real unit under test — a missing module, export, or component is a valid RED.
- Assert real outcomes from the THEN clauses: presence, values, call args, emitted state. Drive user actions the way the scenario describes them.
- When a scenario needs an identifier or seam that does not exist yet, choose the canonical name now and assert against it. The test defines the contract; `apply` must implement exactly that. List every such contract item in the report.
- When a value is genuinely unknowable from the artifacts, assert the observable behavior or mark the case skipped with a one-line reason and log it as a behavior gap. Never write forced-fail placeholders.
- Never modify existing passing tests.

## Step 5. Run tests and confirm RED

- Run the conventions command against each written file, filtered to the new cases where the runner supports it.
- FAIL for the right reason (missing element/id, missing export/module, wrong value) is the expected RED — capture the failure message per test.
- FAIL for a wrong reason (typo, bad import path, malformed selector, missing mock) means the test is incorrect — fix the test and re-run.
- PASS without implementation is a warning: flag it as already-covered or asserting nothing real, and require review before proceeding.

## Step 6. Report and stop

Report:

```text
## he9-tdd complete — <change-name>

**Runner:** <cmd> · **Test root:** <path> · **Reference:** <file|none>
**Specs read:** N files · M scenarios
**Tests written:** X (files: <paths>)
**RED (expected):** X — each with its failure reason
**Unexpected passes:** Y (review required)
**New contract** (apply must implement these exact names/ids):
  - <name> → <file>
**Spec quality gaps:** <vague THEN clauses needing spec revision>
**Behavior gaps:** <skipped or observable-only cases>
```

Then stop with this handoff, verbatim in meaning: **do not continue to implementation in this session.** Ask the human to review the RED report, then start a **fresh session** on the same branch before running the apply workflow, so the implementing mind meets only the specs and the failing tests, not this session's planning. Name the next step explicitly: run the OpenSpec apply-change workflow in that fresh session to make the tests GREEN.
