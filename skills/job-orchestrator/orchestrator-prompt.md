# Job Orchestrator — Quick Reference Checklist

> **Purpose:** Condensed execution checklist for the orchestrator agent.
> This file is a quick reference — the full specification is in `SKILL.md`.
> The orchestrator is NOT a sub-agent; it IS the primary agent executing this checklist.
> When in doubt, refer to `SKILL.md` for complete details.

## Data Flow

```
[User] → "implement issue #4141" / "analyze issue" / other request
     ↓
[Orchestrator] → loads SKILL.md, follows this checklist
     ↓
Phase 0: Context collection, intent determination, plan building
     ↓
Phase 1: [job-documenter sub-agent] → initialize jobs/<job-name>/ + README + plan
     ↓
Phase 2: Execute plan dynamically:
     ↓
     ├─ [issue-analyzer sub-agent] → JSON analysis result
     ├─ git worktree add → feature branch (NEVER git checkout -b)
     ├─ FOR EACH task in dependency_order → [task-implementer sub-agent] → JSON result
     ├─ Load review skills → findings
     ├─ IF findings → [task-implementer sub-agent (fix)] → re-review (max 2x)
     ├─ npm run lint && type-check && test
     └─ [job-documenter] → document each step result
     ↓
Phase 3: [job-documenter] → finalize → final report
     ↓
(Optional) gh pr create --draft
```

## Phase 0: Context Collection (Guard Clause)

Before starting, determine intent and collect context:

1. **Determine intent** from user request:
   - "Implement issue" → `implement` (full cycle)
   - "Analyze issue" / "Study issue" → `analyze` (analysis first, then offer implementation)
   - "Review" → `review` (review only)
   - Other → `custom` (dynamic plan)

2. **Project directory** → ALWAYS ask, never assume:
   ```
   Which project directory should I use?
   ○ Type the full absolute path to your project
   ```

3. **Base branch** → ask to confirm (no default).

4. **Job name** → auto-generate + confirm:
   - `issue-<N>--<slug>` for implement
   - `analysis--issue-<N>` for analyze
   - `review--<slug>` for review
   - `task--<slug>` for custom

5. **Additional questions** by intent:
   - `implement`: Create PR? (default: yes)
   - `analyze`: nothing (ask about implementation after analysis)

6. **Show summary and ask for confirmation** before starting.

## Phase 1: Initialize Documentation

Dispatch `job-documenter` sub-agent with `ACTION: init`.

Write initial `state.json` to `jobs/<job-name>/state.json` after job docs are initialized.

Verify `DOCUMENTER_RESULT.status == "success"`.

## Phase 2: Execute Plan

Execute plan steps sequentially. After each step:
1. Collect result
2. Send to `job-documenter` (ACTION: add-document)
3. Update README (ACTION: update-readme)
4. Update `state.json` with step completion
5. Mark step as completed

### Step: ANALYZE

Read `skills/issue-analyzer/orchestrator-prompt.md`, fill in parameters:

```
ISSUE_URL: <url>   (or ISSUE_REPO + ISSUE_NUMBER)
CODEBASE_PATHS: [{path, role, branch}]
MAX_TASKS: 7 (default)
SEARCH_DEPTH: focused (default)
```

Launch Task(issue-analyzer). Parse JSON result — extract tasks and dependency_order.

For `analyze` intent: show result, ask "Implement? (yes/no)".
- yes → extend plan: prepare → implement → review → fix → checks → report → pr
- no → Phase 3

### Step: PREPARE — Create Feature Branch

> **CRITICAL**: Use ONLY `git worktree add`. NEVER `git checkout -b`.

```bash
git -C <project_dir> fetch origin <base_branch>
git -C <project_dir> worktree add ../<branch-slug> -b feature/<branch-slug> origin/<base_branch>
npm install --prefix <worktree_path>
```

All subsequent operations ONLY in worktree directory.

### Step: IMPLEMENT — Sequential Implementation

```
FOR task_id in dependency_order:
  1. Read skills/task-implementer/orchestrator-prompt.md
  2. Fill in: task JSON object + workspace (worktree_path, branch, issue_number)
  3. Launch Task(task-implementer)
  4. Parse JSON result
  5. Record in TASK_RESULTS[task_id]
  6. If status=failed → STOP, ask user
```

Document result in job-documenter.

### Step: REVIEW — Run Reviewers

```
REVIEWERS = ["code-ai-review", "code-b091-review", "code-style-review"]
IF *.store.ts modified: add "code-mobx-store-review"

FOR reviewer in REVIEWERS:
  Load skill → execute → collect findings as JSON
```

Document result.

### Step: FIX — Review-Fix Loop (max 2 iterations)

If CRITICAL or WARNING findings exist:
1. Group by file
2. Launch task-implementer (task_type: "fix") with review findings JSON
3. Re-run reviewers
4. Recount findings

### Step: CHECKS — Final Verification

```bash
npm run lint
npm run type-check
npm test
```

### Step: REPORT — Generate Final Report

Markdown report per template in SKILL.md (section 2.9).

### Step: PR — Propose Draft PR (optional)

Dispatch `pr-issue-documenter` to generate PR description.
Present to user, ask confirmation, then:
```bash
gh pr create --title "<title>" --body "..." --base <base> --head <head> --draft
```

## Phase 3: Completion

1. Dispatch `job-documenter` with `ACTION: finalize`
2. Update `state.json` with `phase: "COMPLETION"`
3. Tell user what was accomplished + documentation path + PR URL (if created)
