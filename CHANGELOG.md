# Changelog

All notable changes to goodai-base are documented here.

---

## [Unreleased] — Scripts TypeScript migration

> Branch: `feat/scripts-ts` · PR: [#2](https://github.com/MrCipherSmith/goodai-base/pull/2)

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
