---
name: job-orchestrator
description: "Dynamic orchestrator that collects context from user, builds an execution plan based on intent, dispatches sub-agents (analyzers, reviewers, implementers), and maintains persistent job documentation via job-documenter. Replaces issue-orchestrator with a flexible, intent-driven pipeline."
triggers:
  - "Implement issue"
  - "Issue to PR"
  - "Orchestrate"
  - "Run pipeline"
  - "Analyze and implement"
  - "Full implementation"
  - "Full review"
  - "Полное ревью"
  - "Review my code"
  - "Analyze branch"
  - "Review via orchestrator"
  - "Orchestrated review"
  - "Auto-implement"
  - "Auto-implement issue"
  - "Orchestrate issue"
  - "Run issue pipeline"
  - "Full issue implementation"
metadata:
  author: "goodea"
  version: "3.0.0"
  category: "orchestration"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# Job Orchestrator

## Purpose

Dynamic orchestrator that builds execution plans based on user intent. Unlike a fixed pipeline, the orchestrator adapts its workflow to what the user actually needs — from "just analyze this issue" to "implement, review, and create a PR". It dispatches sub-agents (`issue-analyzer`, `context-collector`, `task-implementer`, review skills) and persists all work via `job-documenter`.

**Key design principle** (from Anthropic's "Building Effective Agents"):
> "The key difference from parallelization is its flexibility — subtasks aren't pre-defined, but determined by the orchestrator based on the specific input."

**Input:** User request (issue URL, analysis request, implementation request, etc.)
**Output:** Executed plan + persistent job documentation in `jobs/<job-name>/` + optional PR

## When to Use

- Implementing a complete GitHub issue from start to finish
- Analyzing an issue and proposing a solution before implementing
- Running any multi-step orchestrated workflow
- Running a comprehensive code review with persistent documentation
- When the AGENTS.md routing rule (Step 1.5) determines the user wants orchestrated execution and the user confirms
- User says "implement issue #N", "analyze issue #N", provides an issue URL, or asks for orchestrated work
- User says "full review", "полное ревью", or any request that implies orchestration

## Architecture: 4 Dynamic Phases

```
Phase 0: CONTEXT COLLECTION  →  Gather info, determine intent
Phase 1: PLAN BUILDING       →  Build dynamic plan, init job docs
Phase 2: EXECUTION           →  Execute plan steps, document each result
Phase 3: COMPLETION          →  Final report, optional PR, tell user where docs are
```

---

## Phase 0: CONTEXT COLLECTION

### 0.0 State Resumption Check

Before asking any questions, check if an interrupted job exists:
1. Look in `~/goodea/goodai-base/jobs/` for any directory containing an incomplete `state.json`.
2. If found, ASK the user: "Found paused job '<job-name>'. Do you want to resume it or start a new orchestrated job?"
3. If resume → Parse `state.json`, restore `JOB_STATE`, and jump directly to the first uncompleted step in Phase 2.
4. If new → Proceed to 0.1.

### 0.1 Determine User Intent

Parse the user's request to identify the intent:

| User Says | Intent | Plan Type |
|-----------|--------|-----------|
| "Implement issue #N" / "Issue to PR" | `implement` | Full: analyze → branch → implement → review → fix → checks → PR |
| "Analyze issue #N" / "Study issue" | `analyze` | Analysis only: analyze → report. Then ask if user wants to implement. |
| "Review my code" / "Review branch" | `review` | Review only: review → report |
| "Analyze and implement" | `implement` | Same as implement |
| Custom request | `custom` | Run `interviewer` skill first, then build plan from output |

**Ambiguity detection:** If the request uses vague words ("improve", "fix", "refactor") with no issue number or specific file — treat as `custom` regardless of other signals.

### 0.1.5 Interviewer Gate (for `custom` and ambiguous requests)

For `custom` intent OR any ambiguous request, invoke the `interviewer` skill **before** collecting standard context. This replaces the generic "What do you need?" question with a structured critical interview.

**Invoke:**
```
Load skill: skills/interviewer/SKILL.md

INPUT:
  topic: <user's original request>
  goal: "job-orchestrator — build execution plan"
  context:
    codebase_summary: <git log --oneline -10 if available>
    existing_analysis: <any issue content already known>
```

**Map output:**
- `derived_context` → `INTENT_STATE.task_description`
- answers with `confidence: "certain"` → `INTENT_STATE.constraints`
- `blockers` → surface to user (if non-empty, do NOT proceed)

**Gate rule:**
- `ready_to_proceed: false` → STOP. Tell user what blockers remain.
- `ready_to_proceed: true` → continue to 0.2 with enriched context.

**Skip** for `implement`/`analyze` with an issue number — requirements are in the issue.

### 0.2 Collect Required Context

The orchestrator MUST collect all required context before proceeding:

**Always ask (mandatory):**

1. **What to do** — for `implement`/`analyze`: from issue. For `custom`: from interviewer output (0.1.5).

2. **Project directory** — NEVER assume. Always ask explicitly:
   ```
   Which project directory should I use?
   ○ Type the full absolute path to your project
   (No default — always ask, never assume.)
   ```

3. **Base branch** — auto-detect from repo:
   ```bash
   # Detect default branch
   git -C <project_dir> symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'
   # Fallback: check for main, master, develop
   ```
   Present detected branch and ask to confirm. No hardcoded default.

**Intent-specific questions:**

| Intent | Additional Questions |
|--------|---------------------|
| `implement` | Create PR? (default: yes). Skip if user already stated. |
| `analyze` | None — always produced. After: ask if user wants to implement. |
| `review` | Which branch to review? (default: current branch) |
| `custom` | None — covered by interviewer in 0.1.5 |

4. **Job name** — auto-generate based on context, ask user to confirm:
   ```
   Job documentation folder:
   ○ issue-4141--pipeline-validation  (auto-generated, Recommended)
   ○ Type your own name
   ```
   
   **Naming patterns:**
   - Issue implementation: `issue-<N>--<slug>`
   - Issue analysis: `analysis--issue-<N>`
   - Code review: `review--<slug>`
   - Custom: `task--<slug>`

### 0.3 Interview for Implement Intent

For `implement` intent, dispatch `interview` skill after collecting context to clarify implementation-specific ambiguities (complements 0.1.5 which handles `custom` intent):

```
Dispatch interview skill with:
{
  "goal": <issue title>,
  "context": <collected context + issue body>,
  "domain": "implement",
  "caller": "job-orchestrator",
  "known_facts": [project_dir, base_branch, issue details],
  "max_questions": null
}
```

**When to run:** `implement` intent only (if `run_interview: true`, default).
**Skip for:** `analyze` (analysis reveals details), `review` (scoped by diff), `custom` (covered by 0.1.5).

**Output → Phase 1:** `INTERVIEW_RESULT` feeds into plan building — informs task decomposition and architecture.

**Skip if:** user says "just do it" / "skip questions", or `run_interview: false`.

### 0.4 Summarize and Confirm

Before proceeding, present a summary:

```
Ready to proceed:
  Intent:    implement
  Issue:     #4141 — Pipeline validation improvements
  Project:   /Users/.../<PROJECT>
  Base:      develop-2
  Create PR: yes
  Job name:  issue-4141--pipeline-validation

Proceed? (yes / adjust)
```

---

## Phase 1: PLAN BUILDING

### 1.1 Build Execution Plan

Based on intent, construct an ordered list of steps:

**For `implement` intent:**
```
PLAN:
  1. { id: "analyze",    type: "analyze",   agent: "issue-analyzer",      depends: [] }
  2. { id: "context",    type: "context",   agent: "context-collector",   depends: ["analyze"] }
  3. { id: "prepare",    type: "prepare",   agent: "orchestrator",        depends: ["context"] }
  4. { id: "implement",  type: "implement", agent: "task-implementer",    depends: ["prepare"] }
  5. { id: "review",     type: "review",    agent: "reviewers",           depends: ["implement"] }
  6. { id: "fix",        type: "fix",       agent: "task-implementer",    depends: ["review"], conditional: true }
  7. { id: "checks",     type: "check",     agent: "orchestrator",        depends: ["fix"] }
  8. { id: "report",     type: "report",    agent: "orchestrator",        depends: ["checks"] }
  9. { id: "pr",         type: "pr",        agent: "orchestrator",        depends: ["report"], conditional: true }
```

**For `analyze` intent:**
```
PLAN:
  1. { id: "analyze",   type: "analyze",  agent: "issue-analyzer",    depends: [] }
  2. { id: "context",   type: "context",  agent: "context-collector", depends: ["analyze"] }
  3. { id: "report",    type: "report",   agent: "orchestrator",      depends: ["context"] }
  4. { id: "proposal",  type: "proposal", agent: "orchestrator",      depends: ["report"] }
```
Step 4 (`proposal`) asks the user: "Want me to implement this? If yes, I'll extend the plan."

**For `review` intent:**
```
PLAN:
  1. { id: "context",  type: "context", agent: "context-collector", depends: [] }
  2. { id: "review",   type: "review",  agent: "reviewers",         depends: ["context"] }
  3. { id: "report",   type: "report",  agent: "orchestrator",      depends: ["review"] }
```

**For `custom` intent:**
Build plan dynamically. Each step must have: id, type, agent, dependencies.

### 1.2 Initialize Job Documentation

Dispatch `job-documenter` with `init` action:

```
Task({
  description: "Init job docs: <job-name>",
  subagent_type: "general",
  prompt: |
    You are the job-documenter agent.
    Load skill: skills/job-documenter/SKILL.md
    Follow rules: rules/core/jobs-documentation.mdc

    ACTION: init
    JOB_NAME: <job-name>
    JOBS_ROOT: ~/goodea/goodai-base/jobs

    DATA:
      TITLE: <job title>
      DESCRIPTION: <description>
      INTENT: <intent>
      SOURCE: <issue URL or description>
      PROJECT: <project path>
      BRANCH: TBD
      BASE_BRANCH: <base branch>
      PLAN: <plan steps>

    Execute and return DOCUMENTER_RESULT.
})
```

**Validate response:** status must be `success`. If `error` → report to user, ask how to proceed.

### 1.3 Display Plan

Show the plan to user with checkboxes:

```
Job Orchestrator — Plan:
- [ ] Analyze issue (issue-analyzer)
- [ ] Collect context (context-collector)
- [ ] Prepare feature branch
- [ ] Implement tasks (task-implementer)
- [ ] Review implementation (reviewers)
- [ ] Fix review findings (if needed)
- [ ] Final checks (lint, type-check, test)
- [ ] Generate report
- [ ] Propose draft PR
```

---

## Phase 2: EXECUTION

Execute each step in plan order, documenting results after each step.

### 2.1 General Execution Loop

```
FOR step in PLAN:
  IF step.conditional AND condition_not_met:
    SKIP step, mark as "skipped"
    CONTINUE

  2.1.1  Mark step as in-progress (update display)
  2.1.2  Execute step (see step-specific instructions below)
         **CRITICAL RESILIENCE**: If the sub-agent returns a malformed result or fails to follow formatting rules, run an explicit retry:
         "The previous output was malformed. Fix these errors: [errors] and try again." (Max 2 retries before counting as critical failure).
  2.1.3  Collect result
  2.1.4  Document result via job-documenter (add-document)
         (Also update job state `state.json`)
  2.1.5  Update job README via job-documenter (update-readme)
  2.1.6  Mark step as completed
  
  IF step failed critically:
    Ask user: "Step '<name>' failed. Continue with remaining steps or abort?"
    IF abort: skip to Phase 3 (COMPLETION) with status "aborted"
```

### 2.2 Step: ANALYZE

Dispatch `issue-analyzer` as a sub-agent.

**Prepare prompt:** Read `skills/issue-analyzer/orchestrator-prompt.md` (if it exists) and fill in:
- Issue URL or repo+number
- Codebase paths with roles
- Automation settings (skip_confirmation: true, search_depth: focused)

**Launch:**
```
Task({
  description: "Issue analysis: #<N>",
  subagent_type: "general",
  prompt: <constructed prompt>
})
```

**Parse result:** Extract JSON analysis object:
```
ANALYSIS_RESULT:
  issue_type:     from issue.type
  total_tasks:    from issue.total_tasks (= tasks.length)
  tasks: [{task_id, task_name, task_type, complexity, dependencies,
           description, target_files, acceptance_criteria, context,
           existing_tests, existing_stories, module_patterns}]
  dependency_order: from dependency_order array (already topologically sorted)
```

**Validate:** At least 1 task, no circular dependencies, all dependency references valid. Dependency_order array must contain all task_ids exactly once.

**Document:** Send to job-documenter:
```
ACTION: add-document
DATA:
  DOC_TYPE: analysis
  TARGET: both
  TITLE: Issue Analysis — #<N>
  CONTENT: <human-readable summary for man/, raw JSON for ai/>
  AGENT: issue-analyzer
  TASK: Analyze issue #<N>
```

**For `analyze` intent:** After documenting, present analysis to user. Ask:
```
Analysis complete. Found <N> tasks.
Want me to implement this? I'll create a feature branch and run the full pipeline.
○ Yes, implement
○ No, analysis is enough
```
If "Yes" → extend PLAN with context → prepare → implement → review → fix → checks → pr steps. Continue execution.
If "No" → skip to Phase 3 (COMPLETION).

### 2.3 Step: CONTEXT

Dispatch `context-collector` to build the unified context document.

**Prepare prompt:** Use the template from `skills/context-collector/SKILL.md`:

```
Task({
  description: "Collect context: <job-name>",
  subagent_type: "general",
  prompt: |
    You are the context-collector agent. Your task is to research and build
    a context document for the current job.

    Load the skill from: skills/context-collector/SKILL.md

    ACTION: collect
    JOB_NAME: <job-name>
    JOBS_ROOT: ~/goodea/goodai-base/jobs
    PROJECT_DIR: <project_dir>

    DATA:
      TASK_DESCRIPTION: <from issue or user request>
      FOCUS_AREAS: <derived from analysis — affected areas, libraries>
      ANALYSIS_RESULT: <output from issue-analyzer, if available>
      KNOWN_LIBRARIES: <from package.json scan during analysis>

    Execute all phases and return a CONTEXT_RESULT block.
})
```

**Parse result:**
```
CONTEXT_RESULT:
  status:    success | error
  version:   <document version>
  summary:   <what context was collected>
```

**Validate:** status must be `success`. If `error` → log warning, continue (context is helpful but not blocking).

**After context is collected:** All subsequent sub-agents receive the **versioned** context path from state.json:
```
CONTEXT_LOCATION: ~/goodea/goodai-base/jobs/<job-name>/ai/context_v<N>.md
```

**Context versioning:** Never overwrite `context.md` — save snapshots as `context_v1.md`, `context_v2.md`, etc.
- Version 1 is created during Step 2.3 (first collect)
- Subsequent versions increment on each update
- `state.json → context_doc.version` always points to the latest version
- Sub-agents always read the path from `state.json`, not a hardcoded filename

**Triggering context updates during execution:**

If during later steps (implement, review) a sub-agent reports missing context or a new library is discovered:

```
Task({
  description: "Update context: <job-name>",
  subagent_type: "general",
  prompt: |
    You are the context-collector agent. Update the existing context.

    Load the skill from: skills/context-collector/SKILL.md

    ACTION: update
    JOB_NAME: <job-name>
    JOBS_ROOT: ~/goodea/goodai-base/jobs
    PROJECT_DIR: <project_dir>
    CONTEXT_VERSION: <current version + 1>  ← write to context_v<N+1>.md

    DATA:
      TASK_DESCRIPTION: <original task description>
      UPDATE_REASON: <why context needs updating>
      FOCUS_AREAS: <new areas to research>

    Execute update flow and return a CONTEXT_RESULT block.
})
```

### 2.4 Step: PREPARE

Create git worktree for feature branch.

> **CRITICAL**: Feature branches MUST be created via `git worktree add`.
> **NEVER** use `git checkout -b` or `git switch -c` — this switches the main working directory.
> The worktree is a **sibling directory** to the project directory.

**Determine branch name:**
```
Format: feature/<custom-slug>
Slug: descriptive, lowercase, alphanumeric+hyphens, from issue title/feature
Examples: feature/pipeline-validation, feature/mirror-step-source-column
```

**Create worktree:**
```bash
# Fetch latest base branch
git -C <project_dir> fetch origin <base_branch>

# Create worktree as SIBLING directory
git -C <project_dir> worktree add ../<branch-slug> -b feature/<branch-slug> origin/<base_branch>

# Example:
# Project dir: /Users/user/Presight/Vantage/<PROJECT>
# git -C ... worktree add ../pipeline-validation -b feature/pipeline-validation origin/develop-2
# Result worktree: /Users/user/Presight/Vantage/pipeline-validation
# Result branch:   feature/pipeline-validation

# Auto-detect package manager and install dependencies
if [ -f <worktree_path>/bun.lockb ]; then
  PM="bun"; RUNNER="bun run"; bun install --cwd <worktree_path>
elif [ -f <worktree_path>/pnpm-lock.yaml ]; then
  PM="pnpm"; RUNNER="pnpm run"; pnpm install --prefix <worktree_path>
elif [ -f <worktree_path>/yarn.lock ]; then
  PM="yarn"; RUNNER="yarn"; yarn --cwd <worktree_path>
elif [ -f <worktree_path>/package-lock.json ]; then
  PM="npm"; RUNNER="npm run"; npm install --prefix <worktree_path>
elif [ -f <worktree_path>/requirements.txt ]; then
  PM="python"; RUNNER=""; pip install -r <worktree_path>/requirements.txt
elif [ -f <worktree_path>/go.mod ]; then
  PM="go"; RUNNER=""; (cd <worktree_path> && go mod download)
fi
```

> **IMPORTANT**: After creating the worktree, ALL subsequent operations (implementation, review, lint, test, git) MUST run in the **worktree directory**, NOT in the original project directory.

**Record state:**
```
BRANCH_STATE:
  name: feature/<branch-slug>
  base: <base_branch>
  worktree_path: <absolute path to worktree>
  project_dir: <original project directory — DO NOT modify>
  created_from_commit: <commit hash>
  package_manager: <PM>
  run_command: <RUNNER>
```

> **Store `package_manager` and `run_command` in JOB_STATE** — all subsequent steps use these instead of hardcoded `npm`.

**Document:** Update README via job-documenter (update-readme) with branch info.

### 2.5 Step: IMPLEMENT

Dispatch `task-implementer` for tasks. **Parallelize independent tasks** where possible.

**Dependency-aware execution strategy:**

```
# Build dependency graph from analysis
# Group tasks into execution waves — tasks in the same wave have no dependencies on each other

WAVES = topological_sort_into_waves(dependency_order, task_dependencies)

# Example:
# Wave 1: [task-1, task-2]    ← no dependencies, run in PARALLEL
# Wave 2: [task-3]            ← depends on task-1, run after wave 1
# Wave 3: [task-4, task-5]    ← depend on task-3, run in PARALLEL

FOR wave in WAVES:
  IF wave has 1 task:
    # Sequential — single task
    Launch task-implementer for the task
  ELSE:
    # PARALLEL — launch all tasks in this wave simultaneously
    # IMPORTANT: parallel tasks must modify DIFFERENT files to avoid git conflicts
    # If file overlap detected → fall back to sequential within this wave
    Launch all task-implementers in a single turn
    Wait for all to complete

  FOR task in wave:
    Parse JSON result:
      - status: success | partial | failed
      - files_modified, files_created, files_deleted: arrays of paths
      - commits: array of commit hashes
      - lint_result, type_check_result, test_result, story_result: strings
      - acceptance_criteria_met: "all" | "partial: <list>" | "none"
      - notes: string
    
    Record: TASK_RESULTS[task_id] = result
    
    Decision:
      - success → continue
      - partial → log warnings, continue
      - failed → STOP implementation, ask user
```

**Parallel safety check:** Before launching parallel tasks, verify no two tasks in the same wave share target_files. If overlap exists, split into sub-waves or run sequentially.

**Each task-implementer receives only:**
- Its specific task object (NOT other tasks)
- `CONTEXT_PATH` for the job context document
- `worktree_path` as workspace
- `package_manager` and `run_command` from JOB_STATE

**After all tasks, document:**
```
ACTION: add-document
DATA:
  DOC_TYPE: implementation-report
  TARGET: both
  TITLE: Implementation Report
  CONTENT: <summary of all tasks, files changed, commits>
  AGENT: task-implementer
  TASK: Implementation phase
```

### 2.5.5 Step: IMPLEMENT SANITY CHECK

Lightweight verification after `task-implementer` completes, **before** launching review.
This catches the common LLM failure where a sub-agent claims success but made no actual changes.

```bash
# Run in worktree directory
git diff --stat <merge_base>..HEAD
git log <merge_base>..HEAD --oneline
```

**Gate conditions:**

| Check | Pass | Fail action |
|-------|------|-------------|
| At least 1 commit exists | ≥1 commit | `retryable` — re-dispatch task-implementer with: "No commits were made. Implement the changes and commit them." |
| At least 1 file modified | ≥1 file changed | Same as above |
| Claimed files actually modified | All `files_modified` in diff | Log discrepancy as WARNING, continue |

**If retry also produces no commits** → classify as `terminal`, ABORT with:
```
"task-implementer returned success twice but made no git changes.
Please implement manually and re-run from the review step."
```

**Record:**
```
SANITY_CHECK:
  commits: <count>
  files_changed: <count>
  lines_added: <N>
  lines_removed: <N>
  verified: true | false
```

---

### 2.6 Step: REVIEW

Dispatch review skills on the whole branch. **Launch all reviewers in parallel** for speed.

**Primary approach — use `code-review` (4-agent parallel):**

If the `code-review` skill is available, prefer it as the primary reviewer. It dispatches 4 agents in parallel (correctness, security, performance, style) and produces a unified severity report.

```
Launch code-review skill with:
  scope: git diff <merge_base>..HEAD
  output: unified report with CRITICAL/HIGH/MEDIUM/LOW findings
```

**Fallback — individual reviewers (if code-review unavailable or user prefers):**

Determine and **dispatch all reviewers simultaneously** (not sequentially):

| Reviewer | Condition | Launch |
|----------|-----------|--------|
| `code-ai-review` | Always | Parallel |
| `code-b091-review` | Always | Parallel |
| `code-style-review` | Always | Parallel |
| `code-mobx-store-review` | Only if `*.store.ts` modified | Parallel |

```
# Launch ALL applicable reviewers in a SINGLE turn (parallel):
Agent 1: code-ai-review (correctness, security)
Agent 2: code-b091-review (architecture, logic)
Agent 3: code-style-review (naming, patterns)
Agent 4: code-mobx-store-review (if applicable)

# Wait for all to complete, then merge results
```

**Collect and merge findings:**
```
REVIEW_FINDINGS: [{
  reviewer: "<skill-name>",
  findings: [{ file, line, severity: CRITICAL|WARNING|INFO, message }]
}]
```

**Deduplicate:** If multiple reviewers flag the same file:line, merge into a single finding with the highest severity.

**Classify:**
```
NEEDS_FIX = count(CRITICAL) > 0 OR count(WARNING) > 0
```

**Document:**
```
ACTION: add-document
DATA:
  DOC_TYPE: review
  TARGET: both
  TITLE: Code Review Results
  CONTENT: <findings summary for man/, structured findings for ai/>
```

### 2.7 Step: FIX (conditional)

Only runs if NEEDS_FIX is true. Default max: **3 iterations** (`max_review_iterations`).

```
UNRESOLVED_FINDINGS = all CRITICAL + WARNING findings from step 2.6

FOR iteration in [1, 2, 3]:
  IF NOT NEEDS_FIX: BREAK

  1. Group UNRESOLVED_FINDINGS by file
  2. Construct fix prompt — MUST include unresolved findings from previous attempt:

     task_type: "fix"
     findings: <UNRESOLVED_FINDINGS>
     iteration: <N>
     previously_unresolved: <findings that were in UNRESOLVED_FINDINGS last iteration but still present>
         → Prefix: "These specific findings were NOT fixed in iteration <N-1>: [list]"

  3. Launch task-implementer with fix prompt
  4. Run sanity-check (step 2.5.5 logic) — verify commits were made
  5. Re-run reviewers (step 2.6) — parallel dispatch
  6. Recompute NEEDS_FIX from new findings
  7. Update UNRESOLVED_FINDINGS = remaining CRITICAL + WARNING

IF still NEEDS_FIX after max iterations:
  Log "Unresolved after <N> iterations" with finding list → continue to checks
```

**Fix prompt escalation pattern:**
- Iteration 1: "Fix these findings: [list]"
- Iteration 2: "These findings were NOT fixed in iteration 1: [subset]. Fix them now."
- Iteration 3: "FINAL attempt. These findings remain after 2 fix passes: [subset]. This is the last fix iteration." 

### 2.8 Step: CHECKS

Run full project verification in the worktree.

**First, detect the project stack and package manager:**

```bash
# Auto-detect package manager (run once during PREPARE, cache result)
if [ -f bun.lockb ]; then PM="bun"; RUNNER="bun run"
elif [ -f pnpm-lock.yaml ]; then PM="pnpm"; RUNNER="pnpm run"
elif [ -f yarn.lock ]; then PM="yarn"; RUNNER="yarn"
elif [ -f package-lock.json ]; then PM="npm"; RUNNER="npm run"
elif [ -f requirements.txt ] || [ -f pyproject.toml ]; then PM="python"; RUNNER=""
elif [ -f go.mod ]; then PM="go"; RUNNER=""
else PM="unknown"; RUNNER=""
fi
```

**Run checks based on detected stack:**

| Stack | Lint | Type-check | Test |
|-------|------|------------|------|
| Node (npm/bun/yarn/pnpm) | `$RUNNER lint` | `$RUNNER type-check` or `npx tsc --noEmit` | `$RUNNER test` |
| Python | `ruff check .` or `flake8` | `mypy .` or `pyright` | `pytest` |
| Go | `golangci-lint run` | (built into compiler) | `go test ./...` |

If a check command is not available (no lint script, etc.), skip it with a note.

```
FINAL_CHECKS:
  package_manager: <detected PM>
  lint: pass | <N errors, details> | skipped (no lint script)
  type_check: pass | <N errors, details> | skipped
  tests: pass | <N passed, M failed, details> | skipped (no test script)
```

> **Store `PM` and `RUNNER` in JOB_STATE** during the PREPARE step so all subsequent steps use the correct commands.

### 2.9 Step: REPORT

Aggregate all information into a human-readable summary.

**Report structure:**
```markdown
# Job Report: <Title>

## Summary
- **Intent:** <implement / analyze / review>
- **Source:** <issue URL or description>
- **Branch:** `<branch_name>`
- **Tasks:** <completed>/<total> completed
- **Review Iterations:** <N>
- **Final Status:** <READY FOR PR | HAS WARNINGS | HAS ISSUES | ANALYSIS ONLY>

## Analysis
<analysis summary>

## Tasks
### task-1: <Name>
- **Status:** success
- **Files:** <list>
- **Commits:** <hashes>

## Review Results
### code-ai-review
- CRITICAL: <N>, WARNING: <N>, INFO: <N>
### code-b091-review
- ...

## Unresolved Issues
- [ ] <file>:<line> — <message> (from <reviewer>)

## Final Checks
- Lint: PASS
- Type Check: PASS
- Tests: 42 passed, 0 failed

## Changes Summary
### Files Modified (<N>)
- `src/...`

### Files Created (<N>)
- `src/...`

### Commits (<N>)
- `abc1234` feat(pipelines): add validation
```

### 2.10 Step: PR (conditional)

Only runs if `create_pr` is true and intent is `implement`.

**Dispatch `pr-issue-documenter` to generate the PR description:**

Pass the following context to `pr-issue-documenter`:
```
ACTION: generate-pr-description
JOB_NAME: <job-name>
BRANCH: <feature_branch>
BASE: <base_branch>
ISSUE_NUMBER: <issue_number if available>
CONTEXT_PATH: ~/goodea/goodai-base/jobs/<job-name>/ai/context.md
```

`pr-issue-documenter` will analyze the branch diff and produce a structured PR description (Summary + Changes by area + Key Files table). Use its output as the `body` for the PR.

**Present to user:**
```
Implementation complete. Draft PR proposal:

Title: <type>(#<issue>): <description>
Base: <base> ← <head>

<pr-issue-documenter output>

Create this draft PR? (yes/no)
```

**If confirmed:**
```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)" --base <base_branch> --head <feature_branch> --draft
```

---

## Phase 3: COMPLETION

### 3.1 Finalize Job Documentation

Dispatch job-documenter with `finalize` action:

```
ACTION: finalize
DATA:
  FINAL_CONTENT: <full report markdown>
  FINAL_STATUS: completed | aborted
  SUMMARY: <1-3 sentence summary>
```

**Validate response:** status must be `success`.

### 3.2 Present Results

Tell user:
1. What was accomplished (summary)
2. Where documentation is stored: `jobs/<job-name>/`
3. PR URL (if created)
4. Any unresolved issues

```
Job completed successfully.

  Documentation: ~/goodea/goodai-base/jobs/<job-name>/
  Branch:        feature/<slug> (worktree: <path>)
  PR:            <URL or "not created">
  
  See jobs/<job-name>/README.md for the full job index.
```

---

## Plan Extension (Dynamic Planning)

When the orchestrator starts with an `analyze` intent and the user then says "yes, implement":

1. **Keep existing completed steps** (analyze, context, report are already done)
2. **Extend plan** with new steps: prepare → implement → review → fix → checks → report → pr
3. **Update job documentation** via job-documenter (update-readme with new plan)
4. **Continue execution** from the first new step

This is the core of dynamic planning — the plan grows based on user decisions.

---

## State Management

The orchestrator maintains state throughout all phases:

```
JOB_STATE:
  phase: CONTEXT | PLAN | EXECUTION | COMPLETION
  intent: implement | analyze | review | custom
  create_pr: <bool>
  job_name: <string>
  
  context:
    issue: { number, title, url, type }
    project_dir: <path>
    base_branch: <string>
  
  branch:
    name: <string>
    worktree_path: <path>
    merge_base: <commit hash>
  
  plan:
    steps: [{ id, type, agent, depends, status: pending|in_progress|completed|skipped|failed }]
    current_step: <step_id>
  
  analysis:
    total_tasks: <N>
    tasks: [<task objects>]
    dependency_order: [<task_ids>]
  
  context_doc:
    path: ~/goodea/goodai-base/jobs/<job-name>/ai/context.md
    version: <current version>
    status: collected | updated | not-collected
  
  implementation:
    task_results: {<task_id>: <result>}
    all_commits: [<hash>]
    all_files: [<path>]
  
  review:
    iteration: <N>
    findings: [<findings>]
    needs_fix: <bool>
    unresolved: [<findings>]
  
  final_checks:
    lint: <result>
    type_check: <result>
    tests: <result>
  
  documentation:
    job_path: ~/goodea/goodai-base/jobs/<job-name>
    documents_created: [<paths>]
```

---

## state.json Specification

The orchestrator persists JOB_STATE to `jobs/<job-name>/state.json` for job resumption.

**Location:** `jobs/<JOB_NAME>/state.json`

**Schema reference:** `skills/job-orchestrator/state.schema.json`

**When to create:** During Phase 1.2 (Initialize Job Documentation) — write initial state after job docs are initialized.

**When to update:** After every step completion in Phase 2 (EXECUTION) — update `plan.steps[i].status`, `plan.steps[i].prompt` (store the prompt used), and `plan.current_step`.

**How to write state.json:**
```bash
# Write state (orchestrator handles this directly, not via job-documenter)
cat > jobs/<JOB_NAME>/state.json << 'EOF'
{
  "phase": "EXECUTION",
  "intent": "<intent>",
  "job_name": "<job-name>",
  ...
}
EOF
```

**Job resumption (Phase 0.0):** If `state.json` exists and `phase` is not `COMPLETION`, offer to resume. Parse the file, restore JOB_STATE, jump to the first step with `status: "pending"` or `status: "in_progress"`.

---

## Automation Settings

| Setting | Default | Options | Description |
|---------|---------|---------|-------------|
| `skip_confirmation` | `true` | true/false | Skip confirmation for sub-agents |
| `base_branch` | auto-detect | any | Base branch (auto-detect from repo default, or ask user) |
| `max_review_iterations` | `3` | 1-5 | Max review → fix iterations |
| `create_pr` | `true` | true/false | Whether to propose PR at the end |
| `auto_create_pr` | `false` | true/false | Auto-create PR without asking |
| `review_mode` | `"code-review"` | `"code-review"` / `"individual"` | Use 4-agent parallel or individual reviewers |
| `reviewers` | `["code-ai-review", "code-b091-review", "code-style-review"]` | skill names | Individual reviewers (when review_mode=individual) |
| `conditional_reviewers` | `{"code-mobx-store-review": "*.store.ts"}` | skill→pattern | Conditional reviewers |
| `run_final_checks` | `true` | true/false | Run lint/type-check/test |
| `run_interview` | `true` | true/false | Run interview skill in Phase 0 |

## Budget Guards & Timeouts

The orchestrator enforces resource limits to prevent runaway sub-agents:

| Guard | Default | Description |
|-------|---------|-------------|
| `step_timeout_ms` | `300000` (5 min) | Max time per step. Kill agent if exceeded. |
| `implementation_timeout_ms` | `600000` (10 min) | Max time for full implementation phase |
| `total_job_timeout_ms` | `1800000` (30 min) | Max time for entire job. Abort to Phase 3 if exceeded. |
| `max_retries_per_step` | `2` | Max retries for a failed step before asking user |

**Timeout behavior:**
- When a step times out → mark as `failed`, record partial results if any
- Ask user: "Step X timed out after Y minutes. Retry / Skip / Abort?"
- If total job timeout → force transition to Phase 3 (COMPLETION) with status "timeout"

**Context passing rules (minimal context principle):**
- `issue-analyzer`: receives only issue data + codebase paths (NOT previous job state)
- `context-collector`: receives focus areas + analysis summary (NOT full analysis JSON)
- `task-implementer`: receives only its specific task object + context.md path (NOT other tasks' results)
- Reviewers: receive only the diff range + file list (NOT implementation details)

---

## Error Handling

Each step failure is classified into one of three classes with different recovery paths:

| Class | Meaning | Action |
|-------|---------|--------|
| `terminal` | Unrecoverable — cannot continue | ABORT immediately, surface actionable message |
| `retryable` | Transient failure (bad output, timeout) | Auto-retry up to 2× with **identical prompt**. After 2 failures → escalate to `recoverable` |
| `recoverable` | Partial success or skippable failure | Ask user with specific "continue from here / skip step / abort" options |

### Error Table

| Error | Class | Action |
|-------|-------|--------|
| Issue not found (404) | `terminal` | ABORT — issue-analyzer reports 404 |
| Analysis returns 0 tasks | `recoverable` | Try smart fallback: (1) re-read issue with broader scope, (2) ask user to clarify, (3) if still 0 → ABORT |
| Branch/worktree creation fails | `terminal` | ABORT — report git error. NEVER fall back to `git checkout -b` |
| Interviewer `ready_to_proceed: false` | `terminal` | STOP — tell user which blockers remain |
| Sub-agent returns malformed JSON | `retryable` | Retry with: "Output was malformed. Fix: [errors]. Try again." (max 2×) |
| Sub-agent timeout | `retryable` | Retry with identical prompt (max 2×) |
| Task implementation fails | `recoverable` | Ask: "Step failed. Continue remaining tasks / skip this task / abort?" |
| Job-documenter returns error | `recoverable` | Log warning, continue (documentation is non-blocking) |
| All reviewers fail | `recoverable` | Skip review, add warning to report, continue to checks |
| Fix loop exceeds max_review_iterations | `recoverable` | Log unresolved findings, continue to checks |
| Final checks fail | `recoverable` | Include in report, still propose PR (user decides) |
| gh CLI not available | `recoverable` | Print PR data, user creates manually |

### Retry Protocol (for `retryable` errors)

```
attempt 1: run step normally
→ failure: classify error
→ if retryable: retry with EXACT same prompt + "Fix these errors: [list]"
→ if fails again: escalate to recoverable → ask user
→ if success: continue
```

**Critical:** On retry, use the **same prompt** stored in `state.json → step.prompt`. Never re-derive it — re-derivation causes drift.

---

## Progress Notifications

The orchestrator must keep the user informed during long-running execution. This is especially important for non-interactive channels (Telegram, Slack, CI).

**At each phase transition:**
```
🔄 Phase 0 → Phase 1: Building execution plan...
🔄 Phase 1 → Phase 2: Executing 7 steps...
✅ Phase 2 → Phase 3: Execution complete, generating report...
```

**At each step transition (Phase 2):**
```
📋 Job: issue-4141--pipeline-validation
├─ ✅ Analyze issue — 3 tasks found
├─ ✅ Collect context — context.md ready
├─ ✅ Prepare branch — feature/pipeline-validation
├─ 🔄 Implement (2/3 tasks done)
│  ├─ ✅ task-1: Add validation schema
│  ├─ ✅ task-2: Implement validator
│  └─ 🔄 task-3: Add integration tests...
├─ ⏳ Review
├─ ⏳ Fix (if needed)
├─ ⏳ Final checks
└─ ⏳ PR
```

**Minimum notification interval:** Every 30 seconds during long steps (implementation, review). This prevents the user from thinking the process is stuck.

**If notification tools are unavailable** (no MCP, no Telegram): fall back to inline text output between steps.

---

## Rules of Engagement

1. **DO** ALWAYS collect context in Phase 0 — project directory is MANDATORY, never assume.
2. **DO** build plans dynamically based on intent — not a fixed 8-phase pipeline.
3. **DO** initialize job documentation before executing any step.
4. **DO** document every step result via job-documenter.
5. **DO** parallelize independent tasks and reviewers where safe.
6. **DO** respect dependency order — use wave-based execution for implementation.
7. **DO** limit review → fix loop to max_review_iterations.
8. **DO** present PR proposal to user before creating (unless auto_create_pr).
9. **DO** tell user where documentation is stored at completion.
10. **DO** ALWAYS use `git worktree add` for feature branches — NEVER `git checkout -b`.
11. **DO** run ALL commands in the **worktree directory**, never in the original project.
12. **DO** ask user for confirmation before extending plan (e.g., analyze → implement).
13. **DO** send progress notifications at phase/step transitions and every 30s during long steps.
14. **DO** use auto-detected `package_manager` and `run_command` — never hardcode `npm`.
15. **DO NOT** ask the user anything during execution (after Phase 0) — except for critical failures and plan extension decisions.
16. **DO NOT** push the branch until user confirms (or auto_create_pr).
15. **DO NOT** skip job documentation — it's a core feature, not optional.
16. **DO NOT** create job documentation for sub-agent results directly — orchestrator formats and sends to documenter.
17. **DO** store the prompt used for each sub-agent step in `state.json → step.prompt` before dispatching — required for retry and resume.
18. **DO** classify every step failure as `terminal`, `retryable`, or `recoverable` — never just abort or ask without classifying first.
