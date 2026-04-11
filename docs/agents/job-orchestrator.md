# Job Orchestrator

**Skill:** `skills/job-orchestrator/SKILL.md` · **Version:** v3.2.0

The job-orchestrator is the primary multi-step implementation agent. It takes a user intent (GitHub issue, feature request, or custom task) and runs a full autonomous pipeline: analysis → test stubs → implementation → quality gate → code review → PR.

---

## When to Use

| Trigger | Use orchestrator? |
|---|---|
| "Implement issue #N" | Yes — directly |
| "Issue to PR", "Full implementation" | Yes — directly |
| "Full review", "Полное ревью" | Yes — directly |
| "Analyze and implement" | Yes — directly |
| "Analyze issue #N" (analysis only) | Yes — ask user if they want full pipeline |
| Simple one-file fix | No — direct tool use |
| Quick question about code | No — answer directly |

**AGENTS.md routing:** See Step 1.5 in `AGENTS.md` — when a request implies orchestration or the user confirms orchestrated execution, route to `job-orchestrator`.

---

## How to Launch

### Interactive (Claude Code)
```
/job-orchestrator
```
Or simply describe the task:
> "Implement issue #42"
> "Issue to PR: add rate limiting to the auth endpoint"

The orchestrator runs Phase 0 (context collection) interactively, asks for confirmation, then executes autonomously.

### Via AGENTS.md Routing
When the orchestrator is selected at Step 1.5:
1. Claude loads `skills/job-orchestrator/SKILL.md`
2. Phase 0.0 checks for interrupted jobs to resume
3. Phase 0.1–0.4 collects context and presents a plan
4. User confirms → autonomous execution begins

---

## Full Pipeline (implement intent)

```
Phase 0: CONTEXT COLLECTION
  0.0  Check for interrupted jobs (offer resume)
  0.1  Determine intent (implement / analyze / review / custom)
  0.2  Collect: project dir, base branch, job name
  0.3  Interview (for implement intent) — clarify ambiguities
  0.4  Summarize and confirm plan with user

Phase 1: PLAN BUILDING
  1.1  Build execution plan (steps + conditions)
  1.2  Initialize job documentation (job-documenter)
  1.3  Display plan + get user approval

Phase 2: EXECUTION
  Step 1   analyze          → issue-analyzer
  Step 2   context          → context-collector (incl. test framework detection)
  Step 3   prepare          → create feature branch via wt switch -c
  Step 4   tests-creator    → generate RED test stubs per task (MANDATORY)
  Step 5   implement        → task-implementer × N tasks (wave-parallel)
  Step 6   sanity-check     → verify commits exist (orchestrator-internal)
  Step 7   verify           → code-verifier (lint + types + tests + imports)
  Step 8   review           → code-review × 4 parallel agents
  Step 9   security         → security-audit [conditional: auth/API/DB files]
  Step 10  fix              → task-implementer [conditional: CRITICAL/HIGH findings]
  Step 11  verify-post-fix  → code-verifier [conditional: after fix]
  Step 12  perf-check       → perf-check [conditional: frontend/bundle files]
  Step 13  report           → orchestrator produces final summary
  Step 14  pr               → gh CLI creates PR [conditional: create_pr=true]
  Step 15  deploy           → deploy [conditional: user confirms staging deploy]

Phase 3: COMPLETION
  - Final report with all findings, links, metrics
  - Job documentation saved in jobs/<job-name>/
```

---

## Sub-Agents Dispatched

| Sub-Agent | When | Purpose |
|---|---|---|
| `issue-analyzer` | Step 1 | Decomposes issue into tasks with acceptance_criteria |
| `context-collector` | Step 2 | Gathers docs, library refs, test framework info |
| `tests-creator` | Step 4, **always** | Generates failing test stubs before implementation |
| `task-implementer` | Step 5, 10 | Implements tasks; in fix mode applies review findings |
| `code-verifier` | Step 7, 11 | Runs lint, type-check, tests, circular imports |
| `code-review` | Step 8 | 4-agent parallel review (correctness, security, style, architecture) |
| `security-audit` | Step 9 | Dependency audit + secrets scan (if security-sensitive files changed) |
| `perf-check` | Step 12 | Bundle size, slow queries, async patterns (if frontend files changed) |
| `job-documenter` | Throughout | Creates and maintains job documentation in jobs/<job-name>/ |

---

## Rules Always Loaded

The orchestrator loads these rules for its own decision-making. Sub-agents load their own rules based on task type (see `task-implementer` docs).

- `implementation-doc-mandate.mdc` — spec before code, change report after
- `jobs-documentation.mdc` — job folder structure and conventions
- `subagent-status-protocol.md` — STATUS: DONE / BLOCKED / NEEDS_CONTEXT protocol
- `subagent-context-construction.md` — how to build context for sub-agent dispatches

---

## Mandatory Invariants (Iron Laws)

1. **tests-creator runs before every task-implementer wave.** No exceptions, even if user says "skip tests".
2. **code-verifier runs after implementation.** gate must be PASS before review is launched.
3. **job-documenter is initialized before execution.** All results are saved, not just reported.
4. **The spec is created in Phase 0.4 (summarize).** Execution does not start without user confirmation.

---

## Output

At completion, the orchestrator produces:
- **PR URL** (if create_pr=true)
- **Final report**: tasks completed, files changed, test results, gate status, review findings
- **Persistent job docs** in `~/goodai-base/jobs/<job-name>/`:
  - `man/README.md` — human-readable job summary
  - `man/spec.md` — initial plan and acceptance criteria
  - `man/change-report.md` — what was actually implemented
  - `ai/context.md` — research context used by sub-agents
  - `ai/analysis.json` — issue-analyzer output

---

## Resuming an Interrupted Job

If the orchestrator is interrupted mid-execution:
1. Launch it again: `/job-orchestrator`
2. Phase 0.0 checks `~/goodai-base/jobs/` for incomplete `state.json`
3. If found: "Found paused job '<name>'. Resume or start new?"
4. On resume: execution continues from the first uncompleted step

---

## Example Flow

```
User: "Implement issue #42 — add rate limiting to auth"

Phase 0: Collect context
  → issue #42 fetched, 3 tasks identified
  → project: /home/dev/myapp, base: main
  → job: issue-42--rate-limiting

Phase 1: Plan built, user confirms

Phase 2 execution:
  analyze:       3 tasks (service_api × 2, fix × 1)
  context:       detects vitest, loads api-contracts.mdc
  prepare:       branch feature/42-rate-limiting created
  tests-creator: 12 test stubs committed (RED, all failing)
  implement:     3 task-implementer agents (wave 1: task-1,2 parallel; wave 2: task-3)
  verify:        PASS — 12/12 tests green, 0 lint errors, 0 type errors
  review:        2 HIGH findings (missing error handling in middleware)
  fix:           task-implementer fixes 2 findings
  verify-post:   PASS
  pr:            PR #43 created → github.com/org/myapp/pull/43
```

---

## See Also

- `skills/job-orchestrator/SKILL.md` — full skill specification
- `docs/agents/tests-creator.md` — TDD pipeline details
- `docs/agents/code-verifier.md` — quality gate details
- `rules/core/implementation-doc-mandate.mdc` — documentation mandate
- `rules/core/tdd-workflow.mdc` — TDD rules loaded by sub-agents
