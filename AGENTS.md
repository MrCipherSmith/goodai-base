# AGENTS Rule Index

## Purpose

This file is the single always-on rule for the repository rule system.
It defines global behavior and tells the agent how to select the required rule files from `rules/core` OR invoke appropriate skills from `Skills Catalog`.

---

## 🎯 QUICK DECISION GUIDE

**When user asks for analysis/investigation → Use SKILLS**
**When user asks for coding standards/review guidelines → Use RULES**

| User Request Type                                          | Action                             | Examples                                       |
| ---------------------------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| "Implement issue...", "Issue to PR..."                     | **ASK: orchestrator or direct?**   | "Implement issue #4141", "Auto-implement"      |
| "Analyze...", "Study...", "Investigate..."                 | **ASK: orchestrator or direct?**   | "Analyze branch", "Study pipeline changes"     |
| "Review code...", "Check style..."                         | **ASK: orchestrator or direct?**   | "Review my code", "Check architecture"         |
| "Full review", "Full implementation", "Orchestrate..."     | **Job Orchestrator directly**      | "Полное ревью", "Run pipeline"                 |
| Explicit skill name (e.g., "Run feature-analyzer")         | **Invoke named skill directly**    | "Use feature-analyzer", "Run feature-analyzer" |
| "Add PR description", "Document PR", "Create issue for PR" | **`pr-issue-documenter` directly** | "Describe PR changes", "Update PR and issue"   |
| "Write PRD", "Plan project", "Create spec", "gproject"     | **ASK: quick PRD or full pipeline?** | `prd-creator` (fast) vs `gproject-orchestrator` (full) |
| "How to write...", "Standards for..."                      | **Check Core Rule Catalog**        | "How to write DTOs", "Git commit format"       |
| "Create...", "Add..." (with specific type)                 | **Check Core Rule Catalog**        | "Create documentation", "Add pipeline step"    |
| "Change model", "Use different model", "Switch model"      | **Check Model Selection**          | "Use GPT-5 for sub-agent", "Switch to claude"  |

> **Orchestrator Routing Rule:** When the user does NOT explicitly name a specific skill
> (e.g., "run code-ai-review", "use feature-analyzer"), and the request CAN be handled
> by `job-orchestrator` (review, analyze, implement), the agent **MUST ask** the user:
>
> - **Job Orchestrator** — persistent documentation in `jobs/`, structured report, full traceability
> - **Skill directly** — quick execution, no persistent documentation
>
> If the user explicitly names a skill → invoke it directly, skip this question.
> If the request clearly implies orchestration ("full review", "полное ревью", "orchestrate") → go to `job-orchestrator` directly.

---

## 📚 Understanding Rules vs Skills

### What are RULES? (in `rules/core/*.mdc`)

- **Reference documentation** for coding standards and workflows
- **Guidelines** on HOW to write code, format commits, structure docs
- **Static** - don't change based on context
- **Used for**: learning conventions, checking compliance, understanding patterns

**Rule Examples:**

- `nestjs-dto.mdc` - How to write NestJS DTOs
- `code-style-patterns.mdc` - Architecture patterns for TS/React/MobX
- `commit-message-formatting.mdc` - How to format commit messages

### What are SKILLS? (in `skills/*/`)

- **Actionable procedures** for complex multi-step tasks
- **Intelligent agents** that perform analysis, reviews, investigations
- **Dynamic** - adapt to user context and repository state
- **Used for**: analyzing code, reviewing changes, investigating features

**Skill Examples:**

- `feature-analyzer` - Deep analysis of feature branches across repos
- `pr-review-comments` - Analyze PR review comments

---

## 🔍 SELECTION PROTOCOL (Step-by-Step)

### Step 1: Analyze User Intent

Identify what user wants to do:

**Intent: ANALYZE / INVESTIGATE / REVIEW / IMPLEMENT**
→ Go to **Step 1.5** (Orchestrator Routing Check)

**Intent: LEARN / CREATE (with standards)**
→ Go to **Core Rule Catalog** (skip orchestrator check)

### Step 1.5: Orchestrator Routing Check

Before dispatching to a specific skill, check if the user **explicitly named** a skill:

```
IF user explicitly named a skill (e.g., "run code-ai-review", "use feature-analyzer"):
  → Go directly to Step 2A with that skill. SKIP orchestrator question.

ELSE IF request clearly implies orchestration ("full review", "полное ревью", "issue to PR", "orchestrate"):
  → Go directly to job-orchestrator. SKIP question.

ELSE (user did NOT name a specific skill, e.g., "review my code", "analyze branch"):
  → ASK the user:
    ○ Job Orchestrator — persistent docs in jobs/, structured report, full traceability (Recommended)
    ○ Run skill directly — quick execution, no persistent docs

  IF user chooses orchestrator → Load job-orchestrator skill
  IF user chooses direct → Go to Step 2A to match the appropriate skill
```

**Orchestratable intents:** `implement`, `analyze`, `review`
**Non-orchestratable:** `pr-review-comments`, `pr-issue-documenter` (specialized domain skills — always direct)

