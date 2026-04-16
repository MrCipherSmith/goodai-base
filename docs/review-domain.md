# review — Code Review Domain

> Structured, parallel code review pipeline with 11 specialized reviewers. Each reviewer owns a single concern, uses a unified severity system, and returns a machine-readable STATUS line — so findings compose cleanly into one consolidated report.

## Why a domain, not a single skill

A single "review everything" skill produces shallow, inconsistent results. Different concerns require different expertise:
- Logic bugs are found by tracing execution paths
- Architecture violations require understanding layer boundaries
- MobX store correctness requires knowing the observer/action/computed contract
- Clean Code issues require checking function size, naming, and DRY independently of correctness

By separating reviewers, each can apply deep, focused rules without diluting findings with noise from other domains.

---

## Skills in This Domain

### Entry Point

| Skill | Role |
|-------|------|
| `review-orchestrator` | Parses scope flags, auto-detects domains from diff, dispatches reviewers in parallel, consolidates findings into one unified report |

### Reviewers (subagents)

| Skill | Scope |
|-------|-------|
| `review-logic` | Logic correctness, spec compliance, null-safety, async error paths, algorithmic bugs |
| `review-architecture` | Layer violations, dependency direction, module coupling, SOLID at system level, NestJS and React/MobX structural patterns |
| `review-security-code` | OWASP Top 10, injection, auth/authz gaps, secrets in code, NestJS missing guards |
| `review-performance` | N+1 queries, unnecessary React re-renders, memory leaks, blocking calls, bundle size |
| `review-frontend` | React observer wrapping, MVVM boundary, useEffect misuse, full MobX store checklist, TypeScript safety in UI code |
| `review-backend` | NestJS patterns, DTO validation, API design, DB query patterns, service/repository separation |
| `review-style` | Naming conventions, dead code, readability, import order, cyclomatic complexity |
| `review-clean-code` | Clean Code principles (meaningful names, function size, comments, error handling, DRY) + SOLID at function/class level |
| `review-highload` | Race conditions, connection pool exhaustion, cache invalidation, lock contention, queue backpressure, retry storms, idempotency, distributed invariants |
| `review-strict` | Meta-pass: re-reads all findings, elevates weak severities, adds direct engineering commentary |
| `review-pr-feedback` | Analyzes existing human or bot review comments on a GitHub PR; synthesizes actionable items |

---

## How to Invoke

```
review                     # auto-detect scope from diff
review --all               # dispatch all 10 reviewers
review --frontend          # logic + frontend + style
review --backend           # logic + backend + architecture
review --architecture      # architecture only
review --security          # security-code only
review --performance       # performance only
review --style             # style only
review --clean-code        # clean-code only
review --highload          # highload only
review --strict            # strict meta-pass (standalone or after others)
review PR #N comments      # analyze existing PR comments
```

Multiple flags combine: `review --backend --security` dispatches logic + backend + architecture + security-code.

---

## Routing Logic

### Auto-detection (no flag)

The orchestrator runs `git diff --name-only` against the merge-base and infers scope from file patterns:

| File pattern | Reviewers dispatched |
|---|---|
| `*.tsx`, `*.jsx`, `*.css`, `*.scss` | logic + frontend + style |
| `*.ts` in `src/api/`, `src/services/`, `src/controllers/` | logic + backend + architecture |
| Mixed UI + service files | all of the above |
| `*.sql`, `prisma/schema.prisma`, migrations | backend + architecture |
| `*.test.*`, `*.spec.*` | logic (spec compliance focus) |
| No recognizable pattern | logic + architecture (fallback) |

### Stage 1 Gate — Spec Compliance

When an `issue_url` or task doc is provided, `review-orchestrator` runs a spec compliance check **before** dispatching quality reviewers. Unimplemented acceptance criteria are emitted as `blocker` findings.

---

## Unified Contracts

All reviewers in this domain follow the same input/output contract.

### Severity System

| Level | Meaning |
|-------|---------|
| `blocker` | Must fix before merge. Silent correctness bug, Iron Law violation, or data/security risk. |
| `major` | Should fix. Significant pattern violation that will cause bugs under realistic usage. |
| `minor` | Consider fixing. Convention deviation that reduces maintainability but causes no immediate bugs. |
| `info` | Observation only. No action required. |

