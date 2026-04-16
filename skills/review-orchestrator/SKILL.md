---
name: review-orchestrator
description: |
  Use when: a code review is requested and the user does not explicitly name a specialized reviewer.
  Handles "review", "code review", "review PR", "review --frontend", "review --backend",
  "review --architecture", "review --security", "review --performance", "review --style",
  "review --strict", "review --all". Routes to specialized reviewers in parallel and
  consolidates findings into one unified report.
  NOT for: running a single specialized reviewer — invoke it directly by name instead.
version: "1.2.0"
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
  version: "1.2.0"
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
- [ ] Step 2: Determine git scope (merge-base)
- [ ] Step 3: Parse flags / auto-detect domain from diff
- [ ] Step 4: Stage 1 gate — spec compliance check (if issue/task provided)
- [ ] Step 5: Dispatch selected reviewers in PARALLEL
- [ ] Step 6: Collect and consolidate all findings
- [ ] Step 7: Sort by severity, deduplicate, emit unified report
```

---

## Input Contract

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `flags` | string[] | no | One or more of: `--frontend`, `--backend`, `--architecture`, `--security`, `--performance`, `--style`, `--strict`, `--all` |
| `commit_range` | string | no | Explicit commit hash or range (e.g., `abc123..HEAD`). Overrides merge-base detection. |
| `issue_url` | string | no | GitHub issue or task URL. If provided, Stage 1 gate checks spec compliance before dispatching reviewers. |
| `context_doc` | string | no | Path to job context document (e.g., `~/goodai-base/jobs/<job>/ai/context.md`). |

---

## Scope Detection

See shared script: `skills/shared/git-merge-base.md`

Run the script from that file to determine `BASE_SHA` before auto-detection or dispatching any reviewer.

### Auto-detection (no flag provided)

When no flag is present, scan changed file extensions to determine which reviewers to invoke:

```bash
git diff --name-only "${BASE_SHA}"
```

| File pattern | Domain detected | Reviewers invoked |
|---|---|---|
| `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.html` | frontend | `review-logic` + `review-frontend` + `review-style` |
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
BRANCH:        <branch>
BASE_SHA:      <base sha>
SCOPE_MODE:    <default-with-uncommitted | explicit-hash-range>
CONTEXT_DOC:   <path or empty>
ISSUE_URL:     <url or empty>
```

Each reviewer returns findings in the unified format defined in the Output Contract below.

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
