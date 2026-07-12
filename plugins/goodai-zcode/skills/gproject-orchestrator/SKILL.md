---
name: gproject-orchestrator
description: >
  Project documentation orchestrator — builds PRDs, specs, and implementation plans
  through a phased pipeline of specialized subagents.
  Use when: "Create project documentation", "Write PRD for...", "Plan project...",
  "Document how to implement...", "Spec out feature...", "Project planning",
  "gproject", "Создай документацию проекта", "Напиши PRD".
  Make sure to use this skill whenever the user mentions PRD, project planning,
  technical specification, implementation plan, feature spec, architecture document,
  project documentation, or wants to plan any software project from scratch or
  document a new feature in an existing codebase — even if they don't explicitly
  say "PRD" or "spec". Also trigger on: "how should I build...", "plan out...",
  "what's the best approach to build...", "document the approach for...",
  "create a roadmap for...", "spec this out", "write requirements for...".
  NOT for: code implementation (use job-orchestrator), code review (use code-review skills).
version: 1.1.0
---

<!-- SUBAGENT-STOP: If you are a subagent dispatched by another orchestrator, HALT.
     Return STATUS: BLOCKED — gproject-orchestrator must run as top-level agent only. -->

# gproject-orchestrator

## Purpose

Thin orchestrator that drives a project documentation pipeline through 7 phases.
Each phase dispatches a specialized subagent, collects a compact summary,
and persists full artifacts to disk. The orchestrator never reads full artifacts —
it operates on summaries, decisions, and statuses only.

---

## Iron Laws

| # | Law | Violation = |
|---|-----|-------------|
| 1 | Orchestrator NEVER generates document content itself | Hallucinated docs with no specialist review |
| 2 | Orchestrator NEVER reads full artifact files — only summaries | Context bloat, degraded routing quality |
| 3 | Every phase MUST produce an artifact file before proceeding | Lost work, broken dependency chain |
| 4 | Human gate CANNOT be skipped — even if subagent returns DONE | Unvalidated decisions propagate downstream |
| 5 | NEEDS_CONTEXT questions MUST have answer options (A/B/C/D) | Open-ended questions waste user time |
| 6 | Decisions registry is append-only — no silent overwrites | Decision traceability destroyed |
| 7 | Each subagent gets ONLY artifacts listed in its dispatch contract | Context pollution between phases |

## Red Flags

| Flag | What's happening | Action |
|------|-----------------|--------|
| Orchestrator writing >20 lines of document content | Doing subagent's job | STOP → dispatch subagent |
| Subagent response >500 tokens in orchestrator context | Summary too fat | STOP → ask subagent to re-summarize |
| Phase N referencing artifact from Phase N-3 directly | Skipping dependency chain | STOP → pass through decisions registry |
| Human said "change stack" at Phase 5 | Late architecture change | STOP → rollback to Phase 2, invalidate downstream |

---

## Pipeline Phases

```
Phase 0: Discovery        → discovery-brief.md
Phase 1: Problem Definition → problem-statement.md
Phase 2: Stack + Level    → stack-decision.md
  ── Human + BP review gate ──
Phase 3: Patterns + Arch  → architecture.md + tech-bestpractices.md
  ── Human + BP review gate ──
Phase 4: PRD Generation   → prd.md
Phase 5: Consistency Review → consistency-report.md
  ── Human approval gate ──
Phase 6: Roadmap + Tasks  → roadmap.md
```

---

## Phase 0: Initialization

### On Start

1. Create job directory: `jobs/gproject-<slugified-name>/`
2. Create subdirectories: `artifacts/`, `man/`, `ai/`
3. Initialize `state.json` (see Artifact Templates section below)
4. Initialize `decisions.md` (see Artifact Templates section below)

### Mode Detection

Determine mode from user input:

```
IF user provides repo path OR mentions existing project/codebase:
  mode = "task_in_project"
  → Phase 0 dispatches: context-collector (existing skill) + gproject-discovery
  → Phase 2 may skip stack selection (inherit from project)

ELSE:
  mode = "new_project"
  → Phase 0 dispatches: interview (existing skill) + gproject-discovery
  → All phases are mandatory
```

Save mode to `state.json`.

---

## Dispatch Protocol

### Sending Task to Subagent

Every dispatch MUST follow this exact structure:

