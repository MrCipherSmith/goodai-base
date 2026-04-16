---
name: review-orchestrator
description: |
  Use when: a code review is requested and the user does not explicitly name a specialized reviewer.
  Handles "review", "code review", "review PR", "review --frontend", "review --backend",
  "review --architecture", "review --security", "review --performance", "review --style",
  "review --strict", "review --all". Routes to specialized reviewers in parallel and
  consolidates findings into one unified report.
  NOT for: running a single specialized reviewer — invoke it directly by name instead.
version: "1.3.0"
triggers:
  - "review"
  - "code review"
  - "review PR"
  - "review --frontend"
  - "review --backend"
  - "review --architecture"
  - "review --security"
  - "review --performance"
  - "review --style"
  - "review --strict"
  - "review --all"
  - "review --clean-code"
  - "review --highload"
metadata:
  author: "MrCipherSmith"
  version: "1.3.0"
  category: "review"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# Review Orchestrator

Entry point for the entire review domain. This skill is a thin router: it detects scope,
dispatches specialized reviewers in parallel, then consolidates their findings into one
unified report sorted by severity. It does not perform any review logic itself.

---

## Workflow

```
Review Orchestrator Progress:
- [ ] Step 1: Read Job Context (if provided)
- [ ] Step 2: Detect review mode (diff mode vs. path mode)
- [ ] Step 3: Collect scope — git diff OR file list from path
- [ ] Step 4: Parse flags / auto-detect domain from scope
- [ ] Step 5: Stage 1 gate — spec compliance check (if issue/task provided)
- [ ] Step 6: Dispatch selected reviewers in PARALLEL
- [ ] Step 7: Collect and consolidate all findings
- [ ] Step 8: Sort by severity, deduplicate, emit unified report
```

---

## Input Contract

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `flags` | string[] | no | One or more of: `--frontend`, `--backend`, `--architecture`, `--security`, `--performance`, `--style`, `--clean-code`, `--highload`, `--strict`, `--all` |
| `path` | string | no | File or directory path to review (e.g., `src/stores/`, `src/components/UserCard.tsx`). Activates **path mode** — reviews the files at this path directly, not a git diff. |
| `commit_range` | string | no | Explicit commit hash or range (e.g., `abc123..HEAD`). Overrides merge-base detection. Ignored in path mode. |
| `issue_url` | string | no | GitHub issue or task URL. If provided, Stage 1 gate checks spec compliance before dispatching reviewers. |
| `context_doc` | string | no | Path to job context document (e.g., `~/goodai-base/jobs/<job>/ai/context.md`). |

---

## Scope Detection

### Step 1: Determine Review Mode

Before anything else, determine whether the request is **diff mode** or **path mode**:

**Path mode** is active when ANY of these is true:
- User explicitly provides a file or directory path (`src/stores/`, `src/components/UserCard.tsx`)
- User names a specific module, component, or store: "review the UserStore", "review the pipelines module", "review src/auth/"
- User says "review [the entire / whole / all of] X" where X is a module name, not a branch name

**Diff mode** (default) is active when:
- No path or target name provided
- User says "review", "review my changes", "review PR", "review this branch"

---

### Diff Mode

See shared script: `skills/shared/git-merge-base.md`

Run the script to determine `BASE_SHA`, then:

```bash
git diff --name-only "${BASE_SHA}"   # changed files for auto-detection
git diff "${BASE_SHA}"               # full diff passed to reviewers
```

Scope is limited to **changes introduced in the current branch since merge-base**.

---

### Path Mode

When a path or target is named, collect the files to review:

```bash
# If a directory path is given:
find <path> -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) | sort

# If a file path is given:
cat <file>

# If a module name is given (e.g. "UserStore", "pipelines module"):
find . -type f -name "*<name>*" \( -name "*.ts" -o -name "*.tsx" \)
# Also check common locations: src/stores/, src/modules/, src/components/
```

Pass the full **file contents** (not a diff) to sub-reviewers. Set `SCOPE_MODE: path`.

**Reviewer behavior in path mode:** reviewers check the entire file content — not just added lines. All findings apply to the current state of the code, not only to changes.

---

### Auto-detection of Reviewers (both modes)

When no flag is provided, infer reviewers from the collected file list:

| File pattern | Domain detected | Reviewers invoked |
|---|---|---|
| `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.html` | frontend | `review-logic` + `review-frontend` + `review-style` |
| `*.store.ts`, files containing `makeObservable` | frontend/store | `review-logic` + `review-frontend` + `review-style` |
| `*.ts`, `*.js` in `src/api/`, `src/services/`, `src/controllers/`, `src/modules/` | backend | `review-logic` + `review-backend` + `review-architecture` |
| `*.ts`, `*.js` mixed (both UI and service files) | fullstack | all of the above |
| Migration files, `*.sql`, `prisma/schema.prisma` | backend | `review-backend` + `review-architecture` |
| `*.test.*`, `*.spec.*` | any | append `review-logic` (spec compliance focus) |
| No recognizable extension pattern | fallback | `review-logic` + `review-architecture` |

---

## Routing Table

| Flag | Reviewers dispatched |
|------|---------------------|
| `--frontend` | `review-logic` + `review-frontend` + `review-style` |
| `--backend` | `review-logic` + `review-backend` + `review-architecture` |
| `--architecture` | `review-architecture` |
| `--security` | `review-security-code` |
| `--performance` | `review-performance` |
| `--style` | `review-style` |
| `--clean-code` | `review-clean-code` |
| `--highload` | `review-highload` |
| `--all` | all reviewers above (including `review-clean-code` and `review-highload`) |
| `--strict` | runs AFTER all others; adds a strict commentary pass on consolidated findings |
| (auto) | detected from diff file extensions — see Auto-detection table |

