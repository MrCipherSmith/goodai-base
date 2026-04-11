# Skills Overview

A map of all 32 skills — what they do, how they group, and how they interact.

---

## Ecosystem Map

```
User request
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│                    ENTRY POINTS                          │
│                                                          │
│  /job-orchestrator   — full autonomous pipeline          │
│  /feature-dev        — guided single-feature workflow    │
│  /task-implementer   — implement one atomic task         │
│  /code-review        — standalone review                 │
│  /commit /push /pr   — git utilities                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│               job-orchestrator pipeline                  │
│                                                          │
│  issue-analyzer  →  context-collector                    │
│       │                    │                             │
│       ▼                    ▼                             │
│  tests-creator  ←── acceptance_criteria + framework      │
│       │                                                  │
│       ▼  (RED stubs committed)                           │
│  task-implementer × N  (wave-parallel)                   │
│       │                                                  │
│       ▼  (GREEN code)                                    │
│  code-verifier  ──── gate: FAIL → fix loop               │
│       │                                                  │
│       ▼  (PASS)                                          │
│  code-review × 4  ┬─ correctness                         │
│  security-audit ──┘  ─ security (conditional)            │
│       │                                                  │
│       ▼                                                  │
│  perf-check  (conditional: frontend files)               │
│       │                                                  │
│       ▼                                                  │
│  job-documenter → pr                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Skills by Group

### Orchestrators

| Skill | What it does | When to use |
|---|---|---|
| `job-orchestrator` | Full autonomous pipeline: analyze → branch → tests → implement → verify → review → PR. 15 steps, dispatches all sub-agents. | "Implement issue #N", any multi-task feature |
| `feature-dev` | Guided 8-phase workflow for a single feature: spec → TDD → implement → verify → review → PR. | One focused feature, prefer interactive guidance |

**Key difference:** `job-orchestrator` decomposes GitHub issues into N parallel tasks; `feature-dev` handles one feature end-to-end with more user interaction.

---

### Analysis

| Skill | What it does | Output |
|---|---|---|
| `issue-analyzer` | Decomposes a GitHub issue into atomic tasks with acceptance_criteria, target_files, dependencies | JSON task list + dependency_order |
| `feature-analyzer` | Analyzes a feature branch across repos, maps changes, finds risks | Analysis report |
| `prd-creator` | Converts vague request into a formal testable PRD | Product Requirements Document |
| `interview` | Asks targeted questions to clarify requirements before implementation | Structured answers, blockers |
| `interviewer` | Drives a critical interview for ambiguous tasks | `derived_context`, `ready_to_proceed` |
| `brainstorm` | Explores architecture decisions and trade-offs | Options analysis, recommendation |

**Flow:** `prd-creator` → `interview`/`interviewer` → `issue-analyzer` → implementation

---

### Implementation Pipeline (TDD)

The mandatory sequence — enforced as Iron Laws in every implementing agent:

```
tests-creator  →  task-implementer  →  code-verifier
   (RED)              (GREEN)            (gate)
