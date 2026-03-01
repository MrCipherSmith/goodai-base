---
name: code-style-review
description: "Detailed code style and architecture review using code-style-patterns.mdc. Reviews current branch changes. Checks naming, organization, patterns, TypeScript usage. Use when: style validation needed, architecture review."
triggers:
  - "Style review"
  - "Check code style"
  - "Architecture review"
metadata:
  author: "goodea"
  version: "1.0.0"
  category: "review"
license: "MIT"
compatibility: "cursor,codex,zed,opencode"
---

# Code Style Review

Review only current branch changes from the point of divergence from the parent branch, strictly per `~/goodea/goodai-base/rules/core/code-style-patterns.mdc`.

## Scope

- If the user **did not provide a commit hash/range**, review the full slice from merge-base to current working tree:
  - committed changes (`BASE_SHA..HEAD`)
  - local uncommitted (`staged/unstaged/untracked`)
- If the user **explicitly provided a commit hash/range**, review only the requested range; do not add uncommitted changes unless separately requested.
- Do not discuss legacy code outside the changed scope.
- Feedback must be detailed: problem → why it's a problem → where (file/area) → what to do → fix example.
- Suggest fixes as unified diff patches; do not modify code directly.

## Scope Detection

See shared script: `skills/shared/git-merge-base.md`

Run the script from that file to determine MERGE_BASE and SCOPE before proceeding with the review.

Collect input data:

### A) Default mode (no hash/range)

```bash
git status

# Committed branch changes
git log --oneline "${BASE_SHA}..HEAD"
git diff --name-status --find-renames "${BASE_SHA}..HEAD"
git diff --find-renames "${BASE_SHA}..HEAD"

# Full current slice from merge-base to working tree
# includes commits + staged + unstaged
# (untracked: see git status / git ls-files)
git diff --name-status --find-renames "${BASE_SHA}"
git diff --find-renames "${BASE_SHA}"
git ls-files --others --exclude-standard
```

### B) Explicit hash/range mode

```bash
git show --stat --name-status --patch <COMMIT_SHA>
git log --oneline <FROM_SHA>..<TO_SHA>
git diff --name-status --find-renames <FROM_SHA>..<TO_SHA>
git diff --find-renames <FROM_SHA>..<TO_SHA>
```

Use only these changes as input for the review.

## Review Checklist (per `~/goodea/goodai-base/rules/core/code-style-patterns.mdc`)

### TypeScript Strictness
- `any` is forbidden (suggest `unknown` + type guards / correct types).
- Props via `interface`, `I*` prefix.
- Prefer `?.` and `??`, avoid `!` (non-null assertion).

### MobX
- Stores must have `makeObservable(this)` in constructor.
- For async mutations after `await` — `runInAction`.
- Action methods: `@action.bound`.
- Derived state: `@computed`.
- For collections/lists — `@observable.shallow` (where applicable).
- Inter-store callbacks (`onChangeX`, `onFireX`, `handleX`, `syncX`) MUST be `private`. Public `@action.bound` only for methods called from React components.

### React Components
- Components reading observables MUST be `observer(...)`.
- MVVM: logic and side effects in Store/Service, not in View.
- Forbid business logic in `useEffect` (suggest store actions/reactions).
- File structure order: imports → interfaces → component → helpers.

### Architecture & Layers
- API/IO not in View: use Service/Store.
- Store interaction via actions (no direct mutations outside actions).

### Anti-patterns Severity
- Critical: API in View, missing `observer`, direct store mutation, serious MobX async violations.
- Warnings: `console.log` instead of `AppLogger`, inline object props without memo/const, heavy logic in render, questionable types, public inter-store callbacks/handlers.

## Output Format

Generate report in Markdown strictly per this template:

```markdown
## Summary
- [1-3 bullets] What changed and overall style compliance level

## Scope
- Branch: `<BRANCH>`
- Parent ref: `<PARENT>`
- Merge-base: `<BASE_SHA>`
- Scope mode: `<default-with-uncommitted | explicit-hash-range>`

## Critical Issues (must fix)
### [Short issue title]
- **Rule**: [reference/section name from core/code-style-patterns.mdc]
- **Why**: [explanation]
- **Where**: `path/to/file.tsx` (lines from diff)
- **Fix**: [what to do]
- **Proposed patch**:
```diff
[unified diff]
```

## Warnings
... (same format, without "must fix")

## Suggestions
... (same format, improvements without obligation)

## File-by-file notes
- `path/to/file`: [brief, only changed areas]
```

## Rules of Engagement

- Tie findings to specific changed lines (from diff).
- If multiple options exist, suggest one default and a brief alternative.
- Do not suggest new libraries without explicit request.

---

## Scope Boundaries

| Concern | This skill | Use instead |
|---------|-----------|-------------|
| Naming conventions, file organization, import order | YES | — |
| TypeScript patterns, component/hook structure | YES | — |
| Architecture pattern compliance | YES | — |
| Logic correctness, type safety deep dives | NO | `code-ai-review` or `code-b091-review` |
| MobX store internals | NO | `code-mobx-store-review` |

---

## Job Context Awareness

When dispatched by `job-orchestrator` as part of a job pipeline, the prompt MAY include:

```
JOB_NAME:     <job-name>
CONTEXT_PATH: ~/goodea/goodai-base/jobs/<job-name>/ai/context.md
```

If provided and the file exists, read the context document before starting the review. Use it to:
- Understand which libraries and patterns were intentionally chosen for the implementation
- Validate code style against documented project conventions from the context
- Provide more accurate findings by understanding the project's architectural decisions

If the file does not exist or is not provided, proceed normally — context is optional and non-blocking.
