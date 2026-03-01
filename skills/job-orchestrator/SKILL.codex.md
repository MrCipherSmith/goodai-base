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
  version: "2.0.0"
  category: "orchestration"
license: "MIT"
compatibility: "cursor,codex,zed,opencode"
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
| Custom request | `custom` | Build plan dynamically based on description |

### 0.2 Collect Required Context

The orchestrator MUST collect all required context before proceeding. Use a structured question flow:

**Always ask (mandatory):**

1. **What to do** — if not obvious from the request. For `implement` and `analyze` intents, this is derived from the issue.

2. **Project directory** — NEVER assume. Read "Projects links" from AGENTS.md and offer as options:
   ```
   Which project directory to use?
   ○ FRONTEND — /Users/.../<PROJECT>  (Recommended)
   ○ BACKEND — /Users/.../<PROJECT>
   ○ Type your own path
   ```

3. **Base branch** — default from "Projects links" for selected project (e.g. `develop-2`). Ask to confirm.

**Intent-specific questions:**

| Intent | Additional Questions |
|--------|---------------------|
| `implement` | Create PR? (default: yes). If user already said "no PR", skip. |
| `analyze` | None — analysis is always produced. After analysis, ask if user wants to implement. |
| `review` | Which branch to review? (default: current branch) |
| `custom` | What specific outcome do you need? |

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

### 0.3 Summarize and Confirm

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

**Parse result:** Extract Gherkin Feature:
```
ANALYSIS_RESULT:
  issue_type:    from Background table
  total_tasks:   count of Scenarios
  tasks: [{task_id, task_name, task_type, complexity, dependencies,
           description, target_files, acceptance_criteria, context,
           existing_tests, existing_stories, module_patterns}]
  dependency_order: topological sort by dependencies
```

**Validate:** At least 1 task, no circular dependencies, all dependency references valid.

**Document:** Send to job-documenter:
```
ACTION: add-document
DATA:
  DOC_TYPE: analysis
  TARGET: both
  TITLE: Issue Analysis — #<N>
  CONTENT: <human-readable summary for man/, raw Gherkin for ai/>
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

**After context is collected:** All subsequent sub-agents (task-implementer, reviewers) should be informed about the context document location:
```
CONTEXT_LOCATION: ~/goodea/goodai-base/jobs/<job-name>/ai/context.md
```

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

# Install dependencies if needed
npm install --prefix <worktree_path>
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
```

**Document:** Update README via job-documenter (update-readme) with branch info.

### 2.5 Step: IMPLEMENT

Dispatch `task-implementer` for each task in dependency order (sequential).

```
FOR task in dependency_order:
  IF task.dependencies are all completed:
    
    1. Construct task-implementer prompt
       (use template from skills/task-implementer/orchestrator-prompt.md)
       IMPORTANT: Include the job context location in the prompt:
         JOB_NAME: <job-name>
         CONTEXT_PATH: ~/goodea/goodai-base/jobs/<job-name>/ai/context.md
    
    2. Launch:
       Task({
         description: "Implement <task_id>: <task_name>",
         subagent_type: "general",
         prompt: <prompt with workspace set to worktree_path>
       })
    
    3. Parse result:
       - status: success | partial | failed
       - files_modified, files_created, commits
       - lint_result, type_check_result, test_result
       - acceptance_criteria_met, notes
    
    4. Record: TASK_RESULTS[task_id] = result
    
    5. Decision:
       - success → continue
       - partial → log warnings, continue
       - failed → STOP implementation, ask user

  ELSE:
    ABORT("Dependency not met")
```

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

### 2.6 Step: REVIEW

Dispatch review skills on the whole branch.

**Determine reviewers:**

| Reviewer | Condition |
|----------|-----------|
| `code-ai-review` | Always |
| `code-b091-review` | Always |
| `code-style-review` | Always |
| `code-mobx-store-review` | Only if `*.store.ts` files were modified |

Check: `git diff --name-only <merge_base>..HEAD | grep '\.store\.ts$'`

**Execute each reviewer** via skill loading mechanism. Collect findings:
```
REVIEW_FINDINGS: [{
  reviewer: "<skill-name>",
  findings: [{ file, line, severity: CRITICAL|WARNING|INFO, message }]
}]
```

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

