# AGENTS Rule Index

<!-- keryx:index -->
## Metaproject

**HARD GATE:** Before the first shell command, search, grep, file read, code navigation, planning step, implementation, review, analysis, or subagent dispatch in this repository, explicitly read `.metaproject/index.md`. Do not treat it as a referenced/on-demand file; load it immediately when present.

This Metaproject block is optional project-local routing. If `.metaproject/index.md` or referenced Metaproject files are absent, state `metaproject: unavailable` and continue with the main contents of this AGENTS.md/CLAUDE.md file.

If you create or switch to a git worktree, repeat the hard gate in that worktree root before any repository action there.

The user does not need to know Metaproject command names. Treat natural-language requests as intents, route through `.metaproject/index.md`, then choose the right skill, rule, MCP tool/resource, or `keryx` CLI command yourself.

Do not dispatch subagents until the Metaproject hard gate is complete. Every subagent prompt must include the exact project/worktree root and require reading `<project-root>/.metaproject/index.md` before searching or reading code.

If MCP tools/resources are available for this project, prefer them for Metaproject capabilities because they provide structured tool calls. If MCP is unavailable or lacks a needed capability, fall back to the corresponding project-local skill and CLI command.

For project navigation, file discovery, and code-related tasks, use the Metaproject gdgraph skill by default before raw file search.

Any text, symbol, or pattern search over project code goes through `keryx ctx rg`, never a bare `rg`/`grep` — even a single targeted search, and even when gdgraph/gdwiki are skipped. Raw `rg`/`grep` is a last resort only, with a stated reason recorded in the routing audit.

For architecture, domain models, business rules, user scenarios, auth and other flows, integrations, and known decisions, consult the Metaproject gdwiki skill and read the wiki index before deep code reads; use gdgraph to move from a wiki concept to code.

For commands, search, diff, test logs, lint/build output, and large file reads that can produce long output, use the Metaproject gdctx skill by default before loading raw command output into context.

For a non-trivial navigation, debugging, review, or investigation task, end with a short routing audit: `graph_used`, `wiki_used`, `ctx_used`, and `raw_rg_used: yes/no`. An omitted layer must be justified (`not-relevant`/`unavailable`), not silently skipped.

For implementation, review, refactoring, planning, documentation, or quality tasks, use project-local Metaproject skills first: .metaproject/skills/catalog.md, .metaproject/project-skills/, then .metaproject/skills/gdskills/. External/global skills are fallback only when explicitly needed.

For creating, changing, debugging, reviewing, or running tests, use the Metaproject testing skill and read .metaproject/data/testing/context.md before broad test search or raw logs.

For lessons learned, decisions, constraints, repeated mistakes, and historical project context, use the Metaproject memory skill before broad documentation search.

For starting, tracking, or finishing a managed piece of work (a flow), use the Metaproject flow skill for state/status commands. For non-trivial implementation through Task Manager, use the local gdskills flow-orchestrator first: .metaproject/skills/gdskills/orchestration/flow-orchestrator/SKILL.md. All flow state changes go through the keryx flow CLI.

<!-- /keryx:index -->

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
| "Review code...", "Check style...", "Review my changes"    | **ASK: orchestrator or direct?**   | "Review my code", "Check architecture"         |
| "Full review", "Полное ревью", "Review --all", "Review everything" | **`review-orchestrator` directly** | "Full code review", "Полное ревью кода", "review --all" |
| "Full pipeline", "Issue to PR", "Implement + review"       | **Job Orchestrator directly**      | "Полный пайплайн", "Issue #N to PR"            |
| Explicit skill name (e.g., "Run feature-analyzer")         | **Invoke named skill directly**    | "Use feature-analyzer", "Run feature-analyzer" |
| "Add PR description", "Document PR", "Create issue for PR" | **`pr-issue-documenter` directly** | "Describe PR changes", "Update PR and issue"   |
| "Write PRD", "Plan project", "Create spec", "gproject"     | **ASK: quick PRD or full pipeline?** | `prd-creator` (fast) vs `gproject-orchestrator` (full) |
| "Full spec", "BRD to TRD", "Pre-implementation docs", "Prepare spec with review" | **`spec-orchestrator` directly** | Full documentation pipeline with review loops |
| "How to write...", "Standards for..."                      | **Check Core Rule Catalog**        | "How to write DTOs", "Git commit format"       |
| "Create...", "Add..." (with specific type)                 | **Check Core Rule Catalog**        | "Create documentation", "Add pipeline step"    |
| "Change model", "Use different model", "Switch model"      | **Check Model Selection**          | "Use GPT-5 for sub-agent", "Switch to claude"  |
| "/caveman", "terse mode", "short responses", "minimize tokens" | **`caveman-mode` skill directly** | "Short responses please", "Enable caveman mode" |