```
Task({
  description: "<phase_name>: <specific_task>",
  subagent_type: "general",
  prompt: |
    ## Your Role
    You are <agent_role>. Load skill: skills/gproject-<agent>/SKILL.md

    ## Task
    <specific_task_description>

    ## Input Artifacts (read these files)
    <list of ONLY relevant artifact file paths>

    ## Decisions So Far
    <compact YAML of relevant decisions from decisions.md>

    ## Constraints
    <list of constraints from previous phases>

    ## Output Contract
    1. Write full artifact to: jobs/<job>/artifacts/<artifact_name>.md
    2. Return ONLY (apply rules/core/terse-subagent-response.mdc):
       - STATUS: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
       - summary: (≤5 bullet fragments — no prose)
       - new_decisions: (key: value pairs, if any)
       - concerns: (if DONE_WITH_CONCERNS)
       - questions: (if NEEDS_CONTEXT, with A/B/C/D options)
       - next_phase_needs: (hints for orchestrator)
})
```

### Receiving Response from Subagent

Parse the STATUS prefix:

```
STATUS: DONE
  → Append new_decisions to decisions.md
  → Save summary to state.json.phase_summaries[phase_N]
  → Proceed to human gate (if applicable) or next phase

STATUS: DONE_WITH_CONCERNS
  → Append new_decisions to decisions.md
  → Present concerns to user with options:
    A) Accept and proceed
    B) Address concerns (re-dispatch subagent with guidance)
    C) Rollback to earlier phase

STATUS: NEEDS_CONTEXT
  → Parse questions array
  → For each question, decide resolution path:
    IF question.can_be_resolved_by_agent:
      → Dispatch helper agent (context-collector, web research)
      → Collect answer
    ELSE:
      → Present to user as questionnaire with A/B/C/D options
  → Re-dispatch original subagent with answers appended to context

STATUS: BLOCKED
  → Present blocker to user
  → User decides: provide info, skip phase, or abort
```

---

## Human Gate Protocol

After phases that produce key decisions (Phase 2, Phase 3, Phase 5):

```
1. Present to user:
   - Phase summary (from subagent response)
   - Key decisions made (from new_decisions)
   - Concerns (if any)

2. Ask user:
   A) Approve — proceed to next phase
   B) Request changes — provide specific feedback
   C) Rollback — go back to phase N (specify which)
   D) Abort — stop pipeline, save current state

3. If B (Request changes):
   → Append user feedback to subagent context
   → Re-dispatch same subagent with: original artifacts + user feedback
   → Max 3 iterations per gate, then escalate to user

4. If C (Rollback):
   → Set state.json.current_phase = target_phase
   → Invalidate all decisions from target_phase onward
   → Mark invalidated artifacts as _superseded
   → Re-run from target_phase
```

---

## Phase Details

### Phase 0: Discovery

**Subagent**: `gproject-discovery`
**Reuses**: `interview` (existing skill), `context-collector` (existing skill)
**Input**: User's initial request + any uploaded documents + repo path (if task_in_project)
**Output**: `artifacts/discovery-brief.md`
**Decisions**: D_mode, D_domain, D_audience, D_scale_estimate

### Phase 1: Problem Definition

**Subagent**: `gproject-problem-definer`
**Input**: `artifacts/discovery-brief.md`
**Output**: `artifacts/problem-statement.md`
**Decisions**: D_core_problems[], D_goals[], D_non_goals[], D_success_metrics[]

### Phase 2: Stack + Level Selection

**Subagent**: `gproject-stack-advisor`
**Reuses**: `brainstorm` (existing skill) for architecture exploration
**Input**: `artifacts/problem-statement.md` + decisions so far
**Output**: `artifacts/stack-decision.md`
**Decisions**: D_level (MVP/pet/startup/production), D_frontend, D_backend, D_database, D_infra, D_deploy
**Gate**: Human + BP review (mandatory)

### Phase 3: Patterns + Architecture

**Subagent**: `gproject-patterns-researcher`
**Input**: `artifacts/stack-decision.md` + decisions so far
**Output**: `artifacts/architecture.md` + `artifacts/tech-bestpractices.md`
**Decisions**: D_arch_pattern, D_frontend_patterns, D_backend_patterns, D_db_patterns, D_api_style, D_auth_approach
**Gate**: Human + BP review (mandatory)

### Phase 4: PRD Generation

