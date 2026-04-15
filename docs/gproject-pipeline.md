# gproject — Project Documentation Pipeline

> A standalone, decision-driven orchestrator that transforms a project idea or feature request into a complete, validated specification: problem statement, technology stack, architecture, PRD, and implementation roadmap.

## Why gproject

Most AI-assisted planning either produces a one-shot PRD with no traceability, or goes straight to implementation without a validated spec. `gproject` fills the gap between "we have an idea" and "we have an implementable, internally-consistent plan":

- Every decision is recorded in an append-only registry (`decisions.md`)
- Each phase is constrained by prior decisions — no phase can silently contradict an earlier one
- Human gates at critical decision points (stack, architecture, consistency) prevent bad decisions from propagating
- The pipeline produces standalone artifacts — no downstream tooling is prescribed

---

## Pipeline Overview

```
Phase 0  gproject-discovery           → discovery-brief.md
Phase 1  gproject-problem-definer     → problem-statement.md
Phase 2  gproject-stack-advisor       → stack-decision.md          ← Human gate
Phase 3  gproject-patterns-researcher → architecture.md
                                        tech-bestpractices.md      ← Human gate
Phase 4  gproject-spec-writer         → prd.md
Phase 5  gproject-consistency-checker → consistency-report.md      ← Human approval
Phase 6  gproject-planner             → roadmap.md
```

All phase artifacts are persisted to `jobs/gproject-<name>/artifacts/`. The pipeline state is tracked in `state.json` and supports resumption from any interrupted phase.

---

## Modes

| Mode | Trigger | Phase 0 behaviour |
|------|---------|-------------------|
| `new_project` | User describes idea from scratch | `interview` skill + `gproject-discovery` |
| `task_in_project` | User provides a repo path or mentions existing codebase | `context-collector` + `gproject-discovery` (inherits stack from codebase) |

In `task_in_project` mode, Phase 2 may skip stack selection entirely if the existing stack is detected.

---

## Phase Details

### Phase 0 — Discovery (`gproject-discovery`)

**Input:** User's initial request, any uploaded documents, optional repo path  
**Output:** `artifacts/discovery-brief.md`

Collects and structures all available information about the project:
- Source summary (user input, documents, codebase scan, web research)
- Project description, key facts, assumptions with confidence levels
- Stakeholders, constraints, open questions
- Competitive context (new project) or existing stack/architecture (task in project)

**Decisions recorded:** `D_mode`, `D_domain`, `D_audience`, `D_scale_estimate`

---

### Phase 1 — Problem Definition (`gproject-problem-definer`)

**Input:** `discovery-brief.md`  
**Output:** `artifacts/problem-statement.md`

Translates the discovery brief into a formal problem statement using the structure: *"[User type] cannot [action] because [reason], resulting in [consequence]."*

Defines:
- Core problems with impact ratings and evidence
- Goals as SMART statements with measurable targets
- Non-goals with explicit rationale
- Target personas and success criteria

**Decisions recorded:** `D_core_problems[]`, `D_goals[]`, `D_non_goals[]`, `D_success_metrics[]`

---

### Phase 2 — Stack Selection (`gproject-stack-advisor`) ← Human gate

**Input:** `problem-statement.md` + decisions so far  
**Output:** `artifacts/stack-decision.md`

Recommends a technology stack matched to the project's scale level:

| Level | Description |
|-------|-------------|
| `MVP` | Fastest to working demo, minimal ops overhead |
| `pet` | Personal project, learning-focused |
| `startup` | Production-ready, scalable, maintainable |
| `production` | Enterprise: security hardening, observability, compliance |

For each layer (frontend, backend, database, infra, deploy), documents the chosen technology, version, rationale, alternatives considered, and accepted trade-offs.

May call `brainstorm` in parallel for contested architectural decisions.

**Human gate:** User reviews stack choices. Can approve, request changes, or rollback to Phase 1.

**Decisions recorded:** `D_level`, `D_frontend`, `D_backend`, `D_database`, `D_infra`, `D_deploy`

---

### Phase 3 — Architecture & Best Practices (`gproject-patterns-researcher`) ← Human gate

**Input:** `stack-decision.md` + all decisions  
**Output:** `artifacts/architecture.md` + `artifacts/tech-bestpractices.md`

Produces two artifacts:

**`architecture.md`** — Structural decisions:
- Architectural pattern (Clean Architecture, Hexagonal, Layered, etc.) with rationale
- Layer structure and module organization
- Cross-cutting concerns: auth, error handling, logging, caching

**`tech-bestpractices.md`** — Technology-specific constraints formatted as MUST / MUST NOT / SHOULD checklists. The consistency checker in Phase 5 validates the PRD against these constraints.

**Human gate:** User reviews architecture decisions before the PRD is written.

**Decisions recorded:** `D_arch_pattern`, `D_frontend_patterns`, `D_backend_patterns`, `D_db_patterns`, `D_api_style`, `D_auth_approach`

---

### Phase 4 — PRD Generation (`gproject-spec-writer`)

**Input:** `problem-statement.md` + `architecture.md` + `tech-bestpractices.md` + all decisions  
**Output:** `artifacts/prd.md`

Writes the Product Requirements Document fully constrained by phases 0–3. The spec writer makes **no new architectural decisions** — it only translates existing decisions into user stories, acceptance criteria, and a traceability matrix.

PRD structure:
- Executive Summary
- Goals & Metrics (referenced from problem-statement.md)
- Technical Foundation (referenced from stack + architecture)
- User Stories by Epic with P0/P1/P2 priority
- Acceptance Criteria per story
- Traceability Matrix: story → goal → constraint