> **Orchestrator Routing Rule:** When the user does NOT explicitly name a specific skill
> (e.g., "run review-logic", "use feature-analyzer"), and the request CAN be handled
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
- `review-orchestrator` - Code review (routes to specialized reviewers)

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
IF user explicitly named a skill (e.g., "run review-logic", "use feature-analyzer"):
  → Go directly to Step 2A with that skill. SKIP orchestrator question.

ELSE IF request is "full review" / "полное ревью" / "review --all" / "review everything":
  → Go directly to review-orchestrator with --all flag. SKIP question.
  (This is a code review, not an implementation pipeline.)

ELSE IF request clearly implies implementation orchestration ("issue to PR", "implement issue", "full pipeline", "orchestrate implementation"):
  → Go directly to job-orchestrator. SKIP question.

ELSE (user did NOT name a specific skill, e.g., "review my code", "analyze branch"):
  → ASK the user:
    ○ Job Orchestrator — persistent docs in jobs/, structured report, full traceability (Recommended)
    ○ Run skill directly — quick execution, no persistent docs

  IF user chooses orchestrator → Load job-orchestrator skill
  IF user chooses direct → Go to Step 2A to match the appropriate skill
```

**Orchestratable intents:** `implement`, `analyze`, `review`
**Non-orchestratable:** `iago`, `review-pr-feedback`, `pr-issue-documenter` (specialized domain skills — always direct)

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
| "Review my code changes"             | **ASK:** `job-orchestrator` or `review-orchestrator`                 | User didn't name skill — ask first   |
| "Full review", "Полное ревью"        | `review-orchestrator --all`                                          | Full code review = all specialized reviewers, NOT job pipeline |
| "Review --frontend", "Review --all"  | `review-orchestrator` with flag                                      | Explicit review scope — direct       |
| "Analyze PR comments"                | `review-pr-feedback`                                                 | Specialized domain skill — direct    |
| "iago", "/iago", "add PR diagram"    | `iago`                                                               | Specialized visualization skill — direct |
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
- `core/jobs-documentation.mdc`: Job documentation structure and conventions for `<PROJECT_DIR>/jobs` (default) or `$GOODAI_JOBS_ROOT`. Used by `job-orchestrator` and `job-documenter`.
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

- `core/review-agent-profile.mdc`: Baseline review standards, verdict labels, output structure.
- `core/review-strict-profile.mdc`: Strict review persona constraints and checklist.
- `core/code-review-ai-assistant.mdc`: Baseline AI code review standards for strict correctness, architecture, safety, and maintainability reviews.
- `core/code-review-boss-profile.mdc`: boss-style direct, architecture-first review profile.
- `core/playwright-testing.mdc`: Playwright E2E testing standards, UI verification, and visual regression workflows.
- `core/storybook-guidelines.mdc`: Storybook authoring and review standards.
- `core/tdd-workflow.mdc`: Red-green-refactor cycle, test-first mandate, no-done-without-green invariant. Loaded with `task-implementer` and `tests-creator`.

**Development Workflow:**

- `core/git-rules.mdc`: Commit safety, protected paths, and apply-changes gate.
- `core/commit-message-formatting.mdc`: Conventional commit format policy.
- `rules/core/subagent-status-protocol.md` — Subagent response format: required STATUS: prefix, four status types (DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT), orchestrator handling logic
- `rules/core/subagent-context-construction.md` — Explicit context construction for orchestrator→subagent dispatches: required fields, minimality principle, dispatch template
- `rules/core/terse-subagent-response.mdc` — 6-rule terse response format for sub-agents in orchestrators: no preamble, no filler, fragments over sentences, bullets over prose, code unchanged. Injected by orchestrators into sub-agent dispatch prompts to reduce inter-agent token flow.

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

### Review Skills (review domain)

> **Sub-domain purpose**: Structured code review pipeline with specialized reviewers per concern. `review-orchestrator` routes requests to the right set of subagents and consolidates findings. All reviewers use a unified severity system (blocker/major/minor/info) and STATUS protocol.

> ⚠️ **DISAMBIGUATION — review vs. job-orchestrator:**
> - "review", "review my code", "full review", "полное ревью", "review --all" → **`review-orchestrator`** (code quality review domain)
> - "implement + review + PR", "issue to PR", "full pipeline" → **`job-orchestrator`** (implementation pipeline that includes a review step)
> When in doubt about whether user wants a code review or a full implementation pipeline — ASK.

**`skills/review-orchestrator`** ⭐ ENTRY POINT FOR ALL REVIEW REQUESTS

- **Purpose**: Entry point — routes review request to specialized reviewers, dispatches in parallel, consolidates unified report
- **Use When**: "review", "code review", "review PR", "full review", "полное ревью", "review --frontend", "review --all", any code review request
- **Auto-detects scope** from diff file extensions when no flag is given
- **Path mode**: "review the UserStore", "review src/pipelines/" — reviews full file contents, not just diff
- **Routing flags**: `--frontend` · `--backend` · `--architecture` · `--security` · `--performance` · `--style` · `--project-conventions` · `--frontend-conventions` · `--testing-practices` · `--core-boundaries` · `--flow-graph` · `--legacy-profiles` · `--code-ai` · `--boss` · `--code-style` · `--mobx-store` · `--strict` · `--all` · (auto-detect from diff)
- **Convention reviewer prompt**: when local convention reviewers are auto-detected and not explicitly requested, ask whether to include all, choose individually, or skip them
- **Legacy/profile reviewer prompt**: when profile reviewers are available and not explicitly requested, ask whether to include all applicable, choose individually, or skip them
- **Output**: Unified report — `APPROVE | APPROVE_WITH_SUGGESTIONS | REQUEST_CHANGES` + findings by severity

**Subagents (dispatched by orchestrator — can also run standalone):**

| Skill | Scope | Severity cap |
|-------|-------|-------------|
| `review-logic` | Logic bugs, spec compliance, null-safety, async errors | blocker |
| `review-architecture` | Layer violations, SOLID, module boundaries, dependency direction | blocker |
| `review-security-code` | OWASP Top 10, injection, auth gaps, secrets in code | blocker |
| `review-performance` | N+1, re-renders, memory leaks, blocking calls, bundle size | major |
| `review-frontend` | React observer, MobX full checklist, MVVM boundaries | blocker |
| `review-backend` | NestJS patterns, DTO validation, API design, DB patterns | blocker |
| `review-style` | Naming, dead code, readability, DRY, cyclomatic complexity | major |
| `review-clean-code` | Clean Code principles (names, functions, comments, error handling) + SOLID at code level | major |
| `review-highload` | Race conditions, connection pools, caching, DB lock contention, queues, retries, idempotency, distributed invariants | blocker |
| `review-greptile` | Codebase-aware review via Greptile MCP — cross-file impact, downstream breakage, project-wide pattern violations. Requires PR number. | blocker |
| `review-frontend-conventions` | Repository-local frontend conventions: React/MobX/i18n/storage/errors/storybook/tooling | blocker |
| `review-testing-practices` | Repository-local unit/integration/MSW/Storybook/e2e testing discipline | blocker |
| `review-core-boundaries` | Shared core/infrastructure boundaries, dependency direction, and stability rules | major |
| `review-flow-graph` | Shared ReactFlow/graph abstraction contracts, lifecycle, and large-graph performance | major |
| `iago` | Generates or updates an idempotent Mermaid diagram block for PR review context. Uses `gh` CLI for publishing when explicitly requested. | — |
| `review-strict` | Meta-pass: elevates weak findings, strict engineering judgment | blocker |
| `review-pr-feedback` | Analyzes existing PR comments from GitHub (not a code reviewer) | — |
| `code-ai-review` | Optional strict AI review profile for correctness, safety, and maintainability | blocker |
| `code-boss-review` | Optional boss-style strict logic and architecture review profile | blocker |
| `code-style-review` | Optional legacy style/architecture profile | major |
| `code-mobx-store-review` | Optional MobX store/state profile, suggested for store files | major |

**Rules loaded by review skills:**
- `core/review-agent-profile.mdc` — baseline review standards, verdict labels, output structure
- `core/review-strict-profile.mdc` — strict persona constraints and checklist
- `core/code-review-ai-assistant.mdc` — strict AI review baseline used by `code-ai-review`
- `core/code-review-boss-profile.mdc` — boss-style profile used by `code-boss-review`

**Review domain routing:**

| Request | Dispatched reviewers |
|---------|---------------------|
| `review` / auto | logic + architecture + style + (frontend or backend from diff) + matching convention reviewers when local convention docs are detected |
| `review --all` | all generic reviewers + applicable legacy/profile reviewers + project convention reviewers when local convention docs exist |
| `review --frontend` | logic + frontend + style |
| `review --backend` | logic + backend + architecture |
| `review --architecture` | architecture only |
| `review --security` | security-code only |
| `review --clean-code` | clean-code only |
| `review --highload` | highload only |
| `review --greptile` | greptile only (requires PR number) |
| `review --project-conventions` | all generic project-convention reviewers |
| `review --frontend-conventions` | local frontend conventions only |
| `review --testing-practices` | local testing/e2e conventions only |
| `review --core-boundaries` | shared core boundary review only |
| `review --flow-graph` | shared flow/graph abstraction review only |
| `review --legacy-profiles` | code-ai + boss + code-style + MobX profile when store files are present |
| `review --code-ai` | code-ai-review only |
| `review --boss` | code-boss-review only |
| `review --code-style` | code-style-review only |
| `review --mobx-store` | code-mobx-store-review only |
| `iago` / `/iago` / `/squawk` | iago only (Mermaid PR diagram) |
| `review --strict` | strict pass (after others or standalone) |
| `review PR #N comments` | review-pr-feedback |