### Step 2A: If Using Skills (Analysis Tasks)

**MATCH user request to skill description:**

> **Skill description format:** All skill `description:` fields use trigger-condition format — they say "Use when X", not "This skill does X". Match user intent against these trigger conditions, not against workflow summaries.

```
User: "Analyze everything related to variables in pipelines"

Step 1.5: User did NOT name a specific skill → ASK orchestrator or direct?
User chooses: direct

SCAN Skills Catalog:
✓ feature-analyzer - "Cross-repository analysis... Use when: backend→frontend
  planning, cross-repo feature analysis"

→ MATCH! Load feature-analyzer skill
→ Follow skill instructions
```

**Skill Selection Examples:**

| User Request                         | Correct Action                                                       | Why                                  |
| ------------------------------------ | -------------------------------------------------------------------- | ------------------------------------ |
| "Implement issue #4141"              | **ASK:** `job-orchestrator` or `issue-analyzer` + `task-implementer` | User didn't name skill — ask first   |
| "Full implementation", "Issue to PR" | `job-orchestrator`                                                   | Implies orchestration — go directly  |
| "Analyze branch changes"             | **ASK:** `job-orchestrator` or `feature-analyzer`                    | User didn't name skill — ask first   |
| "Use feature-analyzer on branch X"   | `feature-analyzer`                                                   | User explicitly named skill — direct |
| "Analyze variables in pipelines"     | **ASK:** `job-orchestrator` or `feature-analyzer`                    | User didn't name skill — ask first   |
| "Decompose issue into tasks"         | **ASK:** `job-orchestrator` or `issue-analyzer`                      | User didn't name skill — ask first   |
| "Review my code changes"             | **ASK:** `job-orchestrator` or `feature-analyzer`                    | User didn't name skill — ask first   |
| "Full review", "Полное ревью"        | `job-orchestrator`                                                   | Implies orchestration — go directly  |
| "Analyze PR comments"                | `pr-review-comments`                                                 | Specialized domain skill — direct    |
| "Add PR description", "Document PR"  | `pr-issue-documenter`                                                | Specialized domain skill — direct    |
| "Create issue for PR changes"        | `pr-issue-documenter`                                                | Specialized domain skill — direct    |

### Step 2B: If Using Rules (Standards/Reference)

**MATCH user request to rule description:**

```
User: "How should I write NestJS DTOs?"

SCAN Core Rule Catalog:
✓ nestjs-dto.mdc - "NestJS DTO and validation annotation standards"

→ MATCH! Read nestjs-dto.mdc rule
→ Follow guidelines
```

---

## 📖 Core Rule Catalog

Reference guidelines for coding standards and workflows:

**Documentation & Planning:**
- `core/documentation-management.mdc`: Documentation lifecycle and multilingual doc structure in `<PROJECT_DIR>/docs` (default) or `$GOODAI_DOCS_ROOT`.
- `core/jobs-documentation.mdc`: Job documentation structure and conventions for `~/goodai-base/jobs`. Used by `job-orchestrator` and `job-documenter`.
- `core/implementation-plans.mdc`: Implementation plan format and storage.
- `core/requirements-management.mdc`: Requirements document workflow and structure.

**Code Quality & Style:**

- `core/code-style-patterns.mdc`: Architecture and style patterns for TS/React/MobX.
- `core/frontend-assistant.mdc`: Frontend delivery standards for TS/React/MobX/AntD/Tailwind.
- `core/mobx-store-template.mdc`: Reference structure for MobX stores.
- `core/nestjs-dto.mdc`: NestJS DTO and validation annotation standards.

**Engineering Standards (Language-Agnostic):**
- `core/solid-principles.mdc`: SOLID principles for agent-generated code — Single Responsibility, Open/Closed, Dependency Inversion. Iron Laws + Red Flags table.
- `core/error-handling.mdc`: Result pattern, typed domain errors, no silent failures, no unhandled rejections.
- `core/api-contracts.mdc`: OpenAPI-first design, semantic versioning, no breaking changes without major version bump.
- `core/clean-architecture.mdc`: Layer isolation, dependency direction, no cross-layer leakage (domain must not import frameworks).
- `core/database-patterns.mdc`: No N+1 queries, indexes before deploy, backward-compatible migrations, transactions.
- `core/security-baseline.mdc`: No secrets in code, parameterized queries, input validation, dependency hygiene.
- `core/async-patterns.mdc`: Promise.all for parallelism, mandatory timeouts, no unhandled rejections, no event loop blockage.

**Implementation Process:**
- `core/implementation-doc-mandate.mdc`: Mandatory documentation for all implementing agents — spec before code, change report after. Covers all agents: job-orchestrator, feature-dev, task-implementer. Iron Laws + Red Flags table.

**Review & Testing:**

- `core/code-review-ai-assistant.mdc`: Default AI code review baseline.
- `core/code-review-boss-profile.mdc`: boss-style review profile and tone constraints.
- `core/playwright-testing.mdc`: Playwright E2E testing standards, UI verification, and visual regression workflows.
- `core/storybook-guidelines.mdc`: Storybook authoring and review standards.
- `core/tdd-workflow.mdc`: Red-green-refactor cycle, test-first mandate, no-done-without-green invariant. Loaded with `task-implementer` and `tests-creator`.

