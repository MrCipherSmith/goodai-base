# Testing Context

generatedAt: 2026-07-21T15:11:32.233Z

## Frameworks

- none

## Scripts

- none

## Configs

- scripts/tsconfig.json

## Test Files

- hooks/skill-eval.test.js
- scripts/tests/deploy-skill-hook.test.ts
- scripts/tests/detect-context.test.ts
- scripts/tests/detect-models.test.ts
- scripts/tests/generate-agents.test.ts
- scripts/tests/generate-codex-plugins.test.ts
- scripts/tests/generate-rules-catalog.test.ts
- scripts/tests/generate-rules-json.test.ts
- scripts/tests/generate-skill-catalog.test.ts
- scripts/tests/generate-skill-registry.test.ts
- scripts/tests/generate-zcode-plugin.test.ts
- scripts/tests/shared/agents-md.test.ts
- scripts/tests/shared/args.test.ts
- scripts/tests/shared/checksum.test.ts
- scripts/tests/shared/frontmatter.test.ts
- scripts/tests/shared/fs-utils.test.ts
- scripts/tests/shared/keywords.test.ts
- scripts/tests/sync-agents.test.ts
- scripts/tests/sync-skills.test.ts
- scripts/tests/validate-rules-json.test.ts
- scripts/tests/validate-skills-before-sync.test.ts


## CI

- .github/workflows/docs-sync.yml

## Conventions

- AGENTS.md: For commands, search, diff, test logs, lint/build output, and large file reads that can produce long output, use the Metaproject gdctx skill by default before loading raw command output into context.
- AGENTS.md: For creating, changing, debugging, reviewing, or running tests, use the Metaproject testing skill and read .metaproject/data/testing/context.md before broad test search or raw logs.
- AGENTS.md: | "Write PRD", "Plan project", "Create spec", "gproject"     | **ASK: quick PRD or full pipeline?** | `prd-creator` (fast) vs `gproject-orchestrator` (full) |
- AGENTS.md: | "Full spec", "BRD to TRD", "Pre-implementation docs", "Prepare spec with review" | **`spec-orchestrator` directly** | Full documentation pipeline with review loops |
- AGENTS.md: | "Create...", "Add..." (with specific type)                 | **Check Core Rule Catalog**        | "Create documentation", "Add pipeline step"    |
- AGENTS.md: > **Orchestrator Routing Rule:** When the user does NOT explicitly name a specific skill
- AGENTS.md: `review-orchestrator` - Code review (routes to specialized reviewers)
- AGENTS.md: Before dispatching to a specific skill, check if the user **explicitly named** a skill:
- AGENTS.md: ELSE (user did NOT name a specific skill, e.g., "review my code", "analyze branch"):
- AGENTS.md: Non-orchestratable:** `iago`, `review-pr-feedback`, `pr-issue-documenter` (specialized domain skills — always direct)
- AGENTS.md: Step 1.5: User did NOT name a specific skill → ASK orchestrator or direct?
- AGENTS.md: | "Full review", "Полное ревью"        | `review-orchestrator --all`                                          | Full code review = all specialized reviewers, NOT job pipeline |
- AGENTS.md: | "Analyze PR comments"                | `review-pr-feedback`                                                 | Specialized domain skill — direct    |
- AGENTS.md: | "iago", "/iago", "add PR diagram"    | `iago`                                                               | Specialized visualization skill — direct |
- AGENTS.md: | "Add PR description", "Document PR"  | `pr-issue-documenter`                                                | Specialized domain skill — direct    |
- AGENTS.md: | "Create issue for PR changes"        | `pr-issue-documenter`                                                | Specialized domain skill — direct    |
- AGENTS.md: Review & Testing:**
- AGENTS.md: `core/playwright-testing.mdc`: Playwright E2E testing standards, UI verification, and visual regression workflows.
- AGENTS.md: `core/tdd-workflow.mdc`: Red-green-refactor cycle, test-first mandate, no-done-without-green invariant. Loaded with `task-implementer` and `tests-creator`.
- AGENTS.md: Purpose**: Entry point — routes review request to specialized reviewers, dispatches in parallel, consolidates unified report
- AGENTS.md: | `review-logic` | Logic bugs, spec compliance, null-safety, async errors | blocker |
- AGENTS.md: | `review-testing-practices` | Repository-local unit/integration/MSW/Storybook/e2e testing discipline | blocker |
- AGENTS.md: | `review --testing-practices` | local testing/e2e conventions only |
- AGENTS.md: Dispatches issue-analyzer, context-collector, tests-creator, task-implementer, code-verifier, and review skills as sub-agents
- AGENTS.md: Output**: JSON object with `issue` metadata, `tasks` array (each with task_id, target_files, acceptance_criteria, context, module_patterns, `requires_tests_creator: true`), and `dependency_order`
- AGENTS.md: Version**: v1.1.0 — tasks now include `requires_tests_creator` flag; orchestrator must dispatch `tests-creator` before `task-implementer`
- AGENTS.md: Purpose**: Full quality gate: lint, type-check, tests, circular import detection
- AGENTS.md: "Run verification", "Quality gate", "Run lint and tests", "Verify implementation"
- AGENTS.md: Classifies findings: CRITICAL (type errors, test failures) / HIGH (lint errors, cycles) / LOW (warnings)
- AGENTS.md: `skills/tests-creator`** ⭐ TDD — RUNS BEFORE TASK-IMPLEMENTER

## Recommendations

- No test framework detected. Choose a project test stack explicitly before adding generated tests.
- No package.json test script detected. Add a canonical `test` script when the project test stack is chosen.