When `job-orchestrator` reaches its review phase, it must also ask which optional convention
reviewers to include (`all`, `choose individually`, or `skip`) unless `convention_reviewers` is
already set in automation settings.

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
- **Output**: Persistent documentation in `<JOBS_ROOT>/<job-name>/` (resolved as `$GOODAI_JOBS_ROOT` or `<PROJECT_DIR>/jobs`)

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
- **Modes**: Direct (user) or Orchestrated (called by `spec-orchestrator` or another agent). Supports refinement mode via `reviewer_findings` + `current_draft` fields.

---

### Pre-Implementation Specification Skills (spec pipeline)

> **Sub-domain purpose**: Produce a complete pre-implementation documentation suite — BRD → PRD → FSD → TRD — with an iterative review loop after each document stage. The reviewer receives full upstream context, not clean-context, to enable cross-artifact consistency checks.

**`skills/spec-orchestrator`** ⭐ ENTRY POINT

- **Purpose**: Orchestrates the full BRD → PRD → FSD → TRD pipeline with contextual review loops at each document stage
- **Use When**:
  - "Create full spec", "Full spec pipeline", "BRD to TRD"
  - "Pre-implementation docs", "Prepare spec"
  - "Write all documents before implementation"
  - User wants BRD, PRD, FSD, and TRD produced together with automated quality review
