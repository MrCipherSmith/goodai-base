# Task Implementer — Orchestrator Prompt

> **Purpose:** Template used by `job-orchestrator` to dispatch `task-implementer` as a sub-agent.
> The orchestrator fills in the placeholders below and sends the result as a Task prompt.
> The task-implementer executes SKILL.md autonomously and returns a JSON result object.

## Data Flow

```
[Orchestrator] → extracts task from issue-analyzer JSON → fills template → Task(sub-agent)
                                                                                  ↓
[Sub-agent]    → executes task-implementer SKILL.md autonomously
                                                                                  ↓
[Result]       → JSON task result object (in final message)
```

## Step 1: Extract Task Parameters

From the issue-analyzer JSON output, extract one task object:

```
TASK:
  task_id              → from tasks[i].task_id
  task_name            → from tasks[i].task_name
  task_type            → from tasks[i].task_type
  complexity           → from tasks[i].complexity
  dependencies         → from tasks[i].dependencies (already satisfied — dispatch in dependency_order)
  description          → from tasks[i].description
  target_files         → from tasks[i].target_files
  acceptance_criteria  → from tasks[i].acceptance_criteria
  context              → from tasks[i].context
  existing_tests       → from tasks[i].existing_tests
  existing_stories     → from tasks[i].existing_stories
  module_patterns      → from tasks[i].module_patterns

WORKSPACE:
  codebase_path        → absolute path to project repo (worktree path)
  branch               → feature branch name (already checked out in worktree)
  issue_number         → GitHub issue number
  issue_title          → GitHub issue title

JOB_CONTEXT (optional):
  job_name             → job folder name
  context_path         → ~/goodea/goodai-base/jobs/<job-name>/ai/context.md
```

## Step 2: Validate

```
ASSERT task_id is not empty         → otherwise ABORT: "Missing task_id"
ASSERT task_type in valid types     → otherwise ABORT: "Invalid task_type"
ASSERT target_files is not empty    → otherwise ABORT: "No target files"
ASSERT codebase_path exists         → otherwise ABORT: "Codebase path not found"
```

## Step 3: Build Sub-Agent Prompt (regular task)

```
You are running the task-implementer skill in AUTONOMOUS MODE.
DO NOT ask the user any questions. Execute the full workflow end-to-end.

Load the skill: task-implementer (from skills/task-implementer/SKILL.md)

═══════════════════════════════════════════════
  TASK
═══════════════════════════════════════════════

{
  "task_id": "<TASK_ID>",
  "task_name": "<TASK_NAME>",
  "task_type": "<TASK_TYPE>",
  "complexity": "<COMPLEXITY>",
  "dependencies": [<DEPENDENCY_LIST>],
  "description": "<DESCRIPTION>",
  "target_files": [<TARGET_FILES_LIST>],
  "acceptance_criteria": [<ACCEPTANCE_CRITERIA_LIST>],
  "context": "<CONTEXT>",
  "existing_tests": [<EXISTING_TESTS_LIST>],
  "existing_stories": [<EXISTING_STORIES_LIST>],
  "module_patterns": "<MODULE_PATTERNS>"
}

═══════════════════════════════════════════════
  WORKSPACE
═══════════════════════════════════════════════

CODEBASE_PATH: <CODEBASE_PATH>
BRANCH:        <BRANCH>
ISSUE_NUMBER:  <ISSUE_NUMBER>
ISSUE_TITLE:   <ISSUE_TITLE>

<!-- If job context available: -->
JOB_NAME:     <JOB_NAME>
CONTEXT_PATH: ~/goodea/goodai-base/jobs/<JOB_NAME>/ai/context.md

═══════════════════════════════════════════════
  AUTOMATION SETTINGS
═══════════════════════════════════════════════

1. CONFIRMATION: SKIP. Proceed immediately.
2. AUTO COMMIT: true
3. VERIFY LINT: true
4. VERIFY TYPES: true
5. VERIFY TESTS: true
6. MAX SELF-FIX ATTEMPTS: 3

═══════════════════════════════════════════════
  EXECUTION INSTRUCTIONS
═══════════════════════════════════════════════

1. Load task-implementer SKILL.md
2. Execute all 6 phases: RECEIVE → RESEARCH → PLAN → IMPLEMENT → VERIFY → REPORT
3. Return the JSON result object as your FINAL MESSAGE
4. The JSON output must match the output contract:
   - Required fields: task_id, task_name, task_type, status
   - status: success|partial|failed
   - All file arrays may be empty but must be present

DO NOT ask questions. DO NOT stop for user input. Run to completion.
```

## Step 4: Build Sub-Agent Prompt (fix task)

For fix tasks dispatched from the review loop:

```
You are running the task-implementer skill in FIX MODE (AUTONOMOUS).
DO NOT ask the user any questions. Execute the full workflow end-to-end.

Load the skill: task-implementer (from skills/task-implementer/SKILL.md)

═══════════════════════════════════════════════
  FIX TASK
═══════════════════════════════════════════════

{
  "task_id": "fix-<ITERATION>",
  "task_name": "Fix review findings — iteration <ITERATION>",
  "task_type": "fix",
  "complexity": "medium",
  "dependencies": [],
  "description": "Fix review findings from iteration <ITERATION>",
  "target_files": [<FILES_WITH_FINDINGS>],
  "acceptance_criteria": ["All CRITICAL and WARNING findings resolved"],
  "context": "",
  "existing_tests": [],
  "existing_stories": [],
  "module_patterns": ""
}

FIX_CONTEXT:
{
  "review_feedback": <REVIEW_FINDINGS_JSON>,
  "original_task_ids": [<ORIGINAL_TASK_IDS>],
  "iteration": <ITERATION_NUMBER>
}

WORKSPACE: (same as above)

AUTOMATION SETTINGS: (same as above)

EXECUTION: Run to completion, return JSON result.
```

---

## Example Task Tool Call

```javascript
Task({
  description: "Implement task-1: <TASK_NAME>",
  subagent_type: "general",
  prompt: "<generated prompt from template above>"
})
```

---

## Parsing the Result (orchestrator)

After receiving the sub-agent response, the orchestrator must:

1. Extract the JSON object from the response (between ```json and ```)
2. Parse into TASK_RESULT:
   - `status`: success|partial|failed
   - `files_modified`, `files_created`, `files_deleted`: lists of file paths
   - `commits`: list of commit hashes
   - `lint_result`, `type_check_result`, `test_result`: verification results
   - `acceptance_criteria_met`: all|partial|none
3. Record: `TASK_RESULTS[task_id] = result`
4. Decision based on status:
   - success → continue
   - partial → log warnings, continue
   - failed → STOP implementation, ask user
