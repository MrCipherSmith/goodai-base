---
name: feature-dev
description: "Use when taking a feature from idea or GitHub issue all the way to a merge-ready PR in one guided workflow."
triggers:
  - "/feature-dev"
  - "Develop feature"
  - "Build feature"
  - "Implement feature"
  - "Feature from scratch"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "workflow"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill entirely.
This skill is for interactive feature development sessions only.
Proceed directly with your assigned task.
</SUBAGENT-STOP>

# Feature Development (7-Phase)

End-to-end feature development workflow from idea to merge-ready PR.

## Arguments

- `/feature-dev <description>` — start from a text description
- `/feature-dev #<issue>` — start from a GitHub issue
- `/feature-dev --resume` — resume interrupted feature-dev (checks for existing worktree/branch)

## 7-Phase Architecture

### Phase 1: REQUIREMENTS
1. Parse input (description or GitHub issue via `gh issue view`)
2. Clarify ambiguities — ask the user up to 3 questions max
3. Produce a brief spec:
   - **What**: feature description in 2-3 sentences
   - **Why**: user value / business reason
   - **Scope**: what's in, what's explicitly out
   - **Acceptance criteria**: testable bullet points
4. **Get user confirmation before proceeding**

### Phase 2: DESIGN
1. Research the codebase:
   - Find related modules via search tools
   - Read neighboring implementations for patterns
   - Check existing tests for testing conventions
2. Produce implementation plan:
   - Files to create/modify (with brief description of changes)
   - Dependencies or packages needed
   - Data model changes if any
   - Estimated complexity: S / M / L
3. **Get user confirmation on the plan**

### Phase 3: PREPARE
1. Create a feature branch: `wt switch -c feat/<name>`
2. Install any new dependencies

### Phase 4: IMPLEMENT
1. Implement changes file by file, following the plan
2. Follow existing code patterns discovered in Phase 2
3. After each logical chunk, run available checks:
   - Lint: `npm run lint` or equivalent
   - Type-check: `npx tsc --noEmit` or equivalent
   - Fix issues immediately before moving on

### Phase 5: TEST
1. Write tests matching the project's testing patterns
2. Unit tests for new functions/modules
3. Integration tests for API/data flow changes
4. Run full test suite
5. Fix failing tests (max 3 attempts per test)

### Phase 6: REVIEW (Self)
1. Launch `code-review` skill on own changes (if available)
2. Or run a focused self-review:
   - `git diff main...HEAD` — review the full diff
   - Check for: TODOs left behind, console.logs, hardcoded values
   - Verify all acceptance criteria from Phase 1
3. Fix any findings (max 2 review-fix cycles)

### Phase 7: DELIVER
1. Final checks: lint + type-check + tests all pass
2. Commit with conventional message: `feat(<scope>): <description>`
3. Push branch
4. Create PR:
   - Link to issue if applicable
   - Include acceptance criteria as checklist
   - Add test plan
5. Report PR URL to user

## Status Updates

At each phase transition, report progress:
```
✅ Phase 1: Requirements confirmed
🔄 Phase 2: Designing implementation...
```

## Rules

- ALWAYS get user confirmation after Phase 1 (requirements) and Phase 2 (design)
- Phases 4-6 are autonomous — no user interaction needed
- If stuck for >3 attempts on any step, report the blocker and ask user
- NEVER skip Phase 5 (testing) even if user says "skip tests"
- NEVER commit broken code (lint/type-check must pass)
- Keep commits atomic: one commit per logical change, not one giant commit

## Red Flags — Stop and re-read this skill if you are thinking:

| Rationalization | Why it's wrong |
|---|---|
| "Requirements are clear enough, I'll skip the design phase" | Skipping design means discovering mismatches after code is written, not before |
| "The user already approved this approach verbally, no need to document" | Undocumented approval is invisible to reviewers and future agents; it doesn't exist |
| "Tests can be written after — implementation first to check if the approach works" | Writing tests after implementation makes you test what you built, not what was required |
| "This phase isn't needed for such a straightforward feature" | Every skipped phase is a deferred bug report |
| "I understand the requirements, confirmation is just a formality" | The confirmation step exists to catch the gap between what you understood and what was meant |

**IRON LAW: NEVER START IMPLEMENTING BEFORE REQUIREMENTS ARE EXPLICITLY CONFIRMED AND DOCUMENTED.**