- **Key Features**:
  - 6-stage pipeline: Gather → Expand → BRD → PRD → FSD → TRD
  - PRD is mandatory; all other stages are optional and skippable
  - Review loop per document stage: reviewer with full upstream context → creator refines until 0 problems
  - Reviewer model auto-resolved by provider (Claude Haiku / gpt-4o-mini / omitted)
  - DONE_WITH_CONCERNS propagation with upstream_warnings
  - Job directory with collision handling; pipeline log
- **Output**: `brd.md`, `prd.md`, `fsd.md`, `trd.md` + `spec-pipeline-log.md` in `<JOBS_ROOT>/<job-name>/`
- **Version**: v1.0.0

**Subagents (dispatched by spec-orchestrator — can also run standalone):**

| Stage | Skill | Output |
|-------|-------|--------|
| 1 | `interviewer` (batch mode) | `raw-requirements.md` |
| 2 | `brainstorm` (batch mode) | `brainstorm.md` |
| 3 | `brd-creator` (new) | `brd.md` |
| 4 | `prd-creator` (existing, modified) | `prd.md` |
| 5 | `fsd-creator` (new) | `fsd.md` |
| 6 | `trd-creator` (new) | `trd.md` |

**`skills/brd-creator`**
- **Purpose**: Creates a Business Requirements Document (BRD) — business problem, objectives, stakeholders, scope, success metrics, constraints, out of scope
- **Use When**: "Create BRD", "Write business requirements", or dispatched by `spec-orchestrator`
- **Modes**: Direct (user) or Orchestrated. Supports generation mode and refinement mode (via `reviewer_findings`)

