---
name: code-ai-review
description: "Use when a code review is requested against AI-assistant standards, checking branch changes for correctness, quality, or implementation review."
triggers:
  - "Code review"
  - "Review my changes"
  - "Check this code"
  - "Review code"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "review"
license: "MIT"
compatibility: "cursor,codex,zed,opencode"
---


# Code AI Review (only current branch)

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
Code Review Progress:
- [ ] Step 1: Determine parent branch and calculate merge-base
- [ ] Step 2: Collect git diff (committed + local changes)
- [ ] Step 3: Identify changed files and categorize
- [ ] Step 4: Review each file following standards
- [ ] Step 5: Document findings with severity and location
- [ ] Step 6: Generate report with patches
```

## Scope Boundaries
This skill focuses on:
- Correctness and logic bugs
- Type safety and TypeScript contract violations
- Security and null-safety issues
- Error handling completeness
- Performance anti-patterns

This skill does NOT duplicate:
- MobX store-specific patterns → covered by code-mobx-store-review
- Naming/formatting/import organization → covered by code-style-review
- Architecture opinions and persona-specific insights → covered by code-boss-review

## Review Scope Rule

Review only changes introduced in the current branch since it diverged from the parent branch.

- If the user **did not provide a commit hash/range**, include **the full branch slice from merge-base to working tree**:
  - committed (`BASE_SHA..HEAD`)
  - local uncommitted (`staged/unstaged/untracked`)
- If the user **explicitly provided a commit hash/range**, review only the requested range; do not add local uncommitted changes unless separately requested.
- Do not review unrelated parts of the repository.

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

## Review Rules (mandatory)

Follow the review standard from `~/goodai-base/rules/core/code-review-ai-assistant.mdc`:

- Structure output as: short summary → structured findings by category → concrete suggestions / optional patches.
- Prioritize correctness and safety over style.
- Avoid noise; focus on actionable, high-signal findings.
- Do not request large refactors unless explicitly asked.

## Output Format

Write the review using this structure:

```markdown
## Summary
<1-3 sentences: what was done and overall verdict (OK / needs work).>

## Review Scope (current branch only)
- Branch: `<BRANCH>`
- Parent ref: `<PARENT>`
- Merge-base: `<BASE_SHA>`
- Scope mode: `<default-with-uncommitted | explicit-hash-range>`
- Commits (merge-base..HEAD): <N>
- Changed files: <list or count>

## Findings
### Correctness
<findings>

### Types & Safety
<findings>

### Architecture & State
<findings>

### Readability & Style
<findings>

### Performance
<findings>

### UX/UI
<findings>

### Accessibility
<findings>

### Tests
<findings>

## Suggested Fixes (patches)
<minimal, targeted diffs for the most obvious fixes>
```

### Finding Format (mandatory)

For each finding:

- **Severity**: `blocker` / `major` / `minor`
- **Location**: file path + relevant lines/hunk (from the diff)
- **Problem**: what is wrong
- **Why it matters**: correctness/safety/perf/maintainability impact
- **Suggested fix**: concrete change
- **Optional patch**: provide a minimal unified diff when straightforward

Patch block example:

```diff
diff --git a/path/file.ts b/path/file.ts
index 0000000..1111111 100644
--- a/path/file.ts
+++ b/path/file.ts
@@ -1,3 +1,3 @@
-const x = 1;
+const x = 2;
```

---

## Scope Boundaries

| Concern | This skill | Use instead |
|---------|-----------|-------------|
| Types, safety, architecture, readability, performance, tests | YES | — |
| MobX store internals (actions, computed, reactions, async) | surface-level only | `code-mobx-store-review` for deep store analysis |
| boss-style direct feedback, logic-layer enforcement | NO | `code-boss-review` |
| Pure style/naming/pattern audit | NO | `code-style-review` |

---

## Job Context Awareness

When dispatched by `job-orchestrator` as part of a job pipeline, the prompt MAY include:

```
JOB_NAME:     <job-name>
CONTEXT_PATH: <JOBS_ROOT>/<job-name>/ai/context.md
```

If provided and the file exists, read the context document before starting the review. Use it to:
- Understand which libraries and patterns were intentionally chosen for the implementation
- Avoid flagging correct library usage as issues
- Provide more accurate findings by understanding the project's architectural decisions
- Reference context when justifying suggestions

If the file does not exist or is not provided, proceed normally — context is optional and non-blocking.
