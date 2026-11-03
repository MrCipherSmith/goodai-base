---
name: constraint-driven-development
description: "Use when a project needs a persistent, measurable quality bar — starting a project without documented standards, 'set up constraints', or when coverage/perf/a11y thresholds get re-debated per-PR. Produces CONSTRAINTS.md with enforceable numbers, ratchets, and a guard against silent weakening. NOT for throwaway prototypes or a one-off CI setup."
triggers:
  - "/constraints"
  - "set up constraints"
  - "define our standards"
  - "quality bar"
  - "CONSTRAINTS.md"
  - "enforce thresholds"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "quality"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# Constraint-Driven Development

## What It Does

Creates a written, machine-checkable record of a project's quality bar — a single canonical `CONSTRAINTS.md` with **measurable thresholds** — so judgement moves out of one person's head and into checks that run around the loop.

> "An agent writes more in an afternoon than you will read that week." Prose guidelines get ignored; numbers wired to tools do not.

## When to Use

- Starting a project with no documented quality standards
- User asks to "set up constraints" / "define our standards"
- Agents produce high volume without accountability
- Coverage, performance, or accessibility thresholds get re-argued per-PR instead of decided once
- Running autonomous loops where only the test suite constrains output

**Avoid when:** `CONSTRAINTS.md` already exists and the user is not changing it; throwaway prototypes/spikes; the immediate need is a code review (`review-orchestrator`) or a one-off CI pipeline.

## The Process

### Step 1 — Detect Before Asking
Gather existing context first: `package.json` scripts, test config, `.github/workflows/`, current coverage. Do not ask what you can read.

### Step 2 — Four Questions With Defaults
Exactly four, each with a sensible default (do not exceed four):
1. Which dimensions matter? (coverage, security, performance, accessibility, architecture)
2. Should failures **block** or **warn**?
3. Measure today's values, or specify targets?
4. Acceptable check duration?