**`skills/fsd-creator`**
- **Purpose**: Expands PRD into a Functional Specification Document — feature behavior, UI states, logic rules, validation rules, error cases, interface contracts
- **Use When**: "Create FSD", "Write functional spec", or dispatched by `spec-orchestrator`
- **Modes**: Orchestrated (requires `upstream.prd`). Supports refinement mode.

**`skills/trd-creator`**
- **Purpose**: Expands PRD + FSD into a Technical Requirements Document — architecture, tech stack, data models, API contracts, NFRs, integration points, deployment notes
- **Use When**: "Create TRD", "Write technical requirements", or dispatched by `spec-orchestrator`
- **Modes**: Orchestrated (requires `upstream.prd`). Supports refinement mode. Can check codebase via `codebase_path`.

### Spec Pipeline Routing Rules

| User Request | Action |
|-------------|--------|
| "Full spec", "BRD to TRD", "All pre-implementation docs" | `spec-orchestrator` directly |
| "Quick PRD only", "Just the PRD" | `prd-creator` directly |
| "Create BRD" | `brd-creator` directly |
| "Create FSD" | `fsd-creator` directly (provide PRD content) |
| "Create TRD" | `trd-creator` directly (provide PRD content) |
| "Full project from scratch with roadmap" | `gproject-orchestrator` |

**Disambiguation:**
- `spec-orchestrator` → documentation suite only, no code
- `gproject-orchestrator` → documentation + architecture decisions + roadmap
- `job-orchestrator` → code implementation pipeline (may follow spec-orchestrator output)

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

### Code Documentation Skills (autodoc)

> **Sub-domain purpose**: Reverse-engineer comprehensive developer documentation from an existing codebase. `autodoc` scans a project, runs parallel analysis agents per module, synthesizes architecture, and produces a complete documentation package — fully autonomously, no human gates.

#### Pipeline Overview

```
Phase 0  Interview (if needed)    → project path + focus areas
Phase 1  autodoc-scanner          → artifacts/project-map.md
Phase 2  autodoc-analyst × N      → artifacts/analysis/<module>.md  [parallel]
Phase 3  autodoc-architect        → artifacts/architecture.md
Phase 4  autodoc-writer × N       → docs/<section>.md               [parallel]
Phase 5  autodoc-assembler        → docs/README.md + docs/index.md
```