---

### Phase 5 — Consistency Review (`gproject-consistency-checker`) ← Human approval

**Input:** All artifacts + `decisions.md`  
**Output:** `artifacts/consistency-report.md`

Adversarial validator — reads all artifacts and checks for:
- PRD requirements that contradict tech-bestpractices.md constraints
- User stories referencing components not in the architecture
- Stack decisions that conflict with each other
- Goals without measurable success criteria
- Non-goals that appear as requirements

Returns one of:
- `PASS` — proceed to Phase 6
- `PASS_WITH_WARNINGS` — proceed, but human reviews warnings
- `FAIL` — human decides rollback target based on violation type

**Human approval:** Required before the roadmap is generated. Ensures the spec is internally consistent before committing to an implementation plan.

---

### Phase 6 — Roadmap (`gproject-planner`)

**Input:** `prd.md` + `architecture.md` + all decisions  
**Output:** `artifacts/roadmap.md`

Transforms the approved PRD into an actionable implementation plan:

1. **Task decomposition** — each user story → implementation tasks with layer (frontend/backend/database/infra/testing), type (setup/feature/integration/test/docs), and effort estimates (optimistic / realistic / pessimistic)
2. **Dependency graph** — DAG of task dependencies, verified cycle-free
3. **Milestone grouping** — each milestone is independently deployable/demonstrable:
   - M0: Foundation (setup, tooling, CI/CD, auth skeleton)
   - M1: Core (all P0 user stories)
   - M2: Complete (P1 stories, polish, full test coverage)
   - M3: Launch-ready (P2 features, security hardening, monitoring)
4. **Critical path** — longest dependency chain, bottleneck tasks flagged
5. **Risk-adjusted timeline** — three-scenario duration estimate

`roadmap.md` is the final pipeline deliverable.

---

## Decisions Registry

Every decision made by any subagent is appended to `decisions.md` — an append-only table:

```markdown
| ID | Phase | Decision | Value | Rationale |
|----|-------|----------|-------|-----------|
| D_mode | 0 | Project mode | new_project | User described from-scratch idea |
| D_level | 2 | Project level | startup | Team of 3, production launch in 6mo |
| D_backend | 2 | Backend framework | NestJS | TypeScript-first, aligns with team expertise |
```

No phase overwrites a prior decision. If a downstream phase discovers a conflict, it returns `BLOCKED` and the orchestrator triggers a rollback to the appropriate phase, invalidating all decisions made after that point.

---

## Human Gates

Three mandatory human gates prevent bad decisions from propagating:

| Gate | After Phase | What's Reviewed | Options |
|------|------------|-----------------|---------|
| Stack gate | Phase 2 | Technology choices, project level | Approve / Request changes / Rollback |
| Architecture gate | Phase 3 | Architectural pattern, constraints | Approve / Request changes / Rollback |
| Consistency gate | Phase 5 | Full cross-artifact validation | Approve / Address violations / Rollback |

Each gate allows up to 3 revision iterations before escalating to the user.

---

## NEEDS_CONTEXT Protocol

When a subagent lacks information to proceed, it returns `NEEDS_CONTEXT` with structured A/B/C/D questions. The orchestrator:

1. Checks if the question can be resolved by a helper agent (web research, codebase scan)
2. If yes — dispatches helper agent, injects answer, re-dispatches original agent
3. If no — presents structured questionnaire to the user

Open-ended questions are never surfaced to the user — always multiple choice.

---

## State Resumption

The pipeline state is persisted in `jobs/gproject-<name>/state.json`. If a session is interrupted, the orchestrator detects the in-progress job on next start and offers:

```
Found interrupted job: gproject-my-app at Phase 3
A) Resume from Phase 3
B) Start fresh
C) Show current state
```

---

## Output Structure

```
jobs/gproject-<name>/
├── state.json                     # Pipeline state + phase summaries
├── decisions.md                   # Append-only decisions registry
├── artifacts/
│   ├── discovery-brief.md         # Phase 0
│   ├── problem-statement.md       # Phase 1
│   ├── stack-decision.md          # Phase 2
│   ├── architecture.md            # Phase 3
│   ├── tech-bestpractices.md      # Phase 3
│   ├── prd.md                     # Phase 4
│   ├── consistency-report.md      # Phase 5
│   └── roadmap.md                 # Phase 6 — final deliverable
├── man/
│   └── summary.md                 # Executive summary (auto-generated at end)
└── ai/
    └── context.md                 # Codebase context (task_in_project mode)
```

---

## Iron Laws

| # | Law |
|---|-----|
| 1 | Orchestrator NEVER generates document content — only subagents write artifacts |
| 2 | Orchestrator NEVER reads full artifact files — only compact summaries |
| 3 | Every phase MUST produce an artifact file before proceeding |
| 4 | Human gates CANNOT be skipped |
| 5 | NEEDS_CONTEXT questions MUST have A/B/C/D options |
| 6 | `decisions.md` is append-only — no silent overwrites |
| 7 | Each subagent receives ONLY artifacts listed in its dispatch contract |

---

## Routing

- **User says "Write PRD", "Plan project", "Spec out feature"** → Ask: quick (`prd-creator`) or full pipeline (`gproject-orchestrator`)?
- **User says "gproject"** → `gproject-orchestrator` directly
- **User provides a repo path + feature request** → `gproject-orchestrator` in `task_in_project` mode
- **Scope boundary**: `gproject-orchestrator` ends at `roadmap.md` — code implementation is a separate concern

See also: [AGENTS.md § Project Documentation Skills](../AGENTS.md)
