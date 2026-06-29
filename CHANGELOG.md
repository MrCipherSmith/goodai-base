# Changelog

All notable changes to goodai-base are documented here.

---

## [1.13.0] — spec-orchestrator + BRD/FSD/TRD creators

> Released: 2026-06-29

### Added

- **`skills/spec-orchestrator`** — New orchestration skill. Produces a full pre-implementation documentation suite (BRD → PRD → FSD → TRD) from a single user request. Each document stage is followed by a contextual review loop: the reviewer receives the full upstream artifact context (not clean-context), enabling cross-artifact consistency checks. Creator-as-fixer pattern: when the reviewer finds problems, the creator refines the current draft rather than regenerating. Reviewer model auto-resolved by provider (Claude Haiku, gpt-4o-mini, or omitted for OpenRouter/unknown). PRD is mandatory; all other stages are skippable. Outputs `spec-pipeline-log.md` with per-stage status.
- **`skills/brd-creator`** — New creator skill. Produces a Business Requirements Document with sections: Business Problem, Objectives, Stakeholders, Scope, Success Metrics, Constraints, Out of Scope. Supports generation and refinement modes (via `reviewer_findings` + `current_draft`). Direct and orchestrated modes.
- **`skills/fsd-creator`** — New creator skill. Expands PRD into a Functional Specification Document: Feature Behavior, UI States, Logic Rules, Validation Rules, Error Cases, Interface Contracts. Supports generation and refinement modes. Accepts `codebase_path` for architecture consistency checks.
- **`skills/trd-creator`** — New creator skill. Expands PRD + FSD into a Technical Requirements Document: Architecture, Tech Stack, Data Models, API Contracts, NFRs, Integration Points, Deployment Notes. Supports generation and refinement modes. Accepts `codebase_path` for tech stack verification.

### Changed

- **`skills/prd-creator` v1.1.0** — Orchestrated mode extended with optional fields: `upstream_context` (string|null — upstream artifact content), `metadata.output_path` (where prd-creator writes prd.md), `current_draft`, `reviewer_findings`, `upstream_warnings`. When `reviewer_findings` is present, prd-creator must refine `current_draft` rather than regenerating. Backward-compatible — all new fields are optional.
- **`AGENTS.md`** — Added routing entries for `spec-orchestrator`, `brd-creator`, `fsd-creator`, `trd-creator`. Added "Pre-Implementation Specification Skills" section. Added quick-decision row for "Full spec / BRD to TRD".
- **`scripts/src/generate-codex-plugins.ts`** — Added `spec-orchestrator`, `brd-creator`, `fsd-creator`, `trd-creator` to `goodai-project-docs` bundle.

---

## [1.12.0] — Greptile integration + npm package

> Released: 2026-04-17

### Added

- **`skills/review-greptile`** — New codebase-aware reviewer via Greptile MCP. Unlike diff-only reviewers, Greptile indexes the entire repository and detects cross-file impact, downstream breakage, and project-wide pattern violations. Workflow: trigger review → poll for completion → normalize findings to G-NNN format → check custom context for exceptions → emit report. Requires PR number. Free for open-source (MIT/Apache/GPL).
- **`docs/greptile-integration.md`** — Full integration reference: capability comparison table, setup (CLI and manual), pricing, usage flags, internal workflow, finding format, context-collector integration, troubleshooting table.
- **`package.json` + `bin/cli.js`** — npm package (`goodai-base`) with Node.js CLI. Commands: `install` (auto-detects tools, copies skills, injects routing blocks), `sync` (re-sync skills after update), `status` (show install state per tool), `setup-greptile` (interactive Greptile API key setup — writes MCP config to `~/.claude.json`, adds env var to shell rc).
- **`.npmignore`** — Excludes dev files (`scripts/`, `jobs/`, `hooks/`, `setup.ts`) from npm package.

### Changed