Fully autonomous — no human gates. Analysts (Phase 2) and writers (Phase 4) run in parallel, one agent per module/section.

---

**`skills/autodoc-orchestrator`** ⭐ ENTRY POINT

- **Purpose**: Thin routing orchestrator — drives the 5-phase pipeline, detects modules, launches parallel analysts and writers, assembles final docs
- **Use When**:
  - "autodoc", "автодок"
  - "Generate docs for my project", "Document this codebase"
  - "Create developer documentation from code"
  - "Reverse engineer documentation", "задокументируй кодовую базу"
  - User provides a repo path and wants documentation output
- **Key Features**:
  - Asks minimal questions upfront (only if project path is missing)
  - Parallel analysts per module (Phase 2) and parallel writers per section (Phase 4)
  - Produces: onboarding, architecture overview, module reference, API reference, data models
  - State persisted in `state.json` with resumption support
  - No human gates — fully autonomous after initial input
- **Final deliverable**: `docs/README.md` + full documentation package in `jobs/autodoc-<name>/docs/`
- **Version**: v1.0.0
- **vs `gproject-orchestrator`**: autodoc reads existing code → produces docs. gproject-orchestrator takes an idea → produces spec + roadmap.

---

**Subagents (dispatched by orchestrator only — NOT invoked directly by user):**

| Phase | Skill | Input | Output | Parallel? |
|-------|-------|-------|--------|----------|
| 1 | `autodoc-scanner` | Project directory | `project-map.md` | — |
| 2 | `autodoc-analyst` | Module path + project-map | `analysis/<module>.md` | ✅ per module |
| 3 | `autodoc-architect` | All analysis artifacts | `architecture.md` | — |
| 4 | `autodoc-writer` | Analysis + architecture | `docs/<section>.md` | ✅ per section |
| 5 | `autodoc-assembler` | All docs sections | `docs/README.md` + `index.md` | — |

---

### autodoc Routing Rules

| User Request | Action |
|-------------|--------|
| "autodoc", "автодок" | `autodoc-orchestrator` directly |
| "Document this codebase / project" | `autodoc-orchestrator` |
| "Generate API docs", "Create onboarding guide" | `autodoc-orchestrator` |
| "Write documentation from code" | `autodoc-orchestrator` |

**Disambiguation:**
- "Plan a new feature" → `gproject-orchestrator` (forward-looking spec, NOT autodoc)
- "Review my code" → `review-orchestrator` (quality review, NOT autodoc)
- "autodoc" with no project path → ask for path first, then run

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

**`skills/caveman-mode`**
- **Purpose**: Activates terse response style (9–21% token savings) for the current session — no preamble, no filler, fragments over sentences, bullets over prose
- **Use When**: "/caveman", "terse mode", "short responses", "minimize tokens"
- **Key Features**: 6-rule caveman format; deactivates with `/caveman off`; automated version (`terse-subagent-response.mdc`) is injected by orchestrators into sub-agent dispatch prompts
- **Version**: v1.0.0

**`skills/plan-gatekeeper`**
- **Purpose**: Relentless interactive plan gatekeeper — stress-tests design, architecture, APIs, state, and edge cases; proposes ADRs
- **Use When**: "/plan-gatekeeper", "gatekeep plan", "grill plan", "stress-test plan", "validate this design"
- **Key Features**: Interrogates proposed plans against codebase constraints; formalizes architectural decisions before implementation
- **Version**: v1.0.0

**`skills/interviewer`**
- **Purpose**: Critical requirements interviewer — one question at a time with A/B/C/D options, structured decisions output
- **Use When**: "/interview", "clarify requirements", orchestrator Phase 0 interviewer gate
- **Key Features**: Adaptive follow-ups; max question budget; structured `{decisions, constraints, assumptions, risks, refined_goal}`
- **Version**: v1.0.0

**`skills/hookify`**
- **Purpose**: Create agent hooks from natural language descriptions
- **Use When**: "/hookify", "Create hook", "Add hook", "Run lint after edit"
- **Key Features**: Parses natural language to hook config; supports PreToolUse/PostToolUse/Stop events; previews before applying