**Subagent**: `gproject-spec-writer`
**Input**: `artifacts/problem-statement.md` + `artifacts/architecture.md` + `artifacts/tech-bestpractices.md` + all decisions
**Output**: `artifacts/prd.md`
**Decisions**: none (PRD is constrained by existing decisions)
**Note**: PRD writer MUST NOT introduce new architectural decisions — only reference existing ones

### Phase 5: Consistency Review

**Subagent**: `gproject-consistency-checker`
**Input**: ALL artifacts + `decisions.md`
**Output**: `artifacts/consistency-report.md`
**Gate**: Human approval (mandatory)
**Note**: If violations found, orchestrator decides rollback target based on violation type

### Phase 6: Roadmap + Tasks

**Subagent**: `gproject-planner`
**Input**: `artifacts/prd.md` + `artifacts/architecture.md` + decisions
**Output**: `artifacts/roadmap.md`
**Decisions**: D_milestones[], D_estimated_phases, D_critical_path

---

## State Resumption

On start, check if `jobs/gproject-*/state.json` exists:

```
IF state.json exists AND status == "in_progress":
  → Show user: "Found interrupted job: <job_name> at Phase <N>"
  → Ask: A) Resume from Phase <N>  B) Start fresh  C) Show current state
  → If A: load state, continue from current_phase
```

---

## Context Budget Rules

| What | Max tokens in orchestrator context |
|------|-----------------------------------|
| state.json | ~200 |
| decisions.md | ~500 (grows ~80 per phase) |
| All phase summaries combined | ~800 (max 120 per phase) |
| Current dispatch + response | ~400 |
| **Total orchestrator overhead** | **~1900 tokens** |

If decisions.md exceeds 800 tokens, create a `decisions-compact.md` with only
decision IDs and values (no rationale). Subagents still receive full decisions
for their relevant phases.

---

## Parallel Dispatch (Advanced)

Some phases support parallel subagent execution:

```
Phase 0: interview + context-collector can run in parallel
Phase 3: per-technology BP research can be parallelized
Phase 5: consistency checks per section can be parallelized
```

Only parallelize when subagents have NO data dependency on each other.

---

## Integration with Existing Skills

| Existing Skill | Used In | How |
|---------------|---------|-----|
| `interview` | Phase 0, NEEDS_CONTEXT resolution | Dispatched for user clarification with max 7 questions |
| `context-collector` | Phase 0 (task_in_project mode) | Collects codebase context, outputs to `ai/context.md` |
| `brainstorm` | Phase 2 (optional) | Architecture exploration with 3 parallel agents |
| `job-documenter` | All phases | Creates/updates job documentation structure |

---

## Output Structure

Final job directory:

```
jobs/gproject-<name>/
├── state.json                     # Pipeline state
├── decisions.md                   # Append-only decisions registry
├── artifacts/
│   ├── discovery-brief.md         # Phase 0
│   ├── problem-statement.md       # Phase 1
│   ├── stack-decision.md          # Phase 2
│   ├── architecture.md            # Phase 3
│   ├── tech-bestpractices.md      # Phase 3
│   ├── prd.md                     # Phase 4
│   ├── consistency-report.md      # Phase 5
│   └── roadmap.md                 # Phase 6
├── man/
│   └── summary.md                 # Executive summary (auto-generated at end)
└── ai/
    └── context.md                 # Codebase context (from context-collector)
```

---

## Reference Files

Read these files when needed — they are NOT loaded into context by default:

- `rules/core/gproject-contracts.mdc` — Dispatch/return contracts, context budget, NEEDS_CONTEXT protocol

---

## Artifact Templates

Use these templates when initializing the job directory or dispatching subagents.
Pass the relevant template section to each subagent so it knows the expected output format.

### decisions.md Template

```markdown
# Decisions Registry
<!-- Append-only. Orchestrator and consistency-checker read this file. -->

| ID | Phase | Decision | Value | Rationale |
|----|-------|----------|-------|-----------|
| D_mode | 0 | Project mode | new_project | User described from-scratch idea |
| D_domain | 0 | Business domain | food delivery | Explicitly stated |
```

### state.json Template

```json
{
  "job_name": "gproject-<slugified-name>",
  "created_at": "<ISO timestamp>",
  "current_phase": 0,
  "status": "in_progress",
  "mode": null,
  "decisions": {},
  "phase_summaries": {},
  "blocked_questions": [],
  "history": []
}
```

Fields:
- `history[]`: array of `{phase, status, timestamp, summary}` for audit trail
- `blocked_questions[]`: unresolved NEEDS_CONTEXT questions carried forward