- **`skills/review-orchestrator` v1.4.0** — Added `--greptile` flag. `--all` auto-includes Greptile when a PR is resolvable. Greptile runs in parallel with other reviewers. Consolidated report includes a dedicated "Greptile (Codebase-Aware Findings)" section.
- **`skills/context-collector` v1.2.0** — Added Phase 2.6: queries `mcp__greptile__search_custom_context` and `mcp__greptile__search_greptile_comments` during context collection. Greptile context is additive and silently skipped if MCP unavailable.
- **`docs/review-domain.md`** — Added Greptile integration section with setup command and link to full doc. Updated reviewer count to 13 (1 orchestrator + 12 reviewers).
- **`README.md`** — Added `review-greptile` and updated `review-orchestrator` as notable examples with doc links. Skill count: 49.

---

## [1.11.0] — review-highload + path mode for review

> Released: 2026-04-16

### Added

- **`skills/review-highload`** — New reviewer for high-load and distributed systems. 7-part checklist: concurrency & race conditions (singleton state, TOCTOU, unbounded `Promise.all`), resource management (connection pools, file handles, in-memory caches), caching (invalidation, stampede, namespacing), database under load (missing indexes, lock contention, external I/O inside transactions), async/queues (backpressure, dead letters, ordering), retry/timeout/circuit breaker (idempotency keys, exponential backoff with jitter), distributed invariants (distributed locks, distributed cron, clock ordering). Iron Laws: race condition on shared state = blocker; non-idempotent retry without key = blocker; blocking I/O on event loop = major. Triggered by `review --highload`.

### Changed

- **`skills/review-orchestrator` v1.3.0** — Added **path mode**: detects when user names a module, component, store, or provides a file/directory path, and reviews full file contents instead of git diff. Natural language resolution: "review the UserStore" or "review src/pipelines/" both activate path mode. Diff mode remains the default for branch/PR reviews. Auto-detection now also recognizes `*.store.ts` and `makeObservable` as frontend signals.
- **`docs/review-domain.md`** — Added path mode usage examples and explanation.
- **`README.md`** — Updated skill count 47 → 48.

---

## [1.10.0] — autodoc pipeline + review domain redesign

> Released: 2026-04-16

### Added

**autodoc domain (6 skills):**
- **`skills/autodoc-orchestrator`** — Autonomous 5-phase reverse-engineering pipeline. Runs entirely without human gates after the project path is provided. Interviews the user if needed, then dispatches scanner → analysts (parallel) → architect → writers (parallel) → assembler. Persists work in `state.json` under `<DOCS_ROOT>/<job>/`.
- **`skills/autodoc-scanner`** — Phase 1. Scans project structure, detects stack/framework, maps entry points and module boundaries. Returns `project-map.md` and a `next_phase_hints.modules[]` list for the orchestrator to route analyst agents.
- **`skills/autodoc-analyst`** — Phase 2 (one per module, parallel). Deep-reads each module: public API surface, dependencies, patterns, data flows. Returns `artifacts/analysis/<module>.md`.
- **`skills/autodoc-architect`** — Phase 3. Synthesizes all module analyses into a system-level architecture description: layers, integration points, cross-cutting concerns.
- **`skills/autodoc-writer`** — Phase 4 (one per section, parallel). Writes documentation sections from templates: onboarding, architecture, modules, api-reference, data-models.
- **`skills/autodoc-assembler`** — Phase 5. Assembles `docs/README.md` and `docs/index.md` from all section files, validates cross-references, produces a final documentation package.
- **`docs/autodoc-pipeline.md`** — Full pipeline reference: phases, parallel dispatch protocol, interview gate, output structure, and usage examples.

