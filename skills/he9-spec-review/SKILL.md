---
name: he9-spec-review
description: "Converge an OpenSpec change's spec artifacts before tests are written - adversarial review rounds between a read-only reviewer and the editing session, defect fixes applied agent-to-agent, the human deciding only the residue agents cannot settle. Use after a bulk spec-authoring event (propose, ff, or a continue step that wrote specs/design) and before he9-tdd; skip after targeted edits. Invocation text is the change name (inferred from context when omitted)."
license: MIT
metadata:
  opencode/autoinvoke: false
---

# Spec convergence review for an OpenSpec change

Goal: improve a change's spec artifacts (proposal, specs, design) until two minds have nothing left to say to each other, so `he9-tdd` hardens a converged contract into RED tests rather than a first draft. Defects are fixed agent-to-agent; the human decides only the residue — trade-offs, scope, feasibility — that agents cannot settle.

**Placement.** Invoke after the event that bulk-authored spec text (`openspec-propose`, `openspec-ff-change`, or the `openspec-continue-change` step that wrote specs/design), before `he9-tdd`. Do not invoke after targeted edits (`openspec-update-change`, dispute resolutions, gap fixes) — those arrive with their own reason. Re-invoke only when a targeted edit turns structural (rewrites requirements at scale) or plainly reopens something this loop settled.

**Invocation.** The invocation text is the text that accompanied this skill — the words after the skill name. Read it as the **change name**. If it is empty, infer the change from conversation context; if exactly one active change exists, use it; otherwise list the candidates and ask. Never guess silently.

**Project inputs (optional adapter).** Read `powers.jsonc` if present; it overrides the defaults below. This skill uses: `conventions` (`openspec/conventions.md`), `specs` (`openspec/specs/*/spec.md`), `contract` (`he9-review-contract`). Probe for paths; if one is absent, skip that step rather than guessing. `conventions` supplies the project's spec-authoring rules; `specs` is the existing main spec tree the change is checked against for contradictions and drift; `contract` supplies the severity and disposition vocabulary, read for spec artifacts per its "Grading spec artifacts" section.

## Step 1. Select the change

- Use the invocation change name when given; confirm its directory `openspec/changes/<name>/` exists.
- Otherwise infer from context, or auto-select when only one active change (non-archive) exists.
- If ambiguous, list the active changes and ask.
- Require spec files under the change (`specs/**/*.md`). If none exist, stop: say to author specs first (via the OpenSpec continue workflow), then re-run this skill. Review whatever other artifacts exist alongside them.

Announce: `Using change: <name>`.

## Step 2. Establish the reviewing party

This skill requires a `reviewer` subagent (see `he9-review-contract` → "Configuring the reviewer"). In a skill body, `reviewer` is prose the model acts on, not a dispatch the harness resolves — so an unavailable subagent surfaces as an ordinary turn, not an error. Handle it explicitly:

- Check the configured subagents. If `reviewer` is present, `REVIEWING_PARTY = reviewer` (subagent).
- If it is absent, **stop before reviewing.** Say this skill needs a `reviewer` subagent, show the snippet from `he9-review-contract` → "Configuring the reviewer", and offer a self-review opt-in. Note plainly that a self-review convergence loop is single-mind by construction — the same session finds and then fixes — so it cannot converge anything independently; proceed only if the user insists, and set `REVIEWING_PARTY = self-review (not independently reviewed)`.
- Whatever happens, **announce the party** with every round report. Never present a round as independently reviewed when it was not.
- If a `reviewer` invocation fails, returns nothing usable, or you cannot confirm it ran, report which step failed and stop. Do not substitute your own findings under the subagent's name.

## Step 3. Run review rounds

Each round, in order:

