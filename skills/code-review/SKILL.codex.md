---
name: code-review
description: "Comprehensive code review with 4 parallel agents: correctness/logic, security, performance, style/maintainability. Produces unified severity report (CRITICAL/HIGH/MEDIUM/LOW). Use for thorough PR reviews and pre-merge checks."
triggers:
  - "/code-review"
  - "Full review"
  - "Review PR"
  - "Comprehensive review"
  - "4-agent review"
metadata:
  author: "goodea"
  version: "1.0.0"
  category: "review"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# Code Review (4-Agent)

Comprehensive code review that dispatches 4 specialized agents in parallel for deep analysis.

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