**review domain redesign (11 skills, replacing 5):**
- **`skills/review-orchestrator`** — Entry point replacing `code-review`. Parses flags (`--frontend`, `--backend`, `--architecture`, `--security`, `--performance`, `--style`, `--clean-code`, `--strict`, `--all`), auto-detects scope from diff file extensions, dispatches selected reviewers in parallel, consolidates findings into one unified report.
- **`skills/review-logic`** — Logic correctness, spec compliance, null-safety, async error paths. Renamed and refocused from `code-ai-review` (partial).
- **`skills/review-architecture`** — Layer violations, dependency direction, module coupling, SOLID at system level, NestJS/React+MobX structural patterns. Merged from `code-boss-review` + `code-style-review` (architecture parts).
- **`skills/review-security-code`** — OWASP Top 10, injection, auth/authz gaps, secrets, missing NestJS guards. Split out from `code-ai-review`.
- **`skills/review-performance`** — N+1 queries, React re-renders, memory leaks, bundle size, blocking calls. Split out from `code-ai-review`.
- **`skills/review-frontend`** — React observer wrapping, MVVM boundary, useEffect misuse, full MobX store checklist (10 sections), TypeScript safety. Merged from `code-style-review` (frontend parts) + `code-mobx-store-review`. **v1.1.0**: added Step 0 (read project CLAUDE.md) and Part D (7 project-specific pattern checklist items derived from real frontend codebase).
- **`skills/review-backend`** — NestJS patterns, DTO validation, API design, DB query patterns, service/repository separation. New skill with no prior equivalent.
- **`skills/review-style`** — Naming conventions, dead code, readability, import order, cyclomatic complexity. Max severity: major.
- **`skills/review-clean-code`** — Clean Code principles (Uncle Bob): meaningful names, function size/responsibility, argument count, comment quality, error handling, DRY. SOLID at function/class level (SRP, OCP, LSP, ISP, DIP). Distinct from `review-style` (formatting) and `review-architecture` (module structure). Max severity: major (blocker only for swallowed exceptions, blocking constructors, LSP runtime failures).
- **`skills/review-strict`** — Meta-pass: re-reads all findings, elevates weak severities, adds direct engineering commentary. Refocused from `code-boss-review`.
- **`skills/review-pr-feedback`** — Analyzes existing GitHub PR review comments. Renamed from `pr-review-comments`, fixed `JOBS_ROOT` convention.
- **`rules/core/review-agent-profile.mdc`** — Unified baseline review standards (renamed from `code-review-ai-assistant.mdc`).
- **`rules/core/review-strict-profile.mdc`** — Strict reviewer persona constraints (renamed from `code-review-boss-profile.mdc`).
- **`docs/review-domain.md`** — Full domain reference: all 11 skills, routing table, unified contracts, severity system, STATUS protocol, scope boundaries, iron laws, project CLAUDE.md integration, and guide for adding future reviewers.

### Changed

- **`AGENTS.md`** — Added `autodoc` sub-domain section (pipeline diagram, phases, usage). Replaced "Code Review Skills" section with full `review` domain section (routing table, subagents table, scope boundaries). Updated all old skill name references.
- **`README.md`** — Updated skill count (40 → 47). Added "Code Documentation" category (6 autodoc skills). Updated "Review" category (11 new `review-*` skills). Added `autodoc-orchestrator` as a notable example with pipeline doc link.

### Removed

- `skills/code-review` — replaced by `review-orchestrator`
- `skills/code-ai-review` — scope split into `review-logic`, `review-security-code`, `review-performance`
- `skills/code-boss-review` — scope split into `review-architecture`, `review-strict`
- `skills/code-style-review` — scope split into `review-architecture`, `review-frontend`, `review-style`
- `skills/code-mobx-store-review` — merged into `review-frontend`
- `skills/pr-review-comments` — replaced by `review-pr-feedback`
- `rules/core/code-review-ai-assistant.mdc` — replaced by `review-agent-profile.mdc`
- `rules/core/code-review-boss-profile.mdc` — replaced by `review-strict-profile.mdc`

---

## [1.9.0] — gproject: project documentation pipeline

> Released: 2026-04-15

### Added

