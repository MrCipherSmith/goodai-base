---
name: review-orchestrator
description: |
  Use when: a code review is requested and the user does not explicitly name a specialized reviewer.
  Handles "review", "code review", "review PR", "review --frontend", "review --backend",
  "review --architecture", "review --security", "review --performance", "review --style",
  "review --strict", "review --project-conventions", "review --legacy-profiles", "review --all". Routes to specialized reviewers in parallel and
  consolidates findings into one unified report.
  NOT for: running a single specialized reviewer — invoke it directly by name instead.
version: "1.5.0"
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
  - "review --greptile"
  - "review --project-conventions"
  - "review --frontend-conventions"
  - "review --testing-practices"
  - "review --core-boundaries"
  - "review --flow-graph"
  - "review --legacy-profiles"
  - "review --code-ai"
  - "review --b091"
  - "review --code-style"
  - "review --mobx-store"
metadata:
  author: "MrCipherSmith"
  version: "1.5.0"
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
- [ ] Step 1: Build Review Context Pack (PR metadata, scope, rules, context_doc summary)
- [ ] Step 2: Detect review mode (diff mode vs. path mode)
- [ ] Step 3: Collect bounded scope - git diff OR file list from path
- [ ] Step 4: Parse flags / auto-detect domain from scope
- [ ] Step 5: Ask user to confirm optional convention and legacy/profile reviewers
- [ ] Step 6: Plan sub-agent dispatch, token budgets, and model strategy
- [ ] Step 7: Stage 1 gate - spec compliance check (if issue/task provided)
- [ ] Step 8: Dispatch selected reviewers in PARALLEL with reviewer-input schema
- [ ] Step 9: Collect reviewer-finding schema results and handle NEEDS_CONTEXT
- [ ] Step 10: Run strict synthesis when blockers/majors exist or --strict is set
- [ ] Step 11: Sort by severity, deduplicate, emit unified report
```

---

## Input Contract

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `flags` | string[] | no | One or more of: `--frontend`, `--backend`, `--architecture`, `--security`, `--performance`, `--style`, `--clean-code`, `--highload`, `--project-conventions`, `--frontend-conventions`, `--testing-practices`, `--core-boundaries`, `--flow-graph`, `--legacy-profiles`, `--code-ai`, `--b091`, `--code-style`, `--mobx-store`, `--strict`, `--all` |
| `path` | string | no | File or directory path to review (e.g., `src/stores/`, `src/components/UserCard.tsx`). Activates **path mode** — reviews the files at this path directly, not a git diff. |
| `commit_range` | string | no | Explicit commit hash or range (e.g., `abc123..HEAD`). Overrides merge-base detection. Ignored in path mode. |
| `issue_url` | string | no | GitHub issue or task URL. If provided, Stage 1 gate checks spec compliance before dispatching reviewers. |
| `context_doc` | string | no | Path to job context document (e.g., `~/goodai-base/jobs/<job>/ai/context.md`). |
| `context_mode` | string | no | `none`, `light`, or `full`. Default: `light` for PR review, `none` for small path reviews. `full` may call `context-collector` before dispatch. |
| `token_budget` | object | no | Optional budget controls: `{total, per_reviewer, diff_max_chars, file_max_chars}`. |
| `model_strategy` | string | no | `current`, `ask`, or `adaptive`. Default: `current`; do not switch models unless user or automation allows it. |

---

## Review Context Pack

Before routing reviewers, build a compact `review_context` object. This is the shared source of truth for all sub-agents and must follow `skills/review-orchestrator/review-context.schema.json`.

Required content:
- Request: raw user request, flags, review mode, explicit paths or commit range.
- Git/PR metadata: repo, branch, base, head, merge-base, PR number/URL when available.
- Scope summary: changed files grouped by domain, high-risk files, generated/ignored files.
- Requirements: issue URL, linked task docs, acceptance criteria extracted from `context_doc` when available.
- Rules: matched repository rules and convention docs by path.
- Decisions: why each reviewer was selected or skipped.
- Token policy: effective budget, truncation decisions, files summarized instead of fully inlined.
- Legacy/profile reviewer availability and selection state.

Context modes:
- `none`: no additional context collection; use only diff/path and local rules.
- `light`: default for PR review. Read existing `context_doc`, local `AGENTS.md`/`CLAUDE.md`, and matching rule files. Do not browse external docs.
- `full`: for large/high-risk PRs or user request. Invoke `context-collector` first, then pass the resulting context path and summary to reviewers.

High-risk triggers for `full` recommendation:
- Auth, permissions, API contracts, migrations, shared core, state management, graph/flow, security, performance-critical paths.
- More than 20 changed source files or more than 2,000 changed lines.
- Missing or ambiguous linked requirements.

If `full` context would be useful but was not explicitly requested, ask once:

```text
This PR touches high-risk areas. Build full review context before dispatching reviewers?

  A) Yes - collect full context first (recommended)
  B) No - use light context and continue