**Development Workflow:**

- `core/git-rules.mdc`: Commit safety, protected paths, and apply-changes gate.
- `core/commit-message-formatting.mdc`: Conventional commit format policy.
- `rules/core/subagent-status-protocol.md` — Subagent response format: required STATUS: prefix, four status types (DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT), orchestrator handling logic
- `rules/core/subagent-context-construction.md` — Explicit context construction for orchestrator→subagent dispatches: required fields, minimality principle, dispatch template


**System Management:**

- `core/rule-management-workflow.mdc`: Add/edit/sync workflow for rule files and rule metadata.
- `core/skills-storage-workflow.mdc`: Skill authoring best practices and sync workflow for Cursor, Codex, Zed, OpenCode.
- `core/model-selection.mdc`: Model selection workflow for sub-agents. Run `detect-models.sh` to see available models.

---

## 🎨 Skills Catalog

Intelligent agents for complex analysis and review tasks:

### Analysis & Investigation Skills

**`skills/feature-analyzer`** ⭐ PRIMARY FOR ANALYSIS

- **Purpose**: Deep cross-repository analysis of feature branches
- **Use When**:
  - "Analyze branch changes"
  - "Study pipeline changes"
  - "Investigate feature implementation"
  - "Analyze [topic] in [area]" (e.g., "variables in pipelines")
- **Key Features**:
  - Source→Target repository analysis
  - Focus-based prioritization (e.g., "variables in pipelines")
  - P0/P1/P2 file selection
  - Gherkin format for AI agents
  - REQUIRES explicit user context (source/target/branch)
- **Version**: v2.4.0
- **Trigger Examples**:
  - "Analyze everything related to variables in pipelines"
  - "Study backend changes for frontend implementation"
  - "Cross-repo analysis"

### Code Review Skills

**`skills/code-ai-review`**

- **Purpose**: General AI code review — correctness, type safety, security, performance, error handling
- **Use When**: "Review code changes", "Check my code", "AI code review"
- **Key Features**: Focuses on P0 (correctness/security), P1 (architecture), P2 (style); follows `code-review-ai-assistant.mdc`; outputs structured findings with severity/file/line/suggestion
- **Output**: JSON findings object (blocker/major/minor severities)
- **Invoked by**: `job-orchestrator` review loop, or directly

**`skills/code-boss-review`**

- **Purpose**: Direct logic-first review in boss style — architecture, layer correctness, no duct-tape code
- **Use When**: "boss review", "b091 review", "logic review", called by `job-orchestrator` review loop
- **Key Features**: Logic in correct layer, inter-store callbacks must be `private`, no premature optimization; follows `code-review-b091-profile.mdc`
- **Output**: JSON findings object

**`skills/code-style-review`**

- **Purpose**: Code style and architecture review — TypeScript strictness, MobX patterns, React structure
- **Use When**: "Style review", "Architecture check", called by `job-orchestrator` review loop
- **Key Features**: No `any` types, proper MobX observable/action patterns, naming conventions; follows `code-style-patterns.mdc`
- **Output**: JSON findings object

**`skills/code-mobx-store-review`**

- **Purpose**: Targeted MobX store review — member ordering, accessibility modifiers, action binding, bidirectional sync
- **Use When**: Store files modified (`.store.ts`), called by `job-orchestrator` when MobX files detected
- **Key Features**: Member ordering rules, no `public` keyword, `makeObservable(this)` in constructor, `runInAction` after `await`, bounce protection for bidirectional sync
- **Output**: JSON findings object

### Implementation & Orchestration Skills

**`skills/job-orchestrator`** ⭐ PRIMARY FOR ORCHESTRATION

- **Purpose**: Dynamic orchestrator that builds execution plans based on user intent
- **Use When**:
  - "Implement issue #N"
  - "Issue to PR"
  - "Analyze and implement"
  - "Run full implementation pipeline"
  - "Auto-implement issue"
  - "Full review", "Полное ревью"
  - "Review my code" (when user chooses orchestrator at Step 1.5)
  - "Analyze branch" (when user chooses orchestrator at Step 1.5)
  - Any request where user confirms orchestrated execution via Step 1.5
- **Key Features**:
  - 4-phase dynamic pipeline: Context Collection → Plan Building → Execution → Completion
  - Intent-driven: adapts plan to implement, analyze, review, or custom workflows
  - **Wave-based execution**: tasks grouped into dependency waves, each wave runs as isolated sub-agent — prevents context freeze on large jobs
  - **State resumption**: checks `state.json` on start, offers to resume interrupted jobs
  - Dispatches issue-analyzer, context-collector, tests-creator, task-implementer, code-verifier, and review skills as sub-agents
  - Persistent job documentation via job-documenter in `jobs/<job-name>/`
  - Dynamic plan extension (e.g., analyze → user confirms → implement)
  - Review-fix loop (max 3 iterations)
  - Draft PR proposal with user confirmation
  - Post-implementation sanity check (verifies commits exist before review)
  - Dry-run mode (`--dry-run`): full plan without executing