a. **Dispatch a fresh reviewer round.** A new invocation, fresh context, read-only. Give it this task:

   > Adversarially review the spec artifacts of OpenSpec change `<name>`: `openspec/changes/<name>/proposal.md`, `specs/**/*.md`, and `design.md` (whichever exist). You are read-only: report findings, edit nothing.
   >
   > Attack surface — reasoning defects, not style: unstated assumptions and wrong-direction risk; missing edge/failure scenarios; THEN clauses that are not mechanically assertable; contradictions among the artifacts, and against the existing main specs (`openspec/specs/*/spec.md`) and the resolved conventions; scope creep beyond the proposal; feasibility against the actual codebase and assets — does what a scenario requires exist, or is it plausibly buildable; cheaper alternatives not considered; trust boundaries crossed without validation requirements.
   >
   > Grade each finding with the `he9-review-contract` skill → "Grading spec artifacts" — severity by what the spec would ship if implemented as written, category, `rule` citing the requirement/scenario/convention it is graded against, evidence, suggestion. Report findings only.

b. **Classify each finding.** Conservative rule: anything whose fix requires a choice is **decision-class**, full stop. **Defect-class** is only what is mechanically obvious — make the THEN assertable, add the named edge scenario, resolve the stated contradiction, restore the requirement that was scoped away.

c. **Apply defect-class fixes** to the change's planning artifacts now, and produce the round summary:

   ```text
   ## Round N — Reviewing party: <REVIEWING_PARTY>
   Findings: X defect-class · Y decision-class · Z below floor
   Fixes applied: <one line each>
   Held for the human: <one line each>
   ```

   The summary is the human's visibility without arbitration duty; a misclassification spotted there can be overridden at the residue step.

d. **Check the terminal state** (Step 4).

Severity floor: polish below the contract's P3 does not block convergence — note it in the round summary, fix it in passing, or drop it.

## Step 4. Terminal states

- **CONVERGED** — a fresh round produced no new defect-class findings and no new decision-class findings above the floor. Announce and finish (Step 6).
- **RESIDUE** — defect-class findings are exhausted; only decision-class remain. This is the loop succeeding, not failing: exit and present the residue (Step 5).
- **CUTOFF** — the round cap (default 3) is reached, or two consecutive rounds repeat the same decision-class disagreement with no new defects. Stop looping; present the disagreement framed from both sides with each party's evidence (Step 5).

Never loop past the cap hoping the next round agrees — repeated disagreement on a subjective matter is by definition not the agents' to settle.

## Step 5. Decide the residue

Present each decision-class finding for a human decision: the finding (graded per `he9-review-contract` → "Grading spec artifacts"), the reviewer's evidence, the author's counter-position if any, and the options. Reuse the contract's disposition vocabulary where it fits, at residue volume — a short list of real decisions, not a full review table.

Apply the decided outcomes to the artifacts. A decision that changes specified behavior follows the project's drift rules (spec updated first, deviations recorded per the resolved conventions) — never silently edit approved semantics. A decision to defer or reject a finding is recorded in the session report only; the artifacts stay as decided.

## Step 6. Report and hand off

Report: rounds run, findings by class, fixes applied, decisions made, terminal state — headed by the reviewing party from Step 2. Print-only: do not persist a review report; the durable output is the improved artifacts and any decisions the project records its own way.

Hand off: **stop — do not invoke `he9-tdd` or any other skill yourself.** Tell the human the artifacts are converged and that `he9-tdd <change>` is the next step, theirs to invoke when ready. Their own pass over the converged specs still applies (the flow's interactive review) — especially on a CONVERGED exit with no residue, where no decision ever reached them. Same session is fine once they choose to run it; the anti-priming boundary sits between tdd and apply, not here.

## Guardrails

- The reviewer never edits; this skill never implements production code; writes go only to the change's planning artifacts.
- This skill ends at the handoff: it never invokes another skill. A handoff names the next step for the human; the human routes it.
- Defect-class fixes must not change specified semantics — sharpening a THEN is a fix; choosing between two interpretations is a decision.
- Do not drop or weaken a reviewer finding to reach convergence — reject it with evidence in the round summary, or hold it as decision-class.
- Fresh context every round: do not brief the next reviewer with the previous round's transcript — only the current artifacts.
- Do not restate the contract's rubric from memory; load `he9-review-contract` and use its "Grading spec artifacts" reading for spec findings.
