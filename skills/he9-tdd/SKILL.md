---
name: he9-tdd
description: "Write failing tests for an OpenSpec change before implementation - RED gate between propose and apply - and resolve test disputes raised by the implementing agent. Use when the user asks to add tests for a change, gate implementation on tests, run the TDD step, or respond to a test dispute. Invocation text is the change name (inferred from context when omitted)."
license: MIT
metadata:
  opencode/autoinvoke: false
---

# TDD gate for an OpenSpec change

Goal: write **real** failing tests from a change's specs and confirm a solid RED before any implementation begins — and, on later runs, resolve disputes the implementing agent raised against those tests. This skill sits between `propose` and `apply`: it produces and maintains the contract `apply` must satisfy, then stops.

**Invocation.** The invocation text is the text that accompanied this skill — the words after the skill name. Read it as the **change name**. If it is empty, infer the change from conversation context; if exactly one active change exists, use it; otherwise list the candidates and ask. Never guess silently.

**Project inputs (optional adapter).** Read `powers.jsonc` if present; it overrides the defaults below. This skill uses: `conventions` (`openspec/conventions.md`), `specs` (`openspec/specs/*/spec.md`). Probe for paths; if one is absent, skip that step rather than guessing. Test framework, test location, and run commands come from the resolved conventions file — never hardcode them. If the resolved conventions define a test-dispute protocol, follow it; the dispute steps below are the default when they do not.

## Step 0. Resolve test conventions

1. Read the resolved conventions file for: test framework and modes (e.g. EditMode vs PlayMode), test root and naming, the command to run a single test file, and any canonical reference test to mirror (imports, mocks, helpers).
2. If the conventions file is absent or silent on any of these, ask the user — do not fall back to another stack's runner.
3. Announce what you resolved: `Runner: <cmd> · Test root: <path> · Reference: <file|none>`.

## Step 1. Select the change

- Use the invocation change name when given; confirm its directory `openspec/changes/<name>/` exists.
- Otherwise infer from context, or auto-select when only one active change (non-archive) exists.
- If ambiguous, list the active changes and ask.
- Locate the change's task-tracking artifact: `tasks.md` if present; otherwise whatever artifact the OpenSpec apply instructions track for this change; if there is none, ask rather than inventing one.

Announce: `Using change: <name>`.

## Step 2. Pick up pending test disputes

New test work waits until pending disputes are settled — a dispute changes what the contract is, so writing more tests against an unsettled contract compounds the problem.

- Read the tracking artifact located in Step 1 for dispute records: blocks headed `**Test dispute — ...**` with status `awaiting response`. Also accept a dispute relayed in the conversation — the human passing on the implementing agent's report — when no structured record exists.
- If there are none, continue to Step 3.
- For each pending dispute, inspect the current specs, tests, implementation, and reproduction evidence from the files — not remembered state — and assess it as exactly one of: **test defect**, **implementation defect**, **spec ambiguity**, **environment/harness problem**, **insufficient evidence**.
  - **Test defect** — correct the test within your scope, preserving intended coverage, rerun the affected checks, append the response, set status `resolved`.
  - **Implementation defect** — the test stands. Append the response with evidence, set status `resolved`; the implementing session resumes from it.
  - **Spec ambiguity** — set status `awaiting human decision` and ask. On the decision, follow the project's drift rules (spec updated first), then update the tests and set status `resolved`.
  - **Environment/harness problem** — name it and how to fix it; this is not behavioral RED. Record what was done or what is blocked.
  - **Insufficient evidence** — say what is missing and ask the human to route the dispute back for reproduction.
- Never change specified behavior to settle a dispute without human approval, and never implement production behavior as part of a response.
- After processing, continue to Step 3 only if there is new test work to do; otherwise jump to Step 8.

Default record format — one block under the affected task, raised by whichever party disputes, responded to here:

```text
**Test dispute — <test file/case or scenario>, status: awaiting response | awaiting human decision | resolved**
- Reproduction: <exact command and observed failure; note result freshness>
- Objection: <why the test appears wrong; spec/convention citation; what is uncertain>
- Proposed correction: <the change and its coverage effect>
- Response (testing agent): <assessment + evidence + commands run, or why no change>
- Resolution: <decision, changed files, verification result — appended when settled>
```

## Step 3. Parse scenarios from specs

- Read every `specs/**/*.md` under `openspec/changes/<name>/` (the resolved specs for this change, not the main `specs/` tree).
- If none exist, stop: say to run `propose` first so specs with `Scenario:` blocks exist, then re-run this skill.
- For each file, extract every scenario block with its parent requirement name and its WHEN / THEN lines. Skip files with no scenarios and note them.
- Translate each THEN clause into assertion intent now; vague THEN clauses ("UI updates", "handles correctly") are spec quality gaps — flag them in the report, never pad with a stub assertion.

Announce: `<N files> · <M scenarios> · source-of-truth: changes/<name>/specs`.

## Step 4. Derive test file paths

Read the tracking artifact located in Step 1 and inspect existing tests before writing. Map scenarios to existing cases and pending testing tasks; reuse coverage rather than adding equivalent cases. If the mapping is ambiguous, ask before changing task state.

