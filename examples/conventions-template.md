<!-- conventions-template.md — the project detail layer. Copy to your project's
     openspec/conventions.md, fill every <placeholder>, delete sections you do
     not need, and remove these comments. Adapted from a real project;
     stack-specific parts are placeholders.

     Role in the layering (siblings in examples/):
       AGENTS.md (always loaded)    policy             — examples/agents-template.md
       this file (probed by skills) detail: stack, commands, protocols
       openspec/config.yaml         OpenSpec injection — examples/openspec-config.yaml

     Who reads what — keep these sections if you use the matching flows:
       he9-tdd (Step 0)     Testing Standards: runner, modes, test root,
                            single-test command, reference test
       he9-tdd (disputes)   Test disputes: record format and statuses
       he9-start            Branch Naming
       he9-spec-review      Spec Authoring (assertability rule) + existing specs
       openspec-apply       TDD handoff + red-test routing (bound for apply via
                            config.yaml's context block)
       review flows         all of it, as grading rules -->

# Project Conventions

## Project: <Name>

<One paragraph: what the project is, target platforms, core paradigms.>

## Tech Stack

- <Language / engine / runtime>
- <Test framework and its modes>
- <Key dependencies>

## Code Style

<Naming and style rules; point at .editorconfig / the formatter config.>

## Testing Standards

- Unit tests required for business logic; integration tests for new features or major changes; manual test suggestions where automation is difficult.
- Test framework and modes: <framework; its modes, if it has more than one>.
- Test root and naming: <path and naming pattern>.
- Affected-test command: <exact command to run a single test or a filter — this is what iteration and `he9-tdd` use>.
- Full-suite command (the CI build gate): <command>.
- Canonical reference test to mirror for imports, mocks, helpers: <file, or none>.
- A bug fix ships with a regression test that reproduced the failure before the fix, verified red-for-the-right-reason, unless the human explicitly waives it.

### TDD handoff (he9-tdd → apply)

When a change has prewritten RED tests, they encode the intended implementation contract; approved specs remain authoritative if a test conflicts with them:

- Read the change's per-task RED results in its `tasks.md` (scenario→test mapping, commands, one-line failures) plus the listed test/fixture files before writing code. `tdd-report.md`, when present, holds overflow evidence — diagnostic runs, fixture details — cited from those entries.
- Map existing tests to the change's scenarios before adding tests. Reuse or extend existing coverage; do not duplicate equivalent cases.
- Implement the specified behavior until the change's tests and the required regression suite pass. If blocked, report the blocker rather than claiming completion.
- Do not weaken assertions, skip tests, or reinterpret expected behavior merely to obtain GREEN. If a test conflicts with the approved specs, explain the conflict and ask before changing either.
- Prewritten tests are not necessarily exhaustive: add tests for genuine uncovered behavior where needed.
- Report the commands run and their results. Tests that could not run are unverified, not GREEN.

### Test disputes and response handoffs

The implementing agent follows this protocol when a prewritten test resists. The testing agent's response discipline — assessment classes, response and resolution records — is defined by the `he9-tdd` skill, which picks up `awaiting response` records on its next run; this file does not restate it.

Neither party is automatically correct; disagreements are assessed against approved specs, project conventions, and reproducible evidence.

**Use only when action by another role or a human is needed.** If all required checks are GREEN and no unresolved dispute or follow-up remains, report normal completion only; do not generate a handoff. When resolving an existing dispute leaves no further action for the recipient, update its record with the resolution and verification evidence without producing a separate response handoff.

**Route red tests by cause — not every red is a dispute:**

- Red because the implementation is incomplete → keep working; no handoff.
- Mechanical test defect that touches no assertion (typo, bad import path, fixture load error) → fix the test directly and leave a one-line note under the affected task; no handoff.
- The expectation itself appears wrong (assertion, spec conflict, infeasibility) → pause the affected task and record a test dispute under it (status `awaiting response`); unrelated unblocked tasks may continue.
- Stuck — 3 failed attempts on the same test without progress → stop and record the dispute with everything tried; do not keep iterating.

**Invariant:** the party that edits a disputed test must never be the party trying to make it green. Mechanical fixes are the only exception.

**Implementing agent:** if you believe a failing test is incorrect, do not weaken assertions, skip it, or change expectations merely to obtain GREEN. Explain your hypothesis to the human and pause the affected task. Unrelated, unblocked tasks may continue within the authorized scope. Record the dispute under the affected task, in this format:

```text
**Test dispute — <test/scenario>, status: awaiting response**
- Reproduction: <exact command, observed failure, result freshness>
- Objection: <why the expectation appears wrong; spec/convention citation>
- Proposed correction: <the change and its coverage effect>
```

Distinguish a suspected test defect from an implementation defect, spec ambiguity, or environment/harness problem. A hypothesis is not a confirmed defect.

**Shared record rules:** record under the affected task in the change's tracking artifact (normally `tasks.md`), so another session can resume from files alone. Keep the status line at the head of the record: `awaiting response`, `awaiting human decision`, or `resolved`. Preserve the original objection and append the response and resolution. A handoff requests review — the human routes it; nothing auto-invokes. Avoid concurrent edits to the disputed tests or the shared artifact. If one exchange does not resolve the disagreement, the human decides. A resolved dispute is not proof of GREEN: rerun the affected tests and required checks before completing verification.

## Spec Drift Prevention

Specs are contracts; changes are amendments; tests are enforcement. Every deviation from a spec must be an explicit, recorded decision at the moment it happens — never reconstructed at sync time.

1. **Bug triage before fixing**: decide which is wrong, then act:
   - Spec correct, code wrong → fix code only.
   - Spec wrong/outdated/underspecified → update the active change's delta spec/tasks/design **first**, then implement.
2. **Deviations log**: while applying a change, record every divergence from spec in `deviations.md` inside the change folder (what changed, why). At verify/archive time this feeds the delta specs so the archive captures reality.
3. **Scope creep quarantine**: new features discovered mid-implementation never enter the current change. Park them in `docs/notes/*` or spin up a separate OpenSpec change; prefer many small changes over one big one mutated mid-flight.
4. **No behavior change without a spec touch**: any commit that alters runtime behavior updates `openspec/specs/*` or an active change's deltas in the same PR. Drive-by hotfixes get a retroactive `openspec-sync-specs` pass.
5. **Verify before archive**: always run `openspec-verify-change`; fold the deviations log into delta specs, then archive.
6. **Tests as drift detectors**: bind tests to spec scenarios where feasible; failing tests signal drift mechanically.

## Branch Naming

Feature branches follow a `{user}/`-prefixed convention, where `{user}` is `git config user.name`:

- **Tracked issue:** `{user}/issue-{id}-{short-task-desc}` — the embedded issue number lets commit/PR commands auto-link `Fixes #<id>` / `Refs #<id>`.
- **OpenSpec change:** `{user}/opsx-{change-name}`.
- **Ad-hoc task:** `{user}/{short-task-desc}`.

The `he9-start` skill derives the branch name from the task source.

## Documentation Precedence

- `openspec/specs/*` — canonical source for technical/runtime behavior requirements.
- `docs/notes/*` — design notes, exploration, backlog, non-normative context.
- `openspec/technical-debt.md` — project-level backlog for technical debt, architecture concerns, and deferred refactoring work.

## Spec Authoring

- **Assertable scenarios**: each requirement has at least one scenario; scenarios use GIVEN/WHEN/THEN; THEN clauses state mechanically assertable outcomes (a value, state, or error) — never "works correctly" or "updates the UI"; every requirement includes a failure/edge scenario, not only happy paths. This mirrors `rules.specs` in `openspec/config.yaml`; `he9-tdd` and the `he9-spec-review` reviewer grade against it.
