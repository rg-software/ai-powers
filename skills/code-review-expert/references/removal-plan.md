# Removal and Iteration Plan Template

Removal has its own scale. **Do not use P0–P3 here** — those are review severities (see `he9-review-contract`). Using `P1` for both a merge blocker and a cleanup schedule is exactly the collision this scale avoids.

## Removal Levels

- **R0**: Remove now. Obsolete, unreferenced, no consumers; safe to delete in this branch.
- **R1**: Remove this iteration. Needs a migration, a deprecation window, or sign-off.
- **R2**: Backlog. Worth removing eventually; blocked or low value today.

---

## Safe to Remove Now (R0)

### Item: [Name/Description]

| Field | Details |
|-------|---------|
| **Location** | `path/to/file.ts:line` |
| **Rationale** | Why this should be removed |
| **Evidence** | Unused (no references), dead feature flag, deprecated API |
| **Impact** | None / Low - no active consumers |
| **Deletion steps** | 1. Remove code 2. Remove tests 3. Remove config |
| **Verification** | Run tests, check no runtime errors, monitor logs |

---

## Defer Removal (R1 / R2)

### Item: [Name/Description]

| Field | Details |
|-------|---------|
| **Location** | `path/to/file.ts:line` |
| **Level** | R1 (this iteration) or R2 (backlog) |
| **Why defer** | Active consumers, needs migration, stakeholder sign-off |
| **Preconditions** | Feature flag off for 2 weeks, telemetry shows 0 usage |
| **Breaking changes** | List any API/contract changes |
| **Migration plan** | Steps for consumers to migrate |
| **Timeline** | Target date or sprint |
| **Owner** | Person/team responsible |
| **Validation** | Metrics to confirm safe removal (error rates, usage counts) |
| **Rollback plan** | How to restore if issues found |

---

## Checklist Before Removal

- [ ] Searched codebase for all references (`rg`, `grep`)
- [ ] Checked for dynamic/reflection-based usage
- [ ] Verified no external consumers (APIs, SDKs, docs)
- [ ] Feature flag telemetry reviewed (if applicable)
- [ ] Tests updated/removed
- [ ] Documentation updated
- [ ] Team notified (if shared code)