**`skills/claude-md-management`**
- **Purpose**: Capture session learnings and persist into CLAUDE.md files
- **Use When**: "/revise-claude-md", "Update CLAUDE.md", "Save learnings"
- **Key Features**: Classifies insights into project/global/personal CLAUDE.md; diff preview before applying; avoids duplication

### PR & Comments Skills

**`skills/iago`**
- **Purpose**: Generate or update an idempotent Mermaid diagram block for PR review context
- **Use When**: "iago", "/iago", "/squawk", "generate PR diagram", "add Mermaid diagram to PR"
- **Key Features**: Reads PR diff, chooses flow/sequence/class/ER diagram, outputs locally by default, and publishes with `gh` CLI only when explicitly requested

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

**`skills/pr-review-comments`**

- **Purpose**: Collect and group PR review comments (GitHub MCP or gh); analyze feedback patterns
- **Use When**: "PR review comments", "parse PR comments", "analyze review feedback by author"

### Legacy / profile review skills

**`skills/code-review`**

- **Purpose**: Comprehensive multi-agent code review (correctness, security, performance, style)
- **Use When**: thorough PR reviews and pre-merge checks

**`skills/code-ai-review`**

- **Purpose**: Strict AI code review following code-review-ai-assistant.mdc
- **Use When**: "code-ai review", review --code-ai, optional legacy profile

**`skills/code-boss-review`**

- **Purpose**: Boss-style strict logic/architecture review profile
- **Use When**: "boss review", review --boss

**`skills/code-style-review`**

- **Purpose**: Style and architecture review using code-style-patterns.mdc
- **Use When**: style validation, optional legacy style profile

**`skills/code-mobx-store-review`**

- **Purpose**: Targeted MobX store/state review (actions, computed, reactions, boundaries)
- **Use When**: reviewing MobX stores, review --mobx-store

### gproject phase subagents (orchestrator-only)

**`skills/gproject-discovery`**

- **Purpose**: Collects and structures initial project information (gproject Phase 0)
- **Use When**: dispatched by gproject-orchestrator Phase 0 (not direct user invocation)

**`skills/gproject-problem-definer`**

- **Purpose**: Defines problems, goals, non-goals, success metrics (gproject Phase 1)
- **Use When**: dispatched by gproject-orchestrator Phase 1

**`skills/gproject-stack-advisor`**

- **Purpose**: Project level and technology stack recommendation (gproject Phase 2)
- **Use When**: dispatched by gproject-orchestrator Phase 2

**`skills/gproject-patterns-researcher`**

- **Purpose**: Stack best practices and architecture constraints (gproject Phase 3)
- **Use When**: dispatched by gproject-orchestrator Phase 3

**`skills/gproject-spec-writer`**

- **Purpose**: PRD/Implementation Plan constrained by decisions (gproject Phase 4)
- **Use When**: dispatched by gproject-orchestrator Phase 4

**`skills/gproject-consistency-checker`**

- **Purpose**: Adversarial consistency check of PRD vs decisions (gproject Phase 5)
- **Use When**: dispatched by gproject-orchestrator Phase 5

**`skills/gproject-planner`**

- **Purpose**: Roadmap, milestones, task DAG from PRD (gproject Phase 6)
- **Use When**: dispatched by gproject-orchestrator Phase 6

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

❌ **WRONG**: User says "Analyze variables in pipelines" → Load review-style rule
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
- Job documentation root: `<JOBS_ROOT>` — resolve as `JOBS_ROOT` from orchestrator dispatch, else `$GOODAI_JOBS_ROOT`, else `<PROJECT_DIR>/jobs/`
- Do **not** hardcode `~/goodai-base/jobs/` — that path is only correct when the *project under work* is goodai-base itself
- Structure and conventions: `rules/core/jobs-documentation.mdc`
- Created and maintained by `job-documenter` skill, driven by `job-orchestrator`