- **`skills/gproject-orchestrator`** — New standalone 7-phase project documentation orchestrator. Drives the full pipeline from discovery to roadmap, enforces human gates at Phase 2 (stack), Phase 3 (architecture), and Phase 5 (consistency). Uses `decisions.md` as an append-only decisions registry. Supports two modes: `new_project` (full interview + discovery) and `task_in_project` (existing codebase, inherits stack). State is persisted in `state.json` with full resumption support.
- **`skills/gproject-discovery`** — Phase 0 subagent. Collects and structures all available information: user input, uploaded documents, codebase scan (task_in_project), web research. Outputs `discovery-brief.md`.
- **`skills/gproject-problem-definer`** — Phase 1 subagent. Converts discovery brief into a formal problem statement with SMART goals, non-goals, personas, and measurable success criteria.
- **`skills/gproject-stack-advisor`** — Phase 2 subagent. Recommends technology stack matched to project scale level (MVP / pet / startup / production). May call `brainstorm` in parallel for contested architectural decisions.
- **`skills/gproject-patterns-researcher`** — Phase 3 subagent. Produces `architecture.md` (structural decisions, layer breakdown, cross-cutting concerns) and `tech-bestpractices.md` (MUST / MUST NOT / SHOULD checklists per technology, used by consistency checker).
- **`skills/gproject-spec-writer`** — Phase 4 subagent. Generates `prd.md` fully constrained by phases 0–3. Makes no new architectural decisions — translates existing decisions into user stories with acceptance criteria and a traceability matrix.
- **`skills/gproject-consistency-checker`** — Phase 5 subagent. Adversarial validator: reads all artifacts and `decisions.md`, checks for cross-artifact contradictions, missing metrics, and constraint violations. Returns PASS / PASS_WITH_WARNINGS / FAIL.
- **`skills/gproject-planner`** — Phase 6 subagent. Decomposes PRD into tasks with DAG dependency graph, groups into independently-deployable milestones (M0 Foundation → M1 Core → M2 Complete → M3 Launch-ready), calculates critical path and three-scenario duration estimates. `roadmap.md` is the final pipeline deliverable.
- **`docs/gproject-pipeline.md`** — Detailed pipeline reference: all 7 phases, decisions registry, human gate protocol, NEEDS_CONTEXT protocol, state resumption, iron laws, and output structure.

### Changed

- **`AGENTS.md`** — Added full `gproject` sub-domain section: pipeline diagram, phase table, mode comparison, routing rules, and disambiguation. `gproject-orchestrator` is documented as a standalone top-level orchestrator — scope ends at `roadmap.md`.
- **`README.md`** — Updated skill count (30 → 40), added "Project Documentation" category with all 9 gproject skills, added `gproject-orchestrator` as a notable example with link to pipeline docs.
- **`rules.json`** — Removed stale `code-boss-review` entry (skill was renamed to `code-boss-review` in v1.8.0 but the rules index was not updated).

---

## [1.7.0] — Setup wizard, multi-tool sync, MobX refinement

> Released: 2026-04-12

### Added

- **`install.sh`** — curl-installable bash bootstrapper: checks git/bun prereqs, clones or updates repo, installs script deps, launches `setup.ts`
- **`setup.ts`** — interactive setup wizard (6 sections):
  1. **AI tools** — multi-select which tools to sync (claude/cursor/codex/opencode/zed), detects installed tools automatically
  2. **Global config per tool** — injects routing block into each tool's global instructions file:
     - Claude Code: `~/.claude/CLAUDE.md` (goodai-base routing block)
     - Cursor: `~/.cursor/rules/goodai-base.mdc` (`alwaysApply: true`)
     - Codex/OpenCode/Zed: AGENTS.md sync is sufficient
  3. Artifact paths (GOODAI_JOBS_ROOT / GOODAI_DOCS_ROOT)
  4. Default sub-agent model
  5. TDD enforcement mode
  6. Documentation languages + post-install actions
  Saves preferences to `goodai.config.json` (gitignored)

### Changed

- **`scripts/src/sync-skills.ts`** — tool selection support:
  - `--tools claude,cursor` flag: sync to specific tools only
  - `--all` flag: force sync to all known tools
  - Reads `sync_tools` from `goodai.config.json` when no flag provided
  - Falls back to all tools if no config exists
  - Unified `ToolTarget` registry replacing separate `TARGETS[]` + `AGENTS_TARGETS[]` arrays
  - Claude slash commands scoped to claude tool only
- **`scripts/README.md`** — updated sync usage examples and sync targets table
- **`README.md`** — one-line install command, detailed wizard description, updated tool table
- **`CLAUDE.md`** — setup wizard section added
- **`.gitignore`** — `goodai.config.json` added

### Added (MobX refinement)

- **`rules/core/mobx-store-template.mdc`** — comprehensive store template: member ordering discipline, `@observable.ref/shallow/struct` variants, `IReactionDisposer[]` pattern, `try/catch/finally` with `catch (err: unknown)`, `@action.bound` for public UI methods
- **`rules/core/code-style-patterns.mdc`** — updated MobX principles: explicit store layout, action boundaries, `runInAction` scope rules
- **Skills updated** — `code-mobx-store-review`, `code-style-review`, `context-collector`, `task-implementer` checklists aligned with new template across all 5 platform variants (claude, cursor, codex, opencode, zed); task-implementer migrated from Gherkin to JSON task object format