- **Version**: v3.2.0

**`skills/job-documenter`**

- **Purpose**: Creates and maintains structured job documentation in `jobs/`
- **Use When**: Called by `job-orchestrator` — NOT invoked directly by users
- **Actions**: init (create job folder), add-document, update-readme, finalize
- **Standards**: `core/jobs-documentation.mdc`
- **Output**: Persistent documentation in `~/goodai-base/jobs/<job-name>/`

**`skills/context-collector`**

- **Purpose**: Collects, summarizes, and maintains a unified context document for a job
- **Use When**:
  - "Collect context", "Build context", "Gather context"
  - Called by `job-orchestrator` after analysis, before implementation
  - Called again when sub-agents need additional context (e.g., new library discovered)
  - Can also be invoked directly by user for standalone research
- **Key Features**:
  - 5-phase workflow: Receive → Local → External → Synthesize → Document
  - Gathers local docs (`docs/`, `jobs/`, `rules/core/`), codebase patterns, external library docs
  - Fetches best practices via web for identified libraries and patterns
  - Produces a single `context.md` in `jobs/<job-name>/` (both `man/` and `ai/`)
  - Version-tracked updates — can be refreshed during job lifecycle
- **Version**: v1.0.0

**`skills/issue-analyzer`**

- **Purpose**: Decompose GitHub issue into atomic implementation tasks
- **Use When**: "Analyze issue", "Decompose issue", "Break down issue"
- **Output**: JSON object with `issue` metadata, `tasks` array (each with task_id, target_files, acceptance_criteria, context, module_patterns, `requires_tests_creator: true`), and `dependency_order`
- **Scope**: Read-only analysis, no code modifications
- **Version**: v1.1.0 — tasks now include `requires_tests_creator` flag; orchestrator must dispatch `tests-creator` before `task-implementer`

**`skills/code-verifier`** ⭐ QUALITY GATE — RUNS AFTER TASK-IMPLEMENTER
- **Purpose**: Full quality gate: lint, type-check, tests, circular import detection
- **Use When**:
  - Dispatched by `job-orchestrator` after task-implementer wave (mandatory)
  - Dispatched again after fix iterations (mandatory)
  - "Run verification", "Quality gate", "Run lint and tests", "Verify implementation"
  - Standalone: `/code-verifier` or "check code quality"
- **Key Features**:
  - Auto-detects PM (bun/pnpm/npm/yarn/python/go) and available tools
  - Runs ALL checks — never aborts early even if one fails
  - Classifies findings: CRITICAL (type errors, test failures) / HIGH (lint errors, cycles) / LOW (warnings)
  - Gate: FAIL if any CRITICAL or HIGH; PASS_WITH_WARNINGS for LOW only
  - Scope: changed files by default (faster), full project with `--scope full`
- **Pipeline position**: task-implementer → **code-verifier** → review
- **Output**: `VERIFICATION_RESULT` with gate status, per-check results, structured findings
- **Version**: v1.0.0

**`skills/tests-creator`** ⭐ TDD — RUNS BEFORE TASK-IMPLEMENTER
- **Purpose**: Converts acceptance criteria into failing test stubs (RED phase of TDD) before any implementation code is written
- **Use When**:
  - Orchestrator dispatches before `task-implementer` for each task (mandatory in TDD pipeline)
  - "Create tests", "Write tests first", "Generate test specs", "TDD test stubs"
  - Task object contains `requires_tests_creator: true` (always true from issue-analyzer v1.1.0+)
- **Key Features**:
  - Detects test framework from project (vitest/jest/pytest/bun:test)
  - Maps each acceptance criterion to happy path + edge cases + error path tests
  - Writes forward-declared test stubs that fail until implementation
  - Commits test files and verifies RED state before reporting
  - Emits `test_case_specs` block for task-implementer consumption
- **Pipeline position**: issue-analyzer → **tests-creator** → task-implementer
- **Output**: Committed test files (RED) + `TEST_CASE_SPECS` report
- **Version**: v1.0.0

**`skills/task-implementer`**
- **Purpose**: Implement a single atomic task from issue-analyzer, following TDD when test stubs are provided
- **Use When**: "Implement task", "Execute task scenario"
- **Features**: 6-phase workflow (Receive → Research → Plan → Implement → Verify → Report); TDD mode when `test_case_specs` provided (makes RED tests GREEN); standard mode writes tests first
- **Input**: JSON task object from issue-analyzer + optional `test_case_specs` from tests-creator + workspace context
- **Output**: JSON result with status, files_modified, files_created, commits, lint_result, type_check_result, test_result, acceptance_criteria_met
- **Version**: v1.1.0 — TDD mode added; reads `test_case_specs` from tests-creator when present

### Git Workflow Skills