### Step 3 — Write CONSTRAINTS.md
One canonical file, four parts:
- **Floor** — always enforced, no setup required (types compile, no secrets committed, build passes)
- **Enforced with numbers** — dimensions with tool + threshold
- **Measured, not yet enforced** — ratchet metrics (record today's value, enforce non-regression)
- **Exceptions** — each with an owner and an expiry date

### Step 4 — Install Required Tools
Match each dimension to its de-facto tool; do not build a custom checker when one exists:

| Dimension | Tool |
|---|---|
| Types | `tsc` / `mypy` |
| Lint | existing config (eslint / biome) |
| Coverage | test runner built-in |
| Security | `semgrep`, `gitleaks`, `osv-scanner` |
| Performance | Lighthouse, `size-limit` |
| Accessibility | `axe-core` |

### Step 5 — Wire to Lifecycle
Place each check where it costs least:
- **BUILD** (edit loop, < ~5s): types, lint, secrets
- **VERIFY** (< ~90s): related tests, coverage
- **REVIEW**: everything
- **SHIP** (CI): direction / ratchet checks

Scope expensive checks to the diff, never the whole tree in the fast loop.

### Step 6 — Guard the Bar Itself
Watch every diff for the five moves that weaken the bar:
1. Thresholds lowered
2. Tests made easier (skipped, deleted, assertions removed)
3. Checkers silenced (new suppressions / `eslint-disable` / `# noqa`)
4. Unfinished work (stubs, empty catches)
5. New exceptions added without discussion

A weakening move in the **same commit** as a feature is the loudest red flag.

### Step 7 — Ratchets for Unknown Baselines
No target number yet? Record the current value and enforce "must not fall." No argument required; the bar only moves one direction.

## Sane Defaults

| Constraint | Default | Rationale |
|---|---|---|
| Coverage of changed lines | ≥ 80% | Rigor vs. achievability |
| Project coverage | today's value, must not fall | No argument required |
| High+ dependency vulnerabilities | zero | Below this is mostly noise |
| LCP | ≤ 2500 ms | Core Web Vitals |
| CLS | ≤ 0.1 | Core Web Vitals |
| Accessibility violations | zero critical/serious | Moderate is debatable |
| Exception lifetime | 90 days | Balances planning vs. accountability |

## CONSTRAINTS.md Skeleton

```markdown
# CONSTRAINTS.md

## Floor (always enforced)
- Types compile: `tsc --noEmit`
- No secrets: `gitleaks detect`
- Build passes: `<build command>`

## Enforced with numbers
| Dimension | Tool | Threshold | Phase | Block/Warn |
|---|---|---|---|---|
| Coverage (changed lines) | vitest --coverage | ≥ 80% | VERIFY | block |
| High+ vulns | osv-scanner | 0 | SHIP | block |

## Measured, not yet enforced (ratchets)
| Metric | Today | Direction |
|---|---|---|
| Project coverage | 63% | must not fall |

## Exceptions
| What | Why | Owner | Expires |
|---|---|---|---|
| a11y on /legacy | pre-existing debt | @owner | 2026-12-01 |
```

## Rationalizations — Stop and re-read the rule if you think:

| Rationalization | Reality |
|---|---|
| "We'll add constraints once the code settles" | Code settles around whatever was allowed while moving |
| "Tests are the constraints" | Tests prove internal agreement, not new-code quality — add an external check |
| "We can't hit 80% coverage" | Record today's number and hold the line (ratchet) instead |
| "This will slow agents down" | Only if slow checks run in the fast loop — placement is the fix, not omission |
| "Constraints will block shipping" | Exceptions with owners and dates unblock as needed |
| "I'll just lower the threshold to make it pass" | Lowering the bar to pass IS the failure this skill exists to catch |

**IRON LAW: EVERY NUMBER HAS A TOOL AND A STATED REASON; THE BAR MOVES DOWN ONLY THROUGH AN OWNED, DATED EXCEPTION — NEVER SILENTLY IN A FEATURE COMMIT.**

## Red Flags

- Interview exceeded four questions, or config no one can explain
- A budget set that the current codebase fails, with no remediation plan
- A number assigned with no tool behind it
- A custom checker built where a de-facto tool exists
- Every constraint judged by the project's own tests (no external validation)
- `CONSTRAINTS.md` changed in the same commit as a failing feature
- Exceptions without owners, or multi-year expiries
- Agent proposed relaxing a threshold instead of fixing the code
- Slow checks in the edit loop pushing developers to `--no-verify`
- `CONSTRAINTS.md` untouched since creation

## Integration

- **`code-verifier`** reads `CONSTRAINTS.md` (if present) and fails its gate on any breached enforced threshold — see that skill's "Constraint Enforcement" section.
- **`review-orchestrator`** runs a guard-the-bar pass: any of the five weakening moves in the diff is a blocker-level finding.
- **`job-orchestrator`** / autonomous loops: constraints are the standing quality bar the loop must respect.

## Verification Checklist

- [ ] File exists; every number has a stated reason
- [ ] Floor passes on the current codebase with no changes
- [ ] Each dimension has an installed tool and a working command
- [ ] Every constraint declares its phase; the fast stage stays under a few seconds
- [ ] At least one external constraint present (not self-judged by project tests)
- [ ] Measured metrics record a baseline and a direction
- [ ] Every exception has an owner and an expiry date
- [ ] Agent docs (CLAUDE.md / AGENTS.md) point to the file
- [ ] Trial run on the current branch produces no disputed failures

## STATUS Protocol (when run as a sub-agent)

```
STATUS: DONE                 — CONSTRAINTS.md written, floor passes, tools wired
STATUS: DONE_WITH_CONCERNS   — written, but current codebase fails a target (remediation noted)
STATUS: BLOCKED              — required tool unavailable / cannot establish a baseline
STATUS: NEEDS_CONTEXT        — dimensions or block/warn policy undecided by the user
```