---

## [1.6.0] — DOCS_ROOT resolution

> Mirrors the JOBS_ROOT refactor: docs/ artifacts now default to `<PROJECT_DIR>/docs/` instead of the hardcoded `~/goodai-base/docs/`. All skills and rules use `<DOCS_ROOT>` placeholder.

### Changed

- **DOCS_ROOT default** — changed from `~/goodai-base/docs/` to `<PROJECT_DIR>/docs/` across all skills and rules. Resolution order: (1) `DOCS_ROOT` passed explicitly in the dispatch prompt, (2) `GOODAI_DOCS_ROOT` env var, (3) `<PROJECT_DIR>/docs/` as the new default. Sub-agents never resolve DOCS_ROOT themselves — they receive it from the orchestrator.
- **`rules/core/documentation-management.mdc`** — Root Location section updated, new `DOCS_ROOT Resolution` section added.
- **`rules/core/implementation-plans.mdc`**, **`requirements-management.mdc`**, **`git-rules.mdc`** — location references updated.
- **`skills/feature-analyzer/`** (all SKILL variants + orchestrator-prompt) — all `~/goodai-base/docs/analysis` references replaced with `<DOCS_ROOT>/analysis`.
- **`skills/context-collector/`** (all SKILL variants) — docs path references updated.

---

## [1.5.0] — JOBS_ROOT resolution + Wave isolation + compact task results

> Fixes orchestrator context bloat: after 4+ waves the orchestrator session was
> reaching 100k+ tokens and freezing in "Unfurling" state due to accumulated
> sub-agent results. Root cause: orchestrator was dispatching task-implementers
> directly and receiving full verbose output inline.

### Changed

- **JOBS_ROOT default** — changed from `~/goodai-base/jobs/` to `<PROJECT_DIR>/jobs/` across all skills and rules. Resolution order: (1) `JOBS_ROOT` passed explicitly in the dispatch prompt, (2) `GOODAI_JOBS_ROOT` env var, (3) `<PROJECT_DIR>/jobs/` as the new default. Sub-agents (job-documenter, context-collector, task-implementer, review skills) never resolve JOBS_ROOT themselves — they receive it from the orchestrator.
- **`job-orchestrator`** — `Configurable Jobs Root` section updated to reflect new resolution order and `JOBS_ROOT="${GOODAI_JOBS_ROOT:-$PROJECT_DIR/jobs}"` pseudocode.
- **`rules/core/jobs-documentation.mdc`** — Root Location section updated, new `JOBS_ROOT Resolution` section added explaining the 3-priority resolution.

- **`job-orchestrator` v3.3.0** — Steps 2.4.1 + 2.5 rewritten: each wave now dispatches as a single `wave-executor` sub-agent that runs tests-creator + task-implementers internally and returns only a compact `WAVE_DONE` summary (5 lines). Orchestrator context grows O(waves), not O(∑tokens of all sub-agent results). Added `CONTEXT BUDGET RULE` and `Why wave isolation` explanation.
- **`task-implementer` v1.3.0** — Phase 6 now writes the full JSON result to `jobs/<job-name>/results/<task_id>.json` instead of returning it inline. The STATUS response contains only a compact summary (STATUS line + files changed + verification). Orchestrators read the result file only when needed (DONE_WITH_CONCERNS or BLOCKED).

### Added

- **`jobs/<job-name>/results/` folder** (`rules/core/jobs-documentation.mdc`) — standardized location for task-implementer JSON result files, created automatically during Phase 6.

### Updated documentation

- `docs/agents/job-orchestrator.md` — Sub-agents table updated (wave-executor added), pipeline steps renumbered, example flow updated to show wave-executor calls
- `docs/skills-overview.md` — Ecosystem map updated, Implementation Pipeline table updated, data contracts updated, Iron Law 4 added
- `skills/task-implementer/orchestrator-prompt.md` — Data flow updated, execution instructions updated (no inline JSON), Parsing the Result updated (file-based)
- `skills/job-orchestrator/orchestrator-prompt.md` — IMPLEMENT step updated to wave isolation pattern

---