### STATUS Protocol

Every reviewer response must open with:

```
STATUS: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
```

| Status | When |
|--------|------|
| `DONE` | Review complete, no blockers or majors |
| `DONE_WITH_CONCERNS` | One or more blocker or major findings |
| `NEEDS_CONTEXT` | Cannot assess without additional context not in the diff |
| `BLOCKED` | Cannot access diff or required files |

### Finding Format

Every finding across every reviewer uses this format:

```markdown
### [F-NNN] Title

- **Severity**: blocker | major | minor | info
- **File**: path/to/file.ts:line
- **Problem**: what is wrong
- **Why it matters**: impact on correctness / safety / maintainability
- **Fix**: concrete suggestion
- **Patch** (optional): unified diff
```

---

## Review Report Structure (from orchestrator)

```markdown
# Review Report

## Verdict: APPROVE | APPROVE_WITH_SUGGESTIONS | REQUEST_CHANGES

## Summary
<2-4 sentences>

## Review Scope
- Branch / merge-base / scope mode
- Reviewers dispatched
- Changed files count

## Stats
blocker: N | major: N | minor: N | info: N

## Blockers
## Major Issues
## Minor & Info
## Positive Notes
```

---

## Project-Specific Patterns (CLAUDE.md)

`review-frontend` reads the project's `CLAUDE.md` and `src/*/CLAUDE.md` in Step 0 before running the checklist. Patterns defined there override the generic checklist (except Iron Laws).

Common project patterns detected and applied:
- `currentState` @computed pattern with `toJS()` and `isEqual` dirty-check
- Composite store pattern: fixed child = `readonly`, swappable = `@observable.shallow`
- Inter-store methods as arrow functions vs. `@action.bound` for UI entrypoints
- Hooks-to-avoid: `useState` → `@observable`, `useMemo` → `@computed`
- Store lifecycle bridge via `useEffect` (onMount/onUnmount — not an A3 violation)

---

## Scope Boundaries Between Reviewers

| Concern | Reviewer |
|---------|---------|
| Logic bugs, null-safety, spec compliance | `review-logic` |
| Layer violations, module coupling, SOLID at system level | `review-architecture` |
| OWASP, injection, auth bypass, secrets | `review-security-code` |
| React re-renders, N+1, bundle size | `review-performance` |
| React observer, MobX store internals, MVVM boundary | `review-frontend` |
| NestJS patterns, DTO, DB queries, API design | `review-backend` |
| Naming convention formatting, dead code, import order | `review-style` |
| Meaningful names, function size, DRY, error handling, SOLID at code level | `review-clean-code` |
| Race conditions, connection pools, caching, queues, retries, idempotency | `review-highload` |
| Elevating findings, strict engineering judgment | `review-strict` |
| Existing GitHub PR comment analysis | `review-pr-feedback` |

---

## Iron Laws

Each reviewer has its own Iron Laws. Universal laws across the entire domain:

1. **Every finding must cite a specific `file:line` from the diff.** Pre-existing problems in unchanged lines are out of scope.
2. **Severity is per-finding, not averaged.** One blocker from any reviewer sets the consolidated verdict to REQUEST_CHANGES.
3. **`review-strict` never changes semantics of findings from other reviewers** — it only elevates severity and adds direct commentary.
4. **`review-pr-feedback` is not a code reviewer** — it synthesizes human/bot review comments; it does not inspect the diff.

---

## Adding a New Reviewer

1. Create `skills/review-<name>/SKILL.md` following the standard contract
2. Add the reviewer to `review-orchestrator` routing table (flag + auto-detection)
3. Add a row to the subagents table in `AGENTS.md`
4. Update `README.md` skill count and Review category

Planned future reviewers: `review-api` (REST/gRPC/GraphQL contracts), `review-tests` (test quality and coverage), `review-database` (schema design and migration safety), `review-accessibility` (a11y for frontend).

## Skills count: 12 (1 orchestrator + 11 reviewers)