Multiple flags may be combined. Example: `review --backend --security` dispatches
`review-logic` + `review-backend` + `review-architecture` + `review-security-code`.

---

## Stage 1 Gate — Spec Compliance

**Run this FIRST, before dispatching quality reviewers, when an `issue_url` or task doc is provided.**

1. Fetch issue or task requirements.
2. Map changed files and functions to acceptance criteria.
3. Identify any criteria that are not addressed by the diff.
4. If there are unimplemented criteria: emit them as `blocker` findings in the final report and note them in `## Blockers`.
5. Continue dispatching the remaining reviewers regardless (spec gaps + quality issues both belong in the report).

---

## Dispatching Reviewers

Dispatch all selected reviewers **in parallel**. Pass to each sub-reviewer:

```
SCOPE_MODE:    diff | path
CONTEXT_DOC:   <path or empty>
ISSUE_URL:     <url or empty>

# If SCOPE_MODE = diff:
BRANCH:        <branch>
BASE_SHA:      <base sha>
DIFF:          <git diff output>

# If SCOPE_MODE = path:
TARGET_PATH:   <resolved path or file list>
FILE_CONTENTS: <full file contents>
```

Each reviewer returns findings in the unified format defined in the Output Contract below.

**Important for path mode:** instruct each reviewer to check the **entire file**, not just changes. The scope report should say "Path: `<TARGET_PATH>`" instead of a branch/merge-base.

---

## Scope Boundaries

| Concern | This skill | Use instead |
|---------|------------|-------------|
| Routing and consolidation | YES | — |
| Logic correctness | NO | `review-logic` |
| Frontend patterns (React, MVVM) | NO | `review-frontend` |
| Architectural violations | NO | `review-architecture` |
| Security vulnerabilities | NO | `review-security-code` |
| Performance anti-patterns | NO | `review-performance` |
| Style / naming / import order | NO | `review-style` |
| Clean Code principles + SOLID at code level | NO | `review-clean-code` |
| Concurrency, resource pools, caching, queues, idempotency | NO | `review-highload` |

---

## Finding Format

All findings from all sub-reviewers must be normalized to this format before consolidation:

```markdown
### [F-NNN] Title

- **Severity**: blocker | major | minor | info
- **File**: path/to/file.ts:line
- **Problem**: what is wrong
- **Why it matters**: impact on correctness / safety / maintainability / UX
- **Fix**: concrete suggestion
- **Patch** (optional):
  ```diff
  - old line
  + new line
  ```
```

Severity ordering for sort: `blocker` > `major` > `minor` > `info`.

---

## Output Contract

```
STATUS: DONE | DONE_WITH_CONCERNS
```

`DONE` — no blockers or majors found.
`DONE_WITH_CONCERNS` — one or more blocker or major findings present.

```markdown
# Review Report

## Verdict: APPROVE | APPROVE_WITH_SUGGESTIONS | REQUEST_CHANGES
<!-- APPROVE: zero blockers/majors. APPROVE_WITH_SUGGESTIONS: minors/info only.
     REQUEST_CHANGES: one or more blocker or major. -->

## Summary
<2-4 sentences: what the change does, overall code health, key concerns.>

## Review Scope
- Branch: `<BRANCH>`
- Parent ref: `<PARENT>`
- Merge-base: `<BASE_SHA>`
- Scope mode: `<default-with-uncommitted | explicit-hash-range>`
- Reviewers dispatched: <comma-separated list>
- Changed files: <count>

## Stats
- blocker: N
- major: N
- minor: N
- info: N

## Blockers (must fix before merge)
<[F-NNN] findings with severity=blocker, sorted by file>

## Major Issues
<[F-NNN] findings with severity=major>

## Minor & Info
<[F-NNN] findings with severity=minor or info>

## Positive Notes
<Optional. Highlight things done well. Keep brief.>
```

---

## Job Context Awareness

When dispatched by `job-orchestrator` or called with an explicit context path, the prompt MAY include:

```
JOB_NAME:     <job-name>
CONTEXT_PATH: ~/goodai-base/jobs/<job-name>/ai/context.md
```

If provided and the file exists, read the context document **before** running scope detection.
Use it to understand:
- Intentionally chosen libraries and patterns (do not flag as issues)
- Architectural decisions already agreed upon
- Acceptance criteria to drive the Stage 1 spec compliance gate

If absent, proceed normally — context is optional and non-blocking.

---

## Red Flags

| Rationalization | Why it is wrong |
|----------------|-----------------|
| "I'll just run all reviewers for safety" | Over-reviews waste time; auto-detect for relevant scope |
| "Spec compliance can wait until after quality review" | Stage 1 gate exists because unimplemented requirements invalidate quality work |
| "I'll deduplicate findings manually in my head" | Always normalize to [F-NNN] format before consolidation to avoid losing findings |
| "Minor findings from one reviewer cancel out the major from another" | Each finding stands independently; severity is per-finding, not averaged |
| "No flags means no reviewers" | No flags → run auto-detection; never produce an empty review |
| "User named a module so I'll use diff mode" | Named module/component/store → path mode; diff mode is only for branch changes |
| "Path mode should only show lines I'd flag in diff mode" | Path mode reviews the entire file — all findings apply, not just added lines |