```

| Skill | What it does | Output |
|---|---|---|
| `tests-creator` | Detects test framework, converts acceptance_criteria into failing test stubs, commits RED state | `TEST_CASE_SPECS { framework, test_files, run_command }` |
| `task-implementer` | Reads RED stubs, implements code until tests go GREEN, never rewrites tests | Committed code, STATUS report |
| `code-verifier` | Runs lint + type-check + tests + circular imports, classifies findings by severity, issues gate verdict | `VERIFICATION_RESULT { gate, checks, findings, summary }` |

**Iron Laws:**
1. `tests-creator` MUST run before every `task-implementer` wave
2. `code-verifier` gate must be PASS before review launches
3. `task-implementer` must never rewrite or delete test stubs

---

### Review

Four specialized review agents run in parallel after implementation:

| Skill | Focus |
|---|---|
| `code-review` | Correctness, architecture, performance, security — full spectrum |
| `code-ai-review` | AI-assistant standards: hallucinations, model misuse, prompt injection |
| `code-boss-review` | Direct, strict feedback — no sugarcoating, business impact focus |
| `code-style-review` | Naming, organization, patterns, consistency |
| `code-mobx-store-review` | MobX-specific: state management, actions, computed values, reactivity |

All return findings with severity (CRITICAL / WARNING / SUGGESTION) and location (file:line).

---

### Quality (Conditional)

| Skill | Triggered when | What it checks |
|---|---|---|
| `security-audit` | auth/, api/, migrations, .env touched | Dependency CVEs, secrets scan, injection patterns |
| `perf-check` | *.tsx, *.jsx, *.css, dist/, build/ touched | Bundle size, slow queries, async patterns |
| `test-gen` | No tests in diff after implement | Generates unit/integration tests for uncovered modules |

---

### Context & Documentation

| Skill | What it does |
|---|---|
| `context-collector` | Gathers local docs, detects libraries, fetches external docs, detects test framework → unified `context_vN.md` |
| `job-documenter` | Creates and maintains `jobs/<job-name>/` folder: spec, change report, analysis JSON, context |
| `claude-md-management` | Saves session learnings (patterns, conventions, commands) to CLAUDE.md |

`context-collector` feeds into all implementing sub-agents — they receive the versioned context path and read it before starting.

---

### Git & CI/CD

| Skill | What it does |
|---|---|
| `commit` | Generates conventional commit message from diff, stages and commits |
| `push` | Pushes current branch with upstream tracking and safety checks |
| `pr` | Opens pull request with auto-generated title and description |
| `deploy` | Deploys to staging or production, supports multiple pipeline types |
| `db-migrate` | Creates, applies, rolls back, or checks database migrations |
| `dependency-update` | Checks for outdated packages, upgrades with compatibility verification |
| `changelog` | Generates changelog from git log between tags/versions |

---

### Utilities

| Skill | What it does |
|---|---|
| `pr-review-comments` | Reads PR review feedback, extracts actionable items, prepares fix list |
| `pr-issue-documenter` | Adds PR description, creates linked issue, updates documentation |
| `hookify` | Creates Claude Code / Cursor hooks from natural language description |
| `brainstorm` | Quick or deep architectural exploration (also used inside job-orchestrator) |

---

## Data Contracts Between Skills

Key outputs that flow between agents:

```
issue-analyzer
  └─ ANALYSIS_RESULT.tasks[]
       ├─ acceptance_criteria  →  tests-creator
       ├─ target_files         →  task-implementer
       └─ requires_tests_creator: true

tests-creator
  └─ TEST_CASE_SPECS
       ├─ framework            →  task-implementer (knows how to run tests)
       └─ test_files[].path    →  task-implementer (reads RED stubs)

code-verifier
  └─ VERIFICATION_RESULT
       ├─ gate: FAIL           →  job-orchestrator triggers fix loop
       └─ findings[]           →  task-implementer (fix mode input)

context-collector
  └─ context_vN.md path        →  ALL sub-agents (passed via job state)

code-review / security-audit
  └─ findings (CRITICAL/WARNING) → task-implementer (fix mode)
```

---

## Detailed Agent References

For deeper documentation on the major orchestrators:

- [`docs/agents/job-orchestrator.md`](agents/job-orchestrator.md) — 15-step pipeline, Iron Laws, resume, example flow
- [`docs/agents/tests-creator.md`](agents/tests-creator.md) — TDD stub generation, TEST_CASE_SPECS format
- [`docs/agents/code-verifier.md`](agents/code-verifier.md) — quality gate, severity table, gate logic

See also:
- [`docs/skill-catalog.md`](skill-catalog.md) — auto-generated table of all 32 skills
- [`docs/rules-catalog.md`](rules-catalog.md) — all engineering rules
- [`docs/onboarding.md`](onboarding.md) — getting started guide
