---
name: code-review
description: "Use when a thorough PR review or pre-merge check is needed, covering correctness, security, performance, and style via 4 parallel agents."
triggers:
  - "/code-review"
  - "Full review"
  - "Review PR"
  - "Comprehensive review"
  - "4-agent review"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "review"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# Code Review (4-Agent)

Comprehensive code review that dispatches 4 specialized agents in parallel for deep analysis.

## Review Stages — Required Order

### Stage 1: Spec Compliance
Answer first: **Did the implementation build exactly what was specified — nothing more, nothing less?**

Checklist:
- [ ] All acceptance criteria from the task/issue are met
- [ ] Nothing was added beyond the task scope
- [ ] Nothing from the task scope was omitted
- [ ] Behavior matches the specification

**Gate:** If Stage 1 fails (scope drift, missing criteria, added features) → report immediately as CRITICAL. Do NOT proceed to Stage 2 until spec compliance is confirmed.

> **Note on parallel execution:** When this skill dispatches 4 parallel review agents, Stage 1 (Spec Compliance) is evaluated by the correctness/logic agent as its primary mandate. If that agent reports a CRITICAL spec failure, the orchestrator must discard Stage 2 findings as premature and request spec remediation first. The Stage 2 agents (security, performance, style) run concurrently but their findings are conditional on Stage 1 passing.

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

### Phase 1: Preparation
1. Detect the review scope:
   - If on a feature branch: `git diff $(git merge-base main HEAD)..HEAD`
   - If PR number provided: `gh pr diff <number>`
   - Fallback: staged + unstaged changes
2. Get list of changed files: `git diff --name-only <range>`
3. Read all changed files in full (agents need complete context)

### Phase 2: Dispatch 4 Agents in Parallel

Launch 4 agents in a single turn:

**Agent 1 — Correctness & Logic**
- Logic bugs, edge cases, null/undefined risks
- Off-by-one errors, race conditions
- Incorrect error handling, missing return values
- Type mismatches, contract violations

**Agent 2 — Security**
- Injection vulnerabilities (SQL, XSS, command)
- Auth/authz gaps, missing input validation
- Secrets in code, insecure defaults
- OWASP Top 10 patterns

**Agent 3 — Performance**
- N+1 queries, unnecessary re-renders
- Missing memoization, expensive computations in loops
- Bundle size impact, large imports
- Memory leaks, unbounded collections

**Agent 4 — Style & Maintainability**
- Naming clarity, dead code, unused imports
- Overly complex logic (cyclomatic complexity)
- Missing or misleading comments
- DRY violations, code duplication

Each agent outputs findings as:
```
### [CRITICAL|HIGH|MEDIUM|LOW] Title
**File:** path/to/file:line
**Description:** what's wrong and why
**Suggestion:** how to fix
```

### Phase 3: Unified Report

Collect all 4 agent results and produce a single report:

```markdown
# Code Review Report

## Summary
- X critical, Y high, Z medium, W low findings
- Overall assessment: APPROVE / REQUEST_CHANGES / COMMENT

## Critical & High Findings
(sorted by severity, then by file)

## Medium & Low Findings
(collapsed or summarized)

## Positive Notes
(good patterns worth highlighting)
```

### Phase 4: Action (optional)
- If user says `/code-review --fix`, attempt to auto-fix MEDIUM and LOW findings
- If reviewing a PR, offer to post the review as a GitHub comment

## Arguments

- `/code-review` — review current branch changes
- `/code-review #<number>` — review specific PR
- `/code-review --fix` — auto-fix medium/low findings after review

## Rules

- NEVER approve code with CRITICAL findings
- Deduplicate findings across agents (same file:line = merge)
- Include positive feedback — don't make it only negative
- If the diff is huge (>2000 lines), split into chunks and review each
- Be strict but fair — only flag real issues, not style preferences

## Red Flags — Stop and re-read this skill if you are thinking:

| Rationalization | Why it's wrong |
|---|---|
| "The code looks fine at a glance, I'll do a quick review" | Glancing is not reviewing — bugs hide in details, not impressions |
| "This is a small change, detailed review isn't needed" | Small changes cause production incidents; size is not a proxy for safety |
| "The author said the tests pass, so it's probably fine" | Tests passing means tests pass, not that the code is correct or secure |
| "I'll mention it as INFO, not CRITICAL, to avoid friction" | Downgrading severity to soften feedback conceals real risk from the team |
| "I already understand the pattern — no need to read the full file" | Bugs live in the gap between what you expect and what's actually there |

**IRON LAW: EVERY FINDING THAT COULD CAUSE A BUG OR SECURITY ISSUE IS CRITICAL, REGARDLESS OF PR SIZE.**
