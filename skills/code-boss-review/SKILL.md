---
name: code-boss-review
description: "Use when a boss-style or strict code review is requested, needing direct no-fluff feedback focused on logic correctness."
triggers:
  - "Review as boss"
  - "boss style review"
  - "boss review"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "review"
license: "MIT"
compatibility: "cursor,codex,zed,opencode"
---

# Code Review as boss (current branch only)

## Review Stages — Required Order

### Stage 1: Spec Compliance
Answer first: **Did the implementation build exactly what was specified — nothing more, nothing less?**

Checklist:
- [ ] All acceptance criteria from the task/issue are met
- [ ] Nothing was added beyond the task scope
- [ ] Nothing from the task scope was omitted
- [ ] Behavior matches the specification

**Gate:** If Stage 1 fails (scope drift, missing criteria, added features) → report immediately as CRITICAL. Do NOT proceed to Stage 2 until spec compliance is confirmed.

### Stage 2: Code Quality
Only after Stage 1 passes — answer: **Is the implementation well-crafted?**

Checklist:
- [ ] Logic is correct and handles edge cases
- [ ] No security vulnerabilities
- [ ] Performance is acceptable
- [ ] Code is readable and maintainable
- [ ] Tests cover key scenarios

**IRON LAW: SPEC COMPLIANCE REVIEW ALWAYS COMES FIRST. STAGE 2 DOES NOT BEGIN UNTIL STAGE 1 IS CONFIRMED.**

---

## Workflow

Copy this checklist and track progress:

```
boss Review Progress:
- [ ] Step 1: Determine parent branch and calculate merge-base
- [ ] Step 2: Collect git diff (committed + local changes)
- [ ] Step 3: Apply boss principles (logic in correct layer, no ducttape)
- [ ] Step 4: Check types (no any, typed mocks)
- [ ] Step 5: Verify conventions (currentState, I prefix, etc.)
- [ ] Step 6: Challenge all assumptions
- [ ] Step 7: Generate direct report with patches
```

## Mandatory Rules

1. **Default scope (no commit hash/range in request)**: review includes **all** changes in the current branch from the divergence point (merge-base) from the parent branch:
   - committed (`BASE_SHA..HEAD`)
   - local uncommitted (staged/unstaged/untracked)
2. **Scope with explicit commit hash/range**: if the user explicitly provided a hash or range, review only the requested range; do not add local uncommitted changes unless separately requested.
3. **boss style/principles**: review strictly per `~/goodai-base/rules/core/code-review-boss-profile.mdc`.
4. **Output**: detailed report of issues with explanation and fix suggestions (minimal patches where straightforward).

## Scope Detection

See shared script: `skills/shared/git-merge-base.md`

Run the script from that file to determine MERGE_BASE and SCOPE before proceeding with the review.

## Commands to collect the review slice

### A) Default mode (user did NOT provide hash/range)

```bash
git status

# Committed branch changes
git log --oneline "${BASE_SHA}..HEAD"
git diff --stat "${BASE_SHA}..HEAD"
git diff --name-status "${BASE_SHA}..HEAD"
git diff "${BASE_SHA}..HEAD"

# Full current slice from merge-base to working tree:
# includes commits + staged + unstaged
# (untracked: see git status / git ls-files)
git diff --stat "${BASE_SHA}"
git diff --name-status "${BASE_SHA}"
git diff "${BASE_SHA}"
git ls-files --others --exclude-standard
```

### B) Explicit hash/range mode

```bash
git show --stat --name-status --patch <COMMIT_SHA>
git log --oneline <FROM_SHA>..<TO_SHA>
git diff --stat <FROM_SHA>..<TO_SHA>
git diff --name-status <FROM_SHA>..<TO_SHA>
git diff <FROM_SHA>..<TO_SHA>
```

## How to review (boss style)

Apply the checklist and principles from `~/goodai-base/rules/core/code-review-boss-profile.mdc`. Key boss emphases:

- Logic must live in the correct layer (often the store), so it can be properly tested.
- Against "patch/glue/ducttape": demand fixing the root cause, not masking symptoms.
- No `any`, `as any`, unsafe casts in new code; mocks must be typed and not inherit from real implementations.
- No duplicated rules/checks: single source of truth, reuse setters/methods.
- Project conventions are mandatory (e.g., `currentState`, `I` prefix for interfaces, consistent types).
- Magic numbers / `setTimeout(0)` / scary hacks — only with a clear "why", or redesign.
- **Accessibility modifiers in stores**: inter-store callbacks (`onChangeX`, `onFireX`, `handleX`, `syncX`) MUST be `private`. A public method is acceptable only if called from a React component. Ask: "Is this method called from JSX?" If no — `private`.
- With MobX by default **do not add** `useCallback`/`useMemo` without explicit need.
- Suggestions must pass lint; do not nitpick autoformatting.
- Do not expand scope: large refactors "not today" if outside the task.

## Output Format

Write in the user's query language. Use boss markers (e.g., `not today ;P`, "ducttape", "broken thinking") sparingly and only when relevant, never personal.

Use this structure:

```markdown
## Verdict (boss)
<OK / needs work / fundamentally wrong> + 1-3 most important points.

## Review Scope (current branch only)
- Branch: `<BRANCH>`
- Parent ref: `<PARENT>`
- Merge-base: `<BASE_SHA>`
- Scope mode: `<default-with-uncommitted | explicit-hash-range>`
- Commits (merge-base..HEAD): <N>
- Changed files: <list or count>

## Findings (detailed)
### Architecture and Logic Layer
<findings>

### Types, Casts, Mocks
<findings>

### Correctness and State Semantics
<findings>

### Conventions and Consistency
<findings>

### Lint/Format/Noise
<findings>

### UX/Edge Cases
<findings>

### Testability
<findings>

## Suggested Fixes (patches)
<minimal unified diff patches for obvious fixes>
```

### Finding Format (mandatory)

For each finding:

- **Severity**: `blocker` / `major` / `minor`
- **Location**: file path + relevant hunk/fragment from diff
- **Problem**: what is wrong
- **Why it matters**: correctness/testability/conventions/maintainability
- **Suggested fix**: what to do specifically (targeted, no scope expansion)
- **Optional patch**: if fix is simple — unified diff

---

## Scope Boundaries

| Concern | This skill | Use instead |
|---------|-----------|-------------|
| Logic correctness, layer violations, type safety, conventions | YES | — |
| General AI review (broader quality, performance, UX) | NO | `code-ai-review` |
| MobX store internals (actions, computed, reactions) | NO | `code-mobx-store-review` |
| Pure style/naming/architecture pattern audit | NO | `code-style-review` |

---

## Job Context Awareness

When dispatched by `job-orchestrator` as part of a job pipeline, the prompt MAY include:

```
JOB_NAME:     <job-name>
CONTEXT_PATH: ~/goodai-base/jobs/<job-name>/ai/context.md
```

If provided and the file exists, read the context document before starting the review. Use it to:
- Understand which libraries and patterns were intentionally chosen for the implementation
- Avoid flagging correct library usage as issues
- Provide more accurate findings by understanding the project's architectural decisions

If the file does not exist or is not provided, proceed normally — context is optional and non-blocking.