Only runs if NEEDS_FIX is true. Maximum 2 iterations.

```
FOR iteration in [1, 2]:
  IF NOT NEEDS_FIX: BREAK
  
  1. Group findings by file
  2. Construct fix prompt (task-implementer with task_type: "fix")
  3. Launch task-implementer
  4. Parse fix result
  5. Re-run reviewers (step 2.5)
  6. Recompute NEEDS_FIX

IF still NEEDS_FIX after 2 iterations:
  Log "Unresolved review issues" → continue to checks
```

### 2.8 Step: CHECKS

Run full project verification in the worktree.

```bash
npm run lint        # if fails → try npm run lint:fix:changed, re-run
npm run type-check  # log result
npm test            # log result
```

Record:
```
FINAL_CHECKS:
  lint: pass | <N errors, details>
  type_check: pass | <N errors, details>
  tests: pass | <N passed, M failed, details>
```

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

**Construct PR data:**
```
PR_DATA:
  title: "<type>(#<issue>): <description>"
  base: <base_branch>
  head: <feature_branch>
  draft: true
  body: <constructed from report>
```

**Present to user:**
```
Implementation complete. Draft PR proposal:

Title: <title>
Base: <base> ← <head>

<PR body>

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

## Automation Settings

| Setting | Default | Options | Description |
|---------|---------|---------|-------------|
| `skip_confirmation` | `true` | true/false | Skip confirmation for sub-agents |
| `base_branch` | `develop-2` | any | Base branch for feature branch |
| `max_review_iterations` | `2` | 1-3 | Max review → fix iterations |
| `create_pr` | `true` | true/false | Whether to propose PR at the end |
| `auto_create_pr` | `false` | true/false | Auto-create PR without asking |
| `reviewers` | `["code-ai-review", "code-b091-review", "code-style-review"]` | skill names | Mandatory reviewers |
| `conditional_reviewers` | `{"code-mobx-store-review": "*.store.ts"}` | skill→pattern | Conditional reviewers |
| `run_final_checks` | `true` | true/false | Run lint/type-check/test |

---

## Error Handling

| Error | Action |
|-------|--------|
| Issue not found | ABORT — issue-analyzer will report 404 |
| Analysis returns 0 tasks | ABORT — "Issue could not be decomposed" |
| Branch/worktree creation fails | ABORT — report git error. NEVER fall back to `git checkout -b` |
| Task implementation fails | STOP implementation, ask user whether to continue or abort |
| Job-documenter returns error | Log warning, continue execution (documentation is non-blocking) |
| All reviewers fail | Skip review, add warning to report |
| Fix iteration produces new CRITICAL | Count toward max iterations |
| Final checks fail | Include in report, still propose PR (user decides) |
| gh CLI not available | Show PR data, user creates manually |

---

## Rules of Engagement

1. **DO** ALWAYS collect context in Phase 0 — project directory is MANDATORY, never assume.
2. **DO** build plans dynamically based on intent — not a fixed 8-phase pipeline.
3. **DO** initialize job documentation before executing any step.
4. **DO** document every step result via job-documenter.
5. **DO** dispatch sub-agents sequentially to avoid git conflicts.
6. **DO** respect dependency order when implementing tasks.
7. **DO** limit review → fix loop to max_review_iterations.
8. **DO** present PR proposal to user before creating (unless auto_create_pr).
9. **DO** tell user where documentation is stored at completion.
10. **DO** ALWAYS use `git worktree add` for feature branches — NEVER `git checkout -b`.
11. **DO** run ALL commands in the **worktree directory**, never in the original project.
12. **DO** ask user for confirmation before extending plan (e.g., analyze → implement).
13. **DO NOT** ask the user anything during execution (after Phase 0) — except for critical failures and plan extension decisions.
14. **DO NOT** push the branch until user confirms (or auto_create_pr).
15. **DO NOT** skip job documentation — it's a core feature, not optional.
16. **DO NOT** create job documentation for sub-agent results directly — orchestrator formats and sends to documenter.
