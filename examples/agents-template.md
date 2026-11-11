<!-- agents-template.md — the always-loaded policy layer. Copy to your
     project root as AGENTS.md, replace every <placeholder>, adapt the rules,
     and delete these comments. Adapted from a real project.

     Layering — what enforces what:
       this file   policy; loaded in EVERY session. Skills apply only when
                   invoked; conventions.md and openspec/config.yaml are read
                   by the skills and OpenSpec prompts that probe them. So any
                   rule that must hold in out-of-skill sessions is stated here.
       skill       procedure; refines the policy when invoked (he9-commit,
                   he9-start, he9-tdd, ...). Do not duplicate recipes here.
       conventions detail; openspec/conventions.md (naming, commands, protocols).
       forge / CI  hard gates this file cannot guarantee (protected main,
                   required checks). Lines below narrow agent behavior; they
                   are prompt-level, not enforcement. -->

# AGENTS.md: General Guidelines

## Skills and tools
<!-- policy: always-on. The CLI choice is project-specific; the he9-*
     workflows resolve the forge per he9-review-contract when they need it. -->
- Use the `<forge-cli>` CLI for tracker operations (`gh` / `tea` / `glab` — whichever this project uses).
- When a "default", "development", or "main" branch is mentioned, assume `<main>`.
- Do not push branches or create pull requests unless required by the workflow or explicit user instruction.
- Do not commit to the main branch directly; use feature branches.
- Feature-branch naming rules live in `openspec/conventions.md`.

## Commits
<!-- policy here; procedure in the he9-commit skill (Conventional Commit
     format, issue ref from the branch name, spec updates on behavior change).
     Hard gate: branch protection + CI. This section narrows behavior; it does
     not guarantee it. -->
- The agent may commit without asking, using the `he9-commit` skill when available (verify tests first; update specs on behavior change).
- Limits: current feature branch only, never `main`; local commit only — do not push, open PRs, or amend others' commits without explicit instruction.
- Commit coherent units (per completed task); do not sweep in unrelated files or commit when tests fail. An explicit "do not commit" for the session overrides this.
- Out-of-skill sessions follow the same policy: Conventional Commit messages, coherent units, no push.

## Spec-driven workflow
<!-- policy + pointers; OpenSpec semantics are injected via
     openspec/config.yaml (see examples/openspec-config.yaml). -->
- Feature work goes through OpenSpec: propose a change under `openspec/changes/`, create its design/spec/tasks artifacts, implement task-by-task, verify, then archive. Use the `openspec-*` skills to drive this.
- Substantial changes: converge the specs with `he9-spec-review` before `he9-tdd`. Trivial changes and targeted edits skip it.
- When implementing a change with prewritten RED tests (he9-tdd → apply): follow the **TDD handoff** rules in `openspec/conventions.md` (reuse tests, GREEN-gate completion, no weakening, report evidence).
- Both implementing and testing/architecture agents follow the **test dispute** rules in `openspec/conventions.md` when one is recorded: route red tests by cause, record disputes in the standard format, and never edit a disputed test you are trying to make green.

## Refactoring principles
- When refactoring, refactor fragments of code relevant to the task at hand. Perform wider-scale refactoring only when asked.
- When editing an overly complicated class or function, suggest refactoring it.

## Fixing errors
- When diagnosing a specific error or unclear failure: first explain your hypothesis to the user; confirm that the user agrees to proceed with your plan; if necessary, suggest adding debug logs and collecting data.

## Documentation use
<!-- pointers; replace the <...> entries with this project's own docs. -->
- Use `openspec/specs/*` as the canonical source for technical/runtime documentation.
- For project-level conventions, examine `openspec/conventions.md`.
- For system-specific tasks, read the relevant capability spec under `openspec/specs/<capability>/spec.md`.
- <Project doc pointers: asset/folder layout, pipeline guides, etc.>
- Use `docs/notes/*` as supplemental context only for non-normative ideas and backlog notes; keep technical truth in `openspec/specs/*` and promote accepted ideas from notes into specs.
- Keep documentation up to date. If code and documentation disagree, report it and suggest a fix. When a new fact about the system is discovered, suggest reflecting it in documentation.

## Error handling
<!-- keep the attempt cap equal to the dispute protocol's stuck cutoff, so
     "stuck" means the same thing everywhere. -->
- If you attempt to fix a specific error **3 times** and it persists, stop and explain the failure to the user.
- Do not repeatedly run the same command expecting a different result.
- If a tool fails (test runner, compiler, CLI), verify the tool itself works (e.g. its `--version`) before changing any code.
- If you are stuck or suspect the environment is broken, stop and explain the issue to the user.
- Do not guess root causes. If unsure, add debug logs and do a diagnostic run, or ask the user to do it.

## Testing
<!-- runner commands, quirks, and freshness rules are detail — they belong in
     openspec/conventions.md, which he9-tdd and he9-commit probe. State only
     the always-on policy here. -->
- Run affected tests locally during iteration; the full suite runs as a build gate in CI.
- Do not claim a task complete while its tests are failing or unrun; tests that could not run are unverified, not green.
- Exact commands and runner discipline: see `openspec/conventions.md`.

## Formatting
<!-- the project's formatter owns formatting; this line keeps agents from
     hand-formatting over it. -->
- Staged files are auto-formatted by the project's pre-commit hook (`<formatter>`). Do not hand-format or reformat unrelated code.