## [1.4.0] — Scripts TypeScript migration

> Merged via [#2](https://github.com/MrCipherSmith/goodai-base/pull/2)

### Added
- **TypeScript scripts** — all 12 bash/python scripts rewritten in TypeScript (Bun runtime)
- **Shared modules** (`scripts/src/shared/`) — 6 reusable modules eliminating duplicated parsing:
  - `frontmatter.ts` — gray-matter wrapper for SKILL.md/rule frontmatter
  - `checksum.ts` — SHA-256 for files and strings
  - `args.ts` — CLI argument parser (flags, options, positional)
  - `keywords.ts` — stop-word-filtered keyword derivation
  - `agents-md.ts` — AGENTS.md catalog parser (rules + skills sections)
  - `fs-utils.ts` — filesystem helpers with `~` expansion
- **Test suite** — 244 tests across 18 files (`bun test`), covering all scripts and shared modules
- **CI test step** — `bun test` runs in `docs-sync.yml` before catalog generation

### Changed
- `scripts/package.json` — `"test": "bun test"` added; all script entries use `bun src/*.ts`
- `.github/workflows/docs-sync.yml` — replaced `actions/setup-python` + `bash scripts/*.sh` with `oven-sh/setup-bun` + `bun run`
- `scripts/README.md` — rewritten to document all 12 TypeScript scripts and shared modules
- `CONTRIBUTING.md` — updated all script references to `bun run` commands
- `docs/onboarding.md` — updated script references and added `bun test` to Useful Scripts
- `README.md` — updated Quick start from `chmod +x scripts/*.sh` to `bun install && bun run sync-skills`

### Removed
- Python dependency for scripts (embedded `python3` heredocs eliminated)
- `bash` dependency for core script logic (kept only for legacy `.sh` files in repo root)
- `jq` dependency for JSON processing

### Fixed
- `shared/agents-md.ts` — rule regex now correctly matches `: ` separator (was matching only `—`/`–`/`-`), fixing silent drop of 6/17 rules in `rules.json`
- `detect-context.ts` — JSON output now matches Python `json.dumps` spacing (`": "`, `", "`)
- `generate-agents.ts` — `--dry-run` no longer inflates generated/updated counters
- `generate-agents.ts` — skill description now escaped before embedding in YAML frontmatter
- `detect-context.ts` — replaced `require('fs')` CJS call with ESM `readFileSync` import

---

## [1.3.0] — TDD pipeline, quality gate, engineering rules

> Merged: 2026-04-11 · Commits: `514f2a4`, `e1455a2`, `ada1f63`, `aa3ddaa`

### Added

- **`tests-creator` skill** (`skills/tests-creator/SKILL.md` v1.0.0) — sub-agent that converts acceptance_criteria into failing test stubs (RED phase) before any implementation; detects test framework, writes forward-declared assertions, commits, and verifies RED state
- **`code-verifier` skill** (`skills/code-verifier/SKILL.md` v1.0.0) — quality gate sub-agent: lint + type-check + tests + circular import detection; never aborts early; structured VERIFICATION_RESULT with severity (CRITICAL/HIGH/LOW) and gate (PASS/PASS_WITH_WARNINGS/FAIL)
- **8 engineering rules** (`rules/core/`):
  - `tdd-workflow.mdc` — RED-GREEN-REFACTOR cycle, Iron Laws (no STATUS: DONE with failing tests, no impl before failing tests)
  - `solid-principles.mdc` — SRP, OCP, DIP with code examples and Red Flags
  - `error-handling.mdc` — Result<T,E> pattern, typed domain errors, no swallowed exceptions
  - `api-contracts.mdc` — OpenAPI-first, semantic versioning, contract testing
  - `clean-architecture.mdc` — 4-layer model, dependency rule (inward only), repository pattern
  - `database-patterns.mdc` — no N+1, CONCURRENTLY indexes, 3-step migration for breaking changes
  - `security-baseline.mdc` — no secrets in source, parameterized queries, validate external input
  - `async-patterns.mdc` — Promise.all for independent ops, mandatory timeouts, Promise.allSettled for partial failure
- **`implementation-doc-mandate.mdc`** — mandates two documents for all implementing agents: Implementation Spec (before code) + Change Report (after); includes Iron Laws and Red Flags
- **Agent documentation** (`docs/agents/`):
  - `job-orchestrator.md` — when to use, how to launch, full 15-step pipeline, sub-agents table, mandatory invariants, output artifacts, resume mechanism, example flow
  - `tests-creator.md` — when to use, 4-phase workflow, TEST_CASE_SPECS output format, supported frameworks, forward-declared test convention
  - `code-verifier.md` — what it checks, severity classification, gate logic, VERIFICATION_RESULT format, orchestrator integration

### Changed

- **`job-orchestrator` v3.2.0** — hardwired TDD pipeline: tests-creator (step 4, mandatory) before every task-implementer wave; code-verifier (steps 7 + 11) replaces internal bash checks; Iron Law: no exceptions even if user says "skip tests"
- **`feature-dev` v2.0.0** — 8 phases (was 7): Phase 4 (tests-creator, mandatory) now runs before Phase 5 (implement); Phase 1 creates Implementation Spec; Phase 8 produces Change Report; rules always loaded: `tdd-workflow.mdc`, `implementation-doc-mandate.mdc`, `error-handling.mdc`
- **`task-implementer` v1.2.0** — Phase 1.5 (TDD Check) reads test stubs and verifies RED before implementing; Phase 2.4 loads `tdd-workflow.mdc`, `error-handling.mdc`, `solid-principles.mdc` for ALL task types
- **`issue-analyzer` v1.1.0** — each decomposed task now includes `"requires_tests_creator": true` in JSON output
- **`context-collector` v1.1.0** — Phase 2.5 (Test Framework Detection) reads package.json and existing test files, produces `test_framework` context block for sub-agents
- **`AGENTS.md`** — added "Engineering Standards" section (7 rules), "Implementation Process" section, ⭐ markers for new mandatory sub-agents (tests-creator, code-verifier)

---

## [1.1.0] — Agent discipline patterns

> Merged: 2026-04-11 · Commit: `d3a0591`

### Added
- **CSO descriptions** — all 30 skill `description:` fields rewritten as trigger conditions ("Use when X"), not workflow summaries
- **Anti-rationalization** — Red Flags + Iron Laws sections added to `code-review`, `feature-dev`, `issue-analyzer`, `task-implementer`, and core rules (`git-rules.mdc`, `implementation-plans.mdc`)
- **SUBAGENT-STOP guards** — added to 7 orchestrator/interactive-only skills (`job-orchestrator`, `context-collector`, `job-documenter`, `interview`, `interviewer`, `feature-analyzer`, `feature-dev`)
- **Subagent Status Protocol** (`rules/core/subagent-status-protocol.md`) — every subagent response must start with `STATUS: DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT`
- **Explicit Context Construction** (`rules/core/subagent-context-construction.md`) — orchestrators must pass all context explicitly; subagents must not infer from ambient conversation
- **Two-stage code review** — Stage 1 (spec compliance) gates Stage 2 (code quality); added to `code-review`, `code-ai-review`, `code-boss-review`
- **Reporting Results sections** — `task-implementer`, `issue-analyzer`, `context-collector` now include STATUS protocol format

### Changed
- `AGENTS.md` — added Agent Discipline section with 2 new rules
- `docs/onboarding.md` — fixed description field explanation; added Multi-Agent Patterns section
- `skills/*/SKILL.md` (30 files) — all descriptions converted to trigger-condition format

---

## [1.0.0] — Open-source release

> Merged: 2026-04-11 · Commit: `bfab43f`

### Added
- `README.md` — full rewrite for public audience (what it is, how it works, quick start)
- `LICENSE` — MIT
- `CONTRIBUTING.md` — skill/rule authoring guide, description format rules, PR checklist
- `SECURITY.md` — vulnerability reporting via GitHub Security tab, scope table
- `.github/ISSUE_TEMPLATE/skill-bug.md` — structured bug report for skill/rule misbehavior
- `.github/ISSUE_TEMPLATE/config.yml` — disabled blank issues, directed to Discussions
- `.github/pull_request_template.md` — quality checklist (CSO descriptions, Red Flags, SUBAGENT-STOP, STATUS protocol)
- GitHub repository configuration: description, topics, Discussions enabled, branch protection on `main`