**`skills/commit`**
- **Purpose**: Smart git commit — auto-stages changes, analyzes diff, generates conventional commit message
- **Use When**: "/commit", "Commit changes", "Commit this"
- **Key Features**: Conventional commit format; selective staging; never stages secrets; adapts to repo's commit style
- **Args**: custom message, `--amend`, `-a`

**`skills/push`**
- **Purpose**: Smart git push with safety checks
- **Use When**: "/push", "Push changes", "Push to remote"
- **Key Features**: Auto-sets upstream; protects main/master from force push; warns on uncommitted changes

**`skills/pr`**
- **Purpose**: Smart Pull Request creation from branch changes
- **Use When**: "/pr", "Create PR", "Open pull request"
- **Key Features**: Analyzes ALL branch commits; structured body (Summary/Changes/Test plan); auto-pushes if needed
- **Args**: `--draft`, `--base <branch>`, custom title

**`skills/code-review`**
- **Purpose**: Comprehensive code review with 4 parallel agents (correctness, security, performance, style)
- **Use When**: "/code-review", "Full review", "Review PR", "Comprehensive review"
- **Key Features**: 4 agents run in parallel; unified severity report (CRITICAL/HIGH/MEDIUM/LOW); optional auto-fix for low-severity; can post to GitHub PR
- **Args**: PR number, `--fix`

**`skills/feature-dev`**
- **Purpose**: 8-phase feature development — requirements+spec → design → prepare → tests-creator → implement → verify → review → deliver+report
- **Use When**: "/feature-dev", "Develop feature", "Build feature from scratch"
- **Key Features**: Saves spec before code; TDD via tests-creator (Phase 4, mandatory); code-verifier gate (Phase 6, mandatory); change report at end; autonomous Phases 4-7
- **Version**: v2.0.0
- **Args**: description, `#<issue>`, `--resume`

### Workflow & DevOps Skills

**`skills/deploy`**
- **Purpose**: Automated deployment pipeline — tests → build → deploy, with health check
- **Use When**: "Deploy", "Deploy to staging/production", "Ship it", "Release"
- **Key Features**: Auto-detects Docker Compose / PM2 / SSH / Vercel; stops on test/build failure; post-deploy verification
- **Args**: target env (default: production), `--skip-tests`, `--dry-run`, `--rollback`

**`skills/changelog`**
- **Purpose**: Generate structured changelog from git commits between tags or date ranges
- **Use When**: "Generate changelog", "Release notes", "What changed since v1.0"
- **Key Features**: Groups by conventional commit type; extracts PR/issue references; supports `--prepend` to CHANGELOG.md

**`skills/db-migrate`**
- **Purpose**: Database migration lifecycle — create, apply, rollback, status
- **Use When**: "Create migration", "Run migrations", "Migration status", "Rollback migration"
- **Key Features**: Auto-detects Drizzle / Prisma / Knex / raw SQL; scaffolds SQL from migration name

**`skills/dependency-update`**
- **Purpose**: Safe dependency updates with compatibility checks and test verification
- **Use When**: "Update dependencies", "Upgrade packages", "Bump versions"
- **Key Features**: patch/minor auto; major requires analysis; always tests after update; rollback on failure

### Quality & Analysis Skills

**`skills/security-audit`**
- **Purpose**: Security audit — dependency vulnerabilities, secrets scan, Docker image scan
- **Use When**: "Security audit", "Check vulnerabilities", "Audit dependencies"
- **Key Features**: Detects bun/npm/yarn; groups by severity; scans git history for leaked secrets

**`skills/perf-check`**
- **Purpose**: Performance analysis — bundle size, slow queries, async patterns, memory
- **Use When**: "Performance check", "Bundle size", "Slow queries", "Perf audit"
- **Key Features**: N+1 detection, await-in-loop scan, pgvector index check, Docker stats

**`skills/test-gen`**
- **Purpose**: Auto-generate tests for a file or module matching existing project patterns
- **Use When**: "Generate tests for", "Write tests for", "Add test coverage"
- **Key Features**: Discovers test framework and patterns; covers happy path + edge cases + errors; runs generated tests to verify

### Project Documentation Skills (gproject)

> **Sub-domain purpose**: Transform a project idea or feature request into a complete, validated specification ready for implementation. `gproject` covers the gap between "we have an idea" and "we have an implementable PRD + roadmap" — using a decision-driven pipeline where each phase constrains the next.

#### Pipeline Overview

```
Phase 0  gproject-discovery          → discovery-brief.md
Phase 1  gproject-problem-definer    → problem-statement.md
Phase 2  gproject-stack-advisor      → stack-decision.md          ← Human gate
Phase 3  gproject-patterns-researcher→ architecture.md + tech-bestpractices.md  ← Human gate
Phase 4  gproject-spec-writer        → prd.md (or implementation-plan.md)
Phase 5  gproject-consistency-checker→ consistency-report.md      ← Human approval
Phase 6  gproject-planner            → roadmap.md
```

All decisions accumulate in `decisions.md` (append-only registry). No phase overwrites a prior decision — it may only invalidate it (triggers rollback). Contract spec: `rules/core/gproject-contracts.mdc`.

#### Modes