### discovery-brief.md Template (Phase 0)

```markdown
# Discovery Brief: <Name>

## Source Summary
- User input: <what was provided>
- Documents analyzed: <list or "none">
- Codebase scanned: <yes/no, scope>
- Web research: <topics covered>

## Project/Task Description
<2-3 paragraphs>

## Key Facts (confirmed)
- <fact> [source: user input | document | codebase | web]

## Assumptions (need validation)
- <assumption> — confidence: high | medium | low

## Stakeholders & Users
- Primary: <who>
- Secondary: <who>

## Existing Context (task_in_project only)
- Stack: <detected>
- Architecture: <detected>
- Related components: <paths>

## Competitive Context (new_project only)
- Similar products: <list>

## Constraints
- Budget: | Timeline: | Team: | Technical:

## Open Questions
- <question> — impacts: <downstream decisions>

## Confidence: high | medium | low
```

### problem-statement.md Template (Phase 1)

```markdown
# Problem Statement: <Name>

## Core Problems
### P1: <Title>
<User type> cannot <action> because <reason>, resulting in <consequence>.
**Impact**: high | medium | low — **Evidence**: <from discovery>

## Goals
### G1: <Title>
**Statement**: <SMART goal>
**Metric**: <measurable> — **Target**: <value> — **Measured by**: <method>

## Non-Goals
### NG1: <Title>
**Why excluded**: <rationale>

## Target Users
### Primary Persona
- Who | Core need | Current solution

## Success Criteria
| Metric | Baseline | Target | Method |
|--------|----------|--------|--------|

## Scope Boundary
**In scope**: ... — **Out of scope**: ...
```

### stack-decision.md Template (Phase 2)

```markdown
# Stack Decision: <Name>

## Project Level: <MVP | pet | startup | production>
**Rationale**: <based on constraints>

## Technology Stack
### <Layer>: <Choice>
**Version**: <specific> — **Rationale**: <tied to constraints>
**Alternative considered**: <what, why rejected>

## Compatibility Matrix
| A | B | Quality |
|---|---|---------|

## Trade-offs Accepted
| Trade-off | Gain | Cost |

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
```

### architecture.md Template (Phase 3)

```markdown
# Architecture: <Name>

## Pattern: <e.g., Clean Architecture>
**Rationale**: ... — **Alternative**: ...

## Layers
<layer diagram description>

## Module Structure
<feature-based | layer-based | hybrid>

## Cross-Cutting Concerns
- Auth: <pattern>
- Errors: <pattern>
- Logging: <pattern>

## Key Decisions
| Decision | Choice | Rationale | Alternative |
```

### tech-bestpractices.md Template (Phase 3)

```markdown
# Technical Best Practices & Constraints

> Every PRD requirement MUST be compatible with these constraints.
> Consistency checker validates against these rules.

## <Technology> Constraints
### MUST
- [ ] <constraint>
### MUST NOT
- [ ] <antipattern>
### SHOULD
- [ ] <recommendation>

## Testing Constraints
### Pyramid Target
- Unit: X% | Integration: Y% | E2E: Z%
```

### prd.md Template (Phase 4)

See `skills/gproject-spec-writer/SKILL.md` for full PRD and
Implementation Plan templates. Key sections:
- Executive Summary
- Goals & Metrics (reference problem-statement.md)
- Technical Foundation (reference stack + architecture)
- User Stories by Epic (with acceptance criteria)
- Traceability Matrix (story → goal → constraint)

### consistency-report.md Template (Phase 5)

```markdown
# Consistency Report: <Name>

## Verdict: PASS | PASS_WITH_WARNINGS | FAIL

## Summary
Checks: <N> | CRITICAL: <N> | WARNING: <N> | INFO: <N>

## Violations
### CRITICAL
#### V-001: <Title>
Check: | Found in: | Conflicts with: | Fix target:

## Audit Trail
| Category | Checked | Passed | Failed |
```

### roadmap.md Template (Phase 6)

```markdown
# Roadmap: <Name>

## Overview
Milestones: <N> | Tasks: <N> | Duration: <optimistic—realistic—pessimistic>

## Milestone 0: Foundation
**Deliverable**: <demo-able result>
| Task ID | Title | Layer | Depends On | Estimate | Story |

## Dependency Graph
T-001 → T-002 → T-010 (critical path)

## Risk-Adjusted Timeline
| Scenario | Duration | Assumptions |
```
