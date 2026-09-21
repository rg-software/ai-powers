---
name: code-review-expert
description: Structured senior-engineer review of changed code — SOLID and architecture smells, security and reliability risks, error handling, performance, boundary conditions, and removal candidates. Use when reviewing a branch diff or pull request, or when asked to review changes. Review-only by default; grades findings with the he9-review-contract rubric.
license: MIT
---

# Code Review Expert

Perform a structured review of the changes in scope. Default to **review-only**: do not implement changes unless the invoker explicitly asks.

## Before you grade anything

**Load the `he9-review-contract` skill first.** It owns the vocabulary — severity (P0–P3) and its triggers, category, scope, action, disposition, the finding schema, and the output format. This skill does not restate them. If you find yourself inventing a severity or an action, you have skipped this step.

Two rules from the contract that are easy to get wrong:

- `P0` is reserved for exploitable security, data loss, crash on a mainline path, or breaking the build/tests. Incorrect behavior is `P1`.
- Action (fix now vs defer) is decided by **scope**, not severity.

## Adapter awareness

If the project has a `.opencode/powers.jsonc` adapter, read it. It points at the project's conventions, specs, debt backlog, and base branch. Architecture and maintainability findings are graded against **those** files: cite the specific convention or spec requirement as the finding's `rule`. Drift is only a finding when you can name the rule it violates. With no adapter, use `none` as the rule and say so.

## When to use

- Code is hard to understand or maintain.
- A branch or PR needs review before merge.
- The user asks to review, critique, or check changes.

Use `receiving-code-review` instead when the task is to **respond** to a review, not produce one.

---

## Workflow

### 1) Preflight context

- Scope the change: `git status -sb`, `git diff --stat`, `git diff` (or the given base/head SHAs and diff).
- Edge cases:
  - **No changes**: say so and ask for a range.
  - **Large diff (>500 lines)**: summarize by file first, then review in batches by module.
  - **Mixed concerns**: group findings by feature, not file order.
- Identify entry points, ownership boundaries, and critical paths (auth, payments, persistence, network).
- State explicitly what is out of scope and therefore not reviewed.

### 2) Design and architecture

Load `references/solid-checklist.md`. Look for SRP, OCP, LSP, ISP, DIP violations and the common smells (long method, feature envy, data clumps, primitive obsession, shotgun surgery, divergent change, dead code, speculative generality, magic values).

Recommend only **incremental, safe** restructuring, and only for cohesion/coupling reasons you can state. For anything non-trivial, propose a plan, not a rewrite. Wider refactors outside the touched scope are `defer-debt`, not findings to fix here.

When the shape of a fix is not obvious, load `references/examples.md` for before/after illustrations of the common transformations.

### 3) Removal candidates

Load `references/removal-plan.md`. Identify code that is unused, redundant, or flagged off. Use the **R0–R2** removal scale (not P0–P3). Distinguish safe-delete-now from defer-with-plan, and give concrete steps and a verification checkpoint. Removal is a separate axis from review severity; never label a removal candidate `P1`.

### 4) Security and reliability

Load `references/security-checklist.md`. Cover injection (SQL/NoSQL/command/GraphQL), XSS, SSRF, path traversal, prototype pollution; authn/authz and tenancy gaps; secret/PII exposure; JWT handling; supply chain; CORS/headers; resource exhaustion and ReDoS; crypto; and race conditions (shared state, TOCTOU, DB concurrency, distributed). State both **exploitability** and **impact** — that is what separates `P0` from a theoretical concern.

### 5) Code quality

Load `references/code-quality-checklist.md`. Cover error handling (swallowed exceptions, broad catches, async errors), performance (N+1, hot-path work, missing/broken caching, unbounded memory), and boundary conditions (null/undefined, empty collections, numeric and string boundaries, off-by-one). Flag anything that causes silent failures.

### 6) Output

Emit the **reviewer output format defined by the contract**. Do not invent a different structure. Every finding carries `id`, `file:line`, `severity` (with the trigger), `category`, `scope`, `rule`, `evidence`, `impact`, `suggestion`, `action`.

If there are no findings, say what you checked, what you did **not** check, and any residual risk. A clean review that omits its coverage is not a clean review.

### 7) Hand-off

Ask how the invoker wants to proceed (fix all / fix P0-P1 / pick items / no changes). **Skip this step in non-interactive mode** (CI, scripted runs) — state that you are skipping it.

---

## Rules

- Cite `file:line` for every finding. No finding without a location.
- A finding without `rule` and `evidence` is an opinion; either supply them or drop the severity to `P3`.
- Do not pad the report. If the change is clean, say so briefly and list coverage.
- Do not report style the project's own formatter or `.editorconfig` owns.
- Do not expand scope: maintainability work outside the touched scope is `defer-debt`.

## Resources

| File | Purpose |
|------|---------|
| `references/solid-checklist.md` | SOLID smells and refactor heuristics |
| `references/security-checklist.md` | Security, reliability, race conditions |
| `references/code-quality-checklist.md` | Error handling, performance, boundaries |
| `references/removal-plan.md` | R0–R2 removal planning template |
| `references/examples.md` | Worked before/after transformations |