| Mode | When | Difference |
|------|------|-----------|
| `new_project` | Building from scratch | Full 7-phase pipeline, interview at Phase 0 |
| `task_in_project` | Feature in existing codebase | context-collector replaces interview, shorter PRD format |

---

**`skills/gproject-orchestrator`** ⭐ ENTRY POINT

- **Purpose**: Thin routing orchestrator — drives the 7-phase pipeline, manages decisions registry, enforces human gates, handles state resumption
- **Use When**:
  - "Create project documentation", "Write PRD", "Spec out feature", "Plan project"
  - "gproject", "Создай документацию проекта", "Напиши PRD для...", "Нужен тех. план"
  - Any request involving structured project planning, specification, or architecture documentation
- **Key Features**:
  - 7-phase pipeline with human gates at Phase 2, 3, and 5
  - `decisions.md` append-only registry — single source of truth for all choices
  - Context-budget discipline: subagents write artifacts to files, return ≤150 token summaries
  - NEEDS_CONTEXT loop: structured A/B/C/D questions, max 2 rounds per phase
  - State resumption from interrupted jobs (`state.json`)
  - Responds in user's language; decision keys always in English
  - Reuses: `interview` (Phase 0), `context-collector` (task_in_project), `brainstorm` (Phase 2 optional), `job-documenter`
- **Final deliverable**: `roadmap.md` — milestones, task breakdown, dependency graph, and effort estimates; what happens after is up to the team
- **Version**: v1.0.0
- **vs `prd-creator`**: Quick, single-pass → `prd-creator`. Full pipeline with stack decisions, architecture constraints, consistency review, roadmap → `gproject-orchestrator`. When unclear, ask:
  - A) Quick PRD only (`prd-creator`) — no persistent docs, no roadmap
  - B) Full pipeline (`gproject-orchestrator`) — recommended for new projects or complex features

---

**Subagents (dispatched by orchestrator only — NOT invoked directly by user):**

| Phase | Skill | Input | Output | Human Gate |
|-------|-------|-------|--------|-----------|
| 0 | `gproject-discovery` | User input + docs + repo (optional) | `discovery-brief.md` | — |
| 1 | `gproject-problem-definer` | `discovery-brief.md` | `problem-statement.md` | — |
| 2 | `gproject-stack-advisor` | `problem-statement.md` | `stack-decision.md` | ✅ |
| 3 | `gproject-patterns-researcher` | `stack-decision.md` + `problem-statement.md` | `architecture.md` + `tech-bestpractices.md` | ✅ |
| 4 | `gproject-spec-writer` | `problem-statement.md` + `architecture.md` + `tech-bestpractices.md` | `prd.md` | — |
| 5 | `gproject-consistency-checker` | All artifacts + `decisions.md` | `consistency-report.md` | ✅ |
| 6 | `gproject-planner` | `prd.md` + `architecture.md` | `roadmap.md` | — |

Subagent notes:
- `gproject-stack-advisor` may call `brainstorm` in parallel for architecture exploration
- `gproject-spec-writer` makes NO new decisions — fully constrained by phases 0-3
- `gproject-consistency-checker` adversarially validates all constraints; returns `DONE_WITH_CONCERNS` if CRITICAL violations found
- `gproject-planner` output includes DAG of task dependencies, effort estimates (optimistic/realistic/pessimistic), and critical path; `roadmap.md` is the final pipeline deliverable

---

**`skills/prd-creator`**
- **Purpose**: Quick single-pass PRD — transforms unstructured request into a formal, testable Product Requirements Document
- **Use When**: "Create a PRD", "Draft PRD", "Write product requirements" — fast result without full pipeline
- **vs `gproject-orchestrator`**: No stack/architecture decisions, no consistency review, no roadmap — simpler and faster
- **Modes**: Direct (user) or Orchestrated (called by another agent)

---

### gproject Routing Rules

| User Request | Action |
|-------------|--------|
| "Write PRD for...", "Plan project..." | **ASK**: `prd-creator` (quick) or `gproject-orchestrator` (full pipeline)? |
| "Create spec for feature in our app" | `gproject-orchestrator` (task_in_project mode) |
| "gproject" | `gproject-orchestrator` directly |
| "Analyze project requirements" | **ASK**: `gproject-orchestrator` or `feature-analyzer`? |
| "Review PRD consistency" | `gproject-consistency-checker` (can run standalone) |

**Disambiguation:**
- "Implement issue #N" → `job-orchestrator` (code implementation, NOT gproject)
- "Analyze branch changes" → `feature-analyzer` (code analysis, NOT gproject)
- "Plan project from scratch" → `gproject-orchestrator`
- `gproject-orchestrator` scope ends at `roadmap.md` — code implementation is a separate concern

---

### Meta / Context Skills

**`skills/brainstorm`**
- **Purpose**: Structured brainstorming — architecture decisions, problem solving, open exploration
- **Use When**: "Brainstorm", "Explore options", "Architecture decision", "How should I approach X"
- **Key Features**: 3 modes (architecture/problem-solving/creative); 3 parallel agents (Pragmatist/Innovator/Critic); ends with concrete recommendation
- **Invoked by**: user directly; or any skill needing design exploration

