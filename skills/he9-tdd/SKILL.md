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

Read the change's `tasks.md` and inspect existing tests before writing. Map scenarios to existing cases and pending testing tasks; reuse coverage rather than adding equivalent cases. If the change uses another tracking artifact, locate it from the OpenSpec apply instructions instead of inventing a `tasks.md`. If the tracking artifact is missing or the mapping is ambiguous, ask before changing task state.

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
- On reruns, inspect cases already written for this change. Reuse matching cases rather than appending duplicates; if a changed spec requires altering an existing test, explain the mismatch and ask before changing it.

## Step 5. Run tests and confirm RED

- Run the conventions command against each written file, filtered to the new cases where the runner supports it.
- FAIL for the right reason (missing element/id, missing export/module, wrong value) is the expected RED — capture the failure message per test.
- FAIL for a wrong reason (typo, bad import path, malformed selector, missing mock) means the test is incorrect — fix the test and re-run.
- PASS without implementation is a warning: flag it as already-covered or asserting nothing real, and require review before proceeding.

## Step 6. Reconcile the change's tasks

Make the handoff durable in the change's existing task-tracking artifact, which a fresh apply session reads. Do not rely on this chat report, create a separate report file, or modify the upstream apply skill.

- Record a compact scenario-to-test mapping: spec file and scenario name, test file and case name, command run, observed result, and the failure reason for RED. Record required new public names or identifiers without prescribing implementation internals. Keep evidence concise; do not copy full logs or this session's implementation ideas.
- Mark a testing task complete only when its entire stated scope is satisfied. An explicit "write tests and verify RED" task can be completed after that verification; "test the feature" or "tests pass" cannot be completed on RED evidence.
- When a pending task mixes test authoring with implementation or GREEN verification, retain all of its scope: split it into a completed authoring/RED task (only if fully verified) and pending implementation/GREEN tasks. Preserve requirements, constraints, and existing completed work; do not rewrite unrelated tasks.
- If no task covers making these tests GREEN and running the project's required regression checks, add a pending verification task with those explicit completion criteria and the resolved commands. If the regression command is unknown, ask rather than inventing it.
- Attach coverage gaps, skipped cases, unexpected passes, and execution blockers to the relevant pending tasks. An already-passing case can cover an existing behavior, but is not RED evidence for missing behavior. A collection/build failure does not prove every case reached its assertion; record the actual level of evidence.
- Tell the implementing session to inspect and reuse the mapped tests before adding more, add only genuinely missing coverage, and not weaken assertions, skip cases, or change expectations just to obtain GREEN. A conflict with approved specs must be surfaced to the human before changing the tests.
- Do not implement production behavior, mark implementation/GREEN tasks done, or claim the change is ready to archive. This phase records test preparation, not feature completion.

## Step 7. Report and stop

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
**Task handoff:** <tracking artifact path; tasks completed/split/left pending>
```

Then stop with this handoff, verbatim in meaning: **do not continue to implementation in this session.** Ask the human to review the RED report, then start a **fresh session** on the same branch before running the apply workflow, so the implementing mind meets only the specs and the failing tests, not this session's planning. Name the next step explicitly: run the OpenSpec apply-change workflow in that fresh session to make the tests GREEN.