> pick a letter (default: A)
```

---

## Token and Context Budget Management

The orchestrator owns token budget. Sub-reviewers should receive only the context needed for their domain.

Budget rules:
- Compute a scope digest before dispatch: file list, diff stats, module map, and top risks.
- Send full diffs only for files relevant to each reviewer.
- For large files, send changed hunks plus nearby symbols first; include full file only when path mode or the reviewer requires whole-file context.
- Never send generated files, lockfiles, snapshots, build output, or vendored code unless the reviewer is specifically about that file type.
- Cap each reviewer prompt with `per_reviewer` budget when provided; otherwise use the smallest prompt that preserves evidence.
- Record omitted files and truncation in `review_context.token_policy.omissions`.
- If a reviewer returns `NEEDS_CONTEXT`, provide only the missing targeted context, not the entire repository.

Default budget guidance:

| Review size | Detection | Context mode | Dispatch style |
|---|---|---|---|
| small | <= 5 files and <= 300 changed lines | `light` | full relevant diff to selected reviewers |
| medium | <= 20 files or <= 2,000 changed lines | `light` | per-domain filtered diff |
| large | > 20 files or > 2,000 changed lines | ask `full` | staged waves by domain |
| high-risk | auth/API/core/security/data migrations | ask `full` | include strict synthesis |

---

## Model Strategy

Default: keep the current model for all reviewers.

If the platform supports assigning models to sub-agents and the user/automation allows it, the orchestrator may use `model_strategy: adaptive`:

| Complexity | Suggested model class | Reviewers |
|---|---|---|
| simple | cheaper/faster coding model | `review-style`, `review-clean-code`, docs-only convention checks, legacy/profile checks |
| normal | current/default model | `review-frontend`, `review-backend`, `review-testing-practices`, convention reviewers |
| complex | strongest available coding/reasoning model | `review-logic`, `review-architecture`, `review-security-code`, `review-highload`, `review-greptile`, strict synthesis |

Rules:
- Do not silently change model class when `model_strategy` is `current`.
- With `model_strategy: ask`, present the model plan once before dispatch.
- With `model_strategy: adaptive`, record chosen model class per reviewer in the final report metadata.
- If model assignment is unsupported, record `model_strategy: current-session`.

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

### Project Convention Auto-Detection

If the repository has local convention docs such as `CLAUDE.md`, `AGENTS.md`,
`.junie/guidelines.md`, or module-level `CLAUDE.md` files, append these reviewers by path:

| File pattern | Reviewers appended |
|---|---|
| `src/**/*.ts`, `src/**/*.tsx`, `*.stories.tsx` | `review-frontend-conventions` |
| `**/*.test.*`, `**/*.spec.*`, `**/*.integration.test.*`, `**/*.msw.ts`, `src/test/**`, `test/**`, `e2e/**` | `review-testing-practices` |
| `src/core/**`, `core/**`, `shared/**`, `foundation/**` | `review-core-boundaries` |
| `src/core/flow/**`, `src/graph/**`, `src/shared/flow/**` | `review-flow-graph` |

These convention reviewers are additive: keep the generic reviewers selected by normal detection,
then add the matching convention pass. Deduplicate reviewer names before dispatch.

### Convention Reviewer Confirmation

When convention reviewers are auto-detected and the user did not explicitly pass
`--project-conventions`, `--frontend-conventions`, `--testing-practices`, `--core-boundaries`,
`--flow-graph`, or `--all`, ask before dispatch:

```text
I found local convention reviewers that match this review scope:

  A) Include all detected convention reviewers (recommended)
  B) Choose individually
  C) Skip convention reviewers for this run

Detected:
  - review-frontend-conventions: <why detected, or omit if not detected>
  - review-testing-practices: <why detected, or omit if not detected>
  - review-core-boundaries: <why detected, or omit if not detected>
  - review-flow-graph: <why detected, or omit if not detected>
```

If the user chooses B, list only detected reviewers and ask for names to include/exclude.
If the user does not answer and the review is part of an automated `job-orchestrator` pipeline,
use the job setting `convention_reviewers` (default: `"ask"`; if still unresolved, include all
detected reviewers and record that choice in the review scope).

---

## Legacy/Profile Reviewer Auto-Detection

Legacy/profile reviewers are specialized review profiles that predate the review-domain `review-*` naming. They are still valid and must be shown separately from generic and convention reviewers so the user can opt in deliberately.

| Trigger | Reviewers appended |
|---|---|
| `--legacy-profiles` | `code-ai-review` + `code-b091-review` + `code-style-review` + `code-mobx-store-review` when MobX/store files are present |
| `--code-ai` | `code-ai-review` |
| `--b091` | `code-b091-review` |
| `--code-style` | `code-style-review` |
| `--mobx-store` | `code-mobx-store-review` |
| `*.store.ts`, `makeObservable`, `observable`, `computed`, `action.bound` | suggest `code-mobx-store-review` as optional profile reviewer |

When any legacy/profile reviewer is available and the user did not explicitly pass its flag, ask after convention prompts:

```text
This question controls only optional legacy/profile reviewers. Generic and convention reviewer choices listed above are unchanged.

Include legacy/profile reviewers?

  A) Include all applicable profile reviewers
  B) Choose individually
  C) Skip legacy/profile reviewers (recommended unless you need these profiles)

Available:
  - code-ai-review: strict AI review profile
  - code-b091-review: b091-style strict logic profile
  - code-style-review: legacy style/architecture profile
  - code-mobx-store-review: MobX store/state profile (only if MobX/store files are present)
```

If the user chooses B, list only applicable reviewers and ask for exact names. If the review is part of `job-orchestrator`, use `reviewers` and `conditional_reviewers` automation settings when provided.

Review Plan Preview must include an `Optional legacy/profile reviewers` group and a `Skipped reviewers` group with reasons such as:

```text
Optional legacy/profile reviewers:
  - code-ai-review: available via --code-ai or --legacy-profiles
  - code-b091-review: available via --b091 or --legacy-profiles
  - code-style-review: available via --code-style or --legacy-profiles
  - code-mobx-store-review: auto-suggest when *.store.ts or MobX patterns are present; available via --mobx-store or --legacy-profiles

Skipped reviewers:
  - code-ai-review: profile reviewer, not selected unless --code-ai/--legacy-profiles
  - code-b091-review: profile reviewer, not selected unless --b091/--legacy-profiles
  - code-style-review: legacy style profile, not selected unless --code-style/--legacy-profiles
  - code-mobx-store-review: not selected unless --mobx-store/--legacy-profiles or MobX store files are detected
```

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
| `--greptile` | `review-greptile` (codebase-aware; requires PR number) |
| `--project-conventions` | all generic convention reviewers: `review-frontend-conventions` + `review-testing-practices` + `review-core-boundaries` + `review-flow-graph` |
| `--frontend-conventions` | `review-frontend-conventions` |
| `--testing-practices` | `review-testing-practices` |
| `--core-boundaries` | `review-core-boundaries` |
| `--flow-graph` | `review-flow-graph` |
| `--all` | all reviewers above (including `review-clean-code`, `review-highload`, applicable legacy/profile reviewers, project convention reviewers when local convention docs exist, and `review-greptile` when PR number is present) |
| `--strict` | runs AFTER all others; adds a strict commentary pass on consolidated findings |
| (auto) | detected from diff file extensions — see Auto-detection table |

Multiple flags may be combined. Example: `review --backend --security` dispatches
`review-logic` + `review-backend` + `review-architecture` + `review-security-code`.
Example: `review --frontend --frontend-conventions` dispatches the generic frontend set plus the
local frontend conventions reviewer.

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

Dispatch selected reviewers in parallel when independent. Use waves when token budget is tight or when one reviewer needs another result:

1. Wave A - core correctness/risk reviewers: logic, architecture, security/highload when selected.
2. Wave B - domain reviewers: frontend/backend/testing/convention reviewers filtered to relevant files.
3. Wave C - synthesis: strict pass when blockers/majors exist, `--strict` is set, or PR is high-risk.

### Agent Runtime Compatibility

Before dispatching a reviewer through a platform-native sub-agent mechanism, verify that the exact reviewer name is available as an agent type in the current runtime.

Runtime rules:
- If the exact reviewer agent type exists, dispatch that reviewer directly.
- If the exact reviewer agent type does not exist but `skills/<reviewer>/SKILL.md` exists, dispatch `general-purpose` and include the reviewer name, skill path, bounded review context, and required `REVIEW_RESULT` schema in the prompt.
- If neither the agent type nor the skill file exists, do not silently substitute another reviewer. Mark that reviewer as `BLOCKED`, include the missing agent/skill name, and continue only with independent reviewers.
- Record the chosen runtime per reviewer in `review_context.review_plan.dispatch_plan`.
- The user-facing progress line must be explicit: "Running `<reviewer>` via `general-purpose` fallback because native agent type is unavailable."

Do not use vague fallback messages such as "running through available agent types" without naming which reviewers used fallback and why.

Pass each sub-reviewer a payload matching `skills/review-orchestrator/reviewer-input.schema.json`:

```yaml
review_context: <bounded context pack>
reviewer: <skill-name>
scope_mode: diff | path
context_doc: <path or empty>
issue_url: <url or empty>
model_class: simple | normal | complex | current-session
budget:
  max_prompt_tokens: <number or null>
  max_findings: <number>

# If scope_mode = diff:
branch: <branch>
base_sha: <base sha>
diff: <filtered diff relevant to this reviewer>

# If scope_mode = path:
target_path: <resolved path or file list>
file_contents: <bounded file contents relevant to this reviewer>
```

Each reviewer must return a `REVIEW_RESULT` object matching `skills/review-orchestrator/reviewer-finding.schema.json`, followed by a concise markdown summary. The orchestrator must reject or normalize free-form reports before consolidation.

**Important for path mode:** instruct each reviewer to check the **entire file**, not just changes. The scope report should say "Path: `<TARGET_PATH>`" instead of a branch/merge-base.

### Greptile Reviewer

`review-greptile` runs in parallel with the other reviewers **when a PR number is available** (diff mode with a PR). It is excluded in path mode (no PR) unless `--greptile` is explicitly specified.

When dispatching `review-greptile`, pass additionally:

```
PR_NUMBER:    <pr number>
REPO:         <owner/repo>
REMOTE:       github | gitlab
```

Greptile findings use `G-` prefixed IDs and are merged into the consolidated report under a dedicated section **"## Greptile (Codebase-Aware Findings)"** placed before the Blockers section. If Greptile identified cross-file impact not caught by other reviewers, those appear as additional blockers/majors.

**Auto-include Greptile when:** `--all` flag is used AND a PR number is resolvable from the current branch (`gh pr view` succeeds).

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
| Frontend repository conventions | NO | `review-frontend-conventions` |
| Test / e2e conventions | NO | `review-testing-practices` |
| Shared core boundary rules | NO | `review-core-boundaries` |
| Shared flow/graph abstraction contracts | NO | `review-flow-graph` |
| Legacy/profile review profiles | NO | `code-ai-review`, `code-b091-review`, `code-style-review`, `code-mobx-store-review` |

---

## Sub-Agent Report Quality Gate

Before consolidation, validate every reviewer result:
- Required status: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`.
- Required finding fields: id, severity, file, line (nullable only for repo-wide findings), problem, impact, suggested_fix, evidence, confidence, reviewer.
- Every blocker must include evidence and a concrete suggested fix.
- Findings without evidence are downgraded to `info` or returned to the reviewer for clarification.
- Duplicate findings are merged by `dedupe_key` or by `(file, line, problem)`.
- `NEEDS_CONTEXT` triggers one targeted context refill. If still unresolved, keep it as an explicit open question, not as a blocker.
- If a reviewer exceeds `max_findings`, keep blockers/majors first and summarize lower severity findings.

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
- Context mode: `<none | light | full>`
- Model strategy: `<current | ask | adaptive | current-session>`
- Token budget: `<used/limit if known; omissions count>`

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