**`skills/interview`**
- **Purpose**: Critical requirements interviewer — asks targeted questions one-by-one with answer options before expensive operations
- **Use When**: "/interview", "Clarify requirements", "Ask questions first"; called by `job-orchestrator`/`feature-dev`/`prd-creator` as Phase 0
- **Key Features**: One question at a time; A/B/C/D options; adapts follow-ups; skips answered questions; can trigger mini-brainstorm on ambiguous points; max 7 questions
- **Input**: `{goal, context, domain, caller, known_facts}` from calling skill, or plain text from user
- **Output**: `{decisions, constraints, assumptions, risks, refined_goal}`
- **Invoked by**: `job-orchestrator` Phase 0; `feature-dev` Phase 1; or directly by user

### Configuration Skills

**`skills/hookify`**
- **Purpose**: Create agent hooks from natural language descriptions
- **Use When**: "/hookify", "Create hook", "Add hook", "Run lint after edit"
- **Key Features**: Parses natural language to hook config; supports PreToolUse/PostToolUse/Stop events; previews before applying

**`skills/claude-md-management`**
- **Purpose**: Capture session learnings and persist into CLAUDE.md files
- **Use When**: "/revise-claude-md", "Update CLAUDE.md", "Save learnings"
- **Key Features**: Classifies insights into project/global/personal CLAUDE.md; diff preview before applying; avoids duplication

### PR & Comments Skills

**`skills/pr-review-comments`**

- **Purpose**: Analyze PR review comments
- **Use When**: "Analyze PR comments", "What did reviewers say?"
- **Features**: Groups by author, suggests fixes, proposes rule updates

**`skills/pr-issue-documenter`**

- **Purpose**: Generate structured PR descriptions and issue documentation from branch changes
- **Use When**:
  - "Add PR description", "Document PR"
  - "Create issue for PR", "Update issue from PR changes"
  - "Describe PR changes", "Update PR and issue"
- **Key Features**:
  - 7-step workflow: Parse Input → Collect Context → Analyze Changes → Generate PR Description → Handle Issue → Apply Changes → Verify
  - Concise PR descriptions (Summary + Changes by area + Key Files table)
  - Detailed issue descriptions (numbered sections with technical details)
  - Contradiction detection when updating existing issue content
  - Sub-issue creation under parent issues
  - Asks before overwriting existing content
- **Version**: v1.0.0

---

## ⚠️ CRITICAL: How to Use Skills (Step-by-Step)

### When User Requests Analysis (e.g., "Analyze variables in pipelines"):

```
1. IDENTIFY intent: User wants ANALYSIS → Use SKILLS

2. ORCHESTRATOR ROUTING CHECK (Step 1.5):
   - User did NOT name a specific skill
   - Request CAN be handled by job-orchestrator
   → ASK user: orchestrator or direct?

   User chooses: direct → continue to step 3

3. SCAN Skills Catalog for match:
   - feature-analyzer: "Cross-repository analysis... Use when: backend→frontend planning"
   - context-collector: "Collects and maintains unified context document"

   → feature-analyzer MATCHES (analysis task)

4. LOAD skill from: ~/goodai-base/skills/feature-analyzer/SKILL.md

5. FOLLOW skill instructions EXACTLY:
   - Skill has guard clause → MUST ask for source/target/branch FIRST
   - Skill has focus support → Extract "variables" and "pipelines"
   - Skill has workflow → Follow step-by-step

6. DO NOT start analysis until skill says you can proceed
```

### When User Says "Full review" or implies orchestration:

```
1. IDENTIFY intent: User wants REVIEW → Use SKILLS

2. ORCHESTRATOR ROUTING CHECK (Step 1.5):
   - Request clearly implies orchestration ("full review")
   → Go directly to job-orchestrator. SKIP question.

3. LOAD skill from: ~/goodai-base/skills/job-orchestrator/SKILL.md

4. FOLLOW orchestrator workflow (Phase 0 → Phase 3)
```

### Common Mistakes to AVOID:

❌ **WRONG**: User says "Review my code" → immediately launch `feature-analyzer`
✅ **CORRECT**: User says "Review my code" → ASK: `job-orchestrator` (persistent docs) or `feature-analyzer` (quick)?

❌ **WRONG**: User says "Run feature-analyzer" → ask about orchestrator
✅ **CORRECT**: User says "Run feature-analyzer" → invoke `feature-analyzer` directly (user was explicit)

❌ **WRONG**: User says "Analyze branch changes" → immediately launch `feature-analyzer`
✅ **CORRECT**: User says "Analyze branch changes" → ASK: `job-orchestrator` or `feature-analyzer`?

❌ **WRONG**: User says "Use feature-analyzer" → ask about orchestrator
✅ **CORRECT**: User says "Use feature-analyzer" → invoke `feature-analyzer` directly (user was explicit)

❌ **WRONG**: User says "Full review" → launch single review skill
✅ **CORRECT**: User says "Full review" → go to `job-orchestrator` directly (implies orchestration)