For each capability, in priority order:

1. `design.md` Implementation Map — a table mapping capability to implementation file.
2. `design.md` path mentions — any source path naming the capability or a related module.
3. Project search for the best non-test match (e.g. matching class/file name outside test roots).
4. Ask the user with the candidate list. Never guess silently.

Place the test file per the resolved conventions (same directory, `Tests` sibling, or project test root as conventions dictate). If a test container with the same name already exists, append cases inside it rather than duplicating it.

## Step 5. Write REAL failing tests

- Import and exercise the real unit under test — a missing module, export, or component is a valid RED.
- Assert real outcomes from the THEN clauses: presence, values, call args, emitted state. Drive user actions the way the scenario describes them.
- When a scenario needs an identifier or seam that does not exist yet, choose the canonical name now and assert against it. The test defines the contract; `apply` must implement exactly that. List every such contract item in the report.
- When a value is genuinely unknowable from the artifacts, assert the observable behavior or mark the case skipped with a one-line reason and log it as a behavior gap. Never write forced-fail placeholders.
- Never modify existing passing tests.
- On reruns, inspect cases already written for this change. Reuse matching cases rather than appending duplicates; if a changed spec requires altering an existing test, explain the mismatch and ask before changing it.

## Step 6. Run tests and confirm RED

- Run the conventions command against each written file, filtered to the new cases where the runner supports it.
- FAIL for the right reason (missing element/id, missing export/module, wrong value) is the expected RED — capture the failure message per test.
- FAIL for a wrong reason (typo, bad import path, malformed selector, missing mock) means the test is incorrect — fix the test and re-run.
- PASS without implementation is a warning: flag it as already-covered or asserting nothing real, and require review before proceeding.

## Step 7. Reconcile the change's tasks

Make the handoff durable in the change's existing task-tracking artifact, which a fresh apply session reads. Do not rely on this chat report or modify the upstream apply skill. Keep evidence with the contract it belongs to: each test's result sits inline next to its mapping entry — the command plus the one-line failure message for RED. `tdd-report.md` in the change folder is optional overflow for genuinely bulky material (multi-run diagnostics, fixture/setup dumps, run-freshness logs), cited from the inline entries. The artifact is loaded wholesale by apply sessions, so keep each entry to a line or two.

- Record the scenario-to-test mapping under the task each test verifies (or the verification task when several share one): spec file and scenario name, test file and case name, the command run, and the observed one-line result — for RED, the failure message itself. Record required new public names or identifiers without prescribing implementation internals, and never copy this session's implementation ideas. Overflow detail goes to `tdd-report.md`, cited from the entry.
- Mark a testing task complete only when its entire stated scope is satisfied. An explicit "write tests and verify RED" task can be completed after that verification; "test the feature" or "tests pass" cannot be completed on RED evidence.
- When a pending task mixes test authoring with implementation or GREEN verification, retain all of its scope: split it into a completed authoring/RED task (only if fully verified) and pending implementation/GREEN tasks. Preserve requirements, constraints, and existing completed work; do not rewrite unrelated tasks.
- If no task covers making these tests GREEN and running the project's required regression checks, add a pending verification task with those explicit completion criteria and the resolved commands. If the regression command is unknown, ask rather than inventing it.
- Attach coverage gaps, skipped cases, unexpected passes, and execution blockers to the relevant pending tasks. An already-passing case can cover an existing behavior, but is not RED evidence for missing behavior. A collection/build failure does not prove every case reached its assertion; record the actual level of evidence.
- Tell the implementing session to inspect and reuse the mapped tests before adding more, add only genuinely missing coverage, and not weaken assertions, skip cases, or change expectations just to obtain GREEN. A conflict with approved specs must be surfaced to the human before changing the tests.
- Do not implement production behavior, mark implementation/GREEN tasks done, or claim the change is ready to archive. This phase records test preparation, not feature completion.

## Step 8. Report and stop

Report:

```text
## he9-tdd complete — <change-name>

**Runner:** <cmd> · **Test root:** <path> · **Reference:** <file|none>
**Specs read:** N files · M scenarios
**Tests written:** X (files: <paths>)
**RED (expected):** X — each with its failure reason
**Unexpected passes:** Y (review required)
**Disputes resolved this run:** <n or none> (records updated in <artifact>)
**New contract** (apply must implement these exact names/ids):
  - <name> → <file>
**Spec quality gaps:** <vague THEN clauses needing spec revision>
**Behavior gaps:** <skipped or observable-only cases>
**Task handoff:** <tracking artifact path; tasks completed/split/left pending>
**Evidence:** inline per-test in the tracking artifact; overflow in tdd-report.md (if any)
```

Then stop with this handoff, verbatim in meaning: **do not continue to implementation in this session** — whether this run wrote RED tests or resolved disputes, the party that edits tests must not be the party that makes them green. Ask the human to review the report, then start a **fresh session** on the same branch before running the apply workflow, so the implementing mind meets only the specs and the failing tests, not this session's reasoning. Name the next step explicitly: run the OpenSpec apply-change workflow in that fresh session to make the tests GREEN.