❌ **WRONG**: User says "Analyze variables in pipelines" → Load code-style-review rule
✅ **CORRECT**: User says "Analyze variables in pipelines" → ASK: orchestrator or direct? Then load chosen skill

❌ **WRONG**: Start analyzing current directory without asking for context
✅ **CORRECT**: Ask for source/target/branch as required by feature-analyzer skill

❌ **WRONG**: Use rule when user wants action ("Review my code" → load code-style-patterns.mdc)
✅ **CORRECT**: Use skill when user wants action ("Review my code" → ASK orchestrator or skill)

---

## ⚠️ CRITICAL: Skill Execution Rule

### After loading ANY orchestrator/agent skill — you MUST invoke it via Task()

**This is the most common failure mode:**

```
❌ WRONG (what I did):
  1. skill(name: "job-orchestrator")
  2. Read the instructions
  3. Continue in SAME context, doing work manually

✅ CORRECT:
  1. skill(name: "job-orchestrator")
  2. Read instructions
  3. Task({
       description: "Run job-orchestrator: <task>",
       subagent_type: "general",
       prompt: "Load skill: skills/job-orchestrator/SKILL.md\n..."
     })
```

**Why this matters:**

- Skills define complex multi-step workflows (sub-agents, documentation, state)
- Doing the work manually bypasses all that infrastructure
- Results are not persisted, no traceability, no proper reports

**The pattern:**

```javascript
// After ANY skill() call that returns agent instructions:
Task({
  description: "<descriptive task name>",
  subagent_type: "general",
  prompt:
    "Load skill: skills/<skill-name>/SKILL.md\n<context>\nExecute the skill."
});
```

---

## 🔄 Selection Protocol Summary

1. **Read this file first** (AGENTS.md)
2. **Identify user intent**: Analysis/Review/Implement → Check orchestrator routing | Standards/Reference → Rules
3. **Orchestrator routing check** (Step 1.5): If user didn't name a specific skill → ASK: orchestrator or direct?
4. **Select appropriate resource**:
   - `job-orchestrator` if user chose orchestrator or request implies orchestration
   - Specific skill if user chose direct or explicitly named a skill
   - Core Rule Catalog for standards/guidelines
5. **Load and follow** selected resource exactly
6. **Do not load unrelated** resources
7. **When in doubt**, ask one clarification question
8. **When conflict**, prefer most task-specific resource

---

## 🛡️ Agent Discipline

Six improvements govern how agents and orchestrators behave in this system:

1. **Trigger-condition skill descriptions** — Every skill's `description:` field must describe WHEN to use the skill ("Use when X"), not what the skill does. The agent reads this field to decide whether to load the skill; a workflow summary gives no routing signal.

2. **Anti-rationalization guards** — Key skills and rules contain Red Flags tables and Iron Laws. These are non-negotiable constraints the agent must not rationalize around. If a Red Flag applies, stop and surface it to the user.

3. **SUBAGENT-STOP guards** — Meta-skills (orchestrators, task-distributors) carry `SUBAGENT-STOP` tags at the top of their body. A subagent that encounters this tag must halt and return `STATUS: BLOCKED` — it is not permitted to self-invoke orchestrator workflows.

4. **Subagent status protocol** — Every subagent response must begin with `STATUS: <type>`. Valid types: `DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, `NEEDS_CONTEXT`. Orchestrators read this prefix before deciding next action. See `rules/core/subagent-status-protocol.md`.

5. **Two-stage review** — Code review skills run Stage 1 (spec compliance: does the code do what was specified?) before Stage 2 (code quality: is it well-written?). Stage 2 may not begin until Stage 1 produces a passing result or explicit waiver.

6. **Explicit context construction** — Orchestrators must build an explicit context block for every subagent dispatch. Subagents must not infer context from conversation history. Each dispatch is self-contained. See `rules/core/subagent-context-construction.md`.

---

## Global Contract

- All rule files are authored in English.
- Final user-facing deliverables MUST be in Markdown.
- Any code snippet MUST be inside fenced Markdown code blocks.
- The response language MUST follow the language of the user query.
- Load only the minimum set of rules/skills required for the current task.

---

## Maintenance Rules

- Add new thematic rules only under `rules/core` as `.mdc`.
- Add new skills under `~/goodai-base/skills/<skill-name>/`.
- Keep this file updated with descriptions when rules/skills added/renamed/removed.
- Source of truth: `~/goodai-base/AGENTS.md` (this file). `AGENTS.mdc` wraps it with frontmatter for Cursor.
- `sync-skills.sh` syncs `AGENTS.md` to all tool targets and syncs all skill profiles from `~/goodai-base/skills/`.
- `validate-skills-before-sync.sh` MUST run before `sync-skills.sh` for pre-sync validation.
- Scripts usage and schema details: `~/goodai-base/scripts/README.md`.

---

## Job Documentation
- Job documentation root: `~/goodai-base/jobs/`
- Structure and conventions: `rules/core/jobs-documentation.mdc`
- Created and maintained by `job-documenter` skill, driven by `job-orchestrator`
