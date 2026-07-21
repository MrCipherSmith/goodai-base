# Canonical Skill Profiles & Grok Integration

Version: 1.0.0

## Purpose

Requirements package for aligning goodai-base skill **platform-profile policy**
(canonical `SKILL.md` + optional variants) with tooling (`validate-skills-before-sync`,
`sync-skills`), documentation, and **Grok** discovery — without proliferating
identical `SKILL.{cursor,codex,opencode,zed}.md` copies.

## Status

`spec ready` — not implemented (except partial local work already on `main`:
committed identical platform profiles for five skills; Grok already loads skills
via Claude Code compatibility after `sync-skills` to `claude`).

## Document Index

| Document | Role |
|----------|------|
| [prd.md](./prd.md) | Problem, goals, requirements, success criteria |
| [specification.md](./specification.md) | Technical design, contracts, acceptance criteria |
| [implementation-plan.md](./implementation-plan.md) | Phased plan: Day 0, Day 1, optional |
| [flow-prompts.md](./flow-prompts.md) | Copy-paste prompts for flow-orchestrator per phase |

Related roadmap entry: [../roadmap.md](../roadmap.md).

## Scope

**In scope**

- Strategy **A (canonical-only)**: `SKILL.md` is enough; platform files optional.
- Validator and tests aligned with strategy A.
- Docs: CONTRIBUTING, skills-storage-workflow, scripts/README, onboarding (Grok).
- Day-0 local hygiene and smoke (`sync`, `grok inspect`).
- Optional Grok config: `[skills] paths` and/or future `sync-skills` target.

**Out of scope**

- Full matrix of forced platform files for every skill (strategy B).
- ZCode plugin pipeline changes (already separate).
- Rewriting skill body content or skill catalog semantics.
- Committing machine-local MCP configs with absolute user paths.

## Related Modules / Areas

| Area | Path |
|------|------|
| Pre-sync validator | `scripts/src/validate-skills-before-sync.ts` |
| Sync CLI | `scripts/src/sync-skills.ts` |
| Validator tests | `scripts/tests/validate-skills-before-sync.test.ts` |
| Skill authoring rule | `rules/core/skills-storage-workflow.mdc` |
| Contributing | `CONTRIBUTING.md` |
| Onboarding | `docs/onboarding.md` |
| Scripts docs | `scripts/README.md` |
| Skills source | `skills/*/` |
| Grok user config | `~/.grok/config.toml` (local, not repo) |
| Grok skills guide | `~/.grok/docs/user-guide/08-skills.md` |

## Current Baseline (as of 2026-07-21)

- `main` includes keryx metaproject + **committed** platform profiles for
  `brd-creator`, `caveman-mode`, `fsd-creator`, `spec-orchestrator`, `trd-creator`
  (identical to `SKILL.md`) — tactical fix so validation passes.
- `sync-skills` already **falls back** to `SKILL.md` when a platform file is missing.
- `validate-skills-before-sync` still **hard-requires** `SKILL.cursor.md` and
  `SKILL.codex.md` — contradicts workflow rule and CONTRIBUTING tension.
- Grok discovers ~70 goodai skills from `~/.claude/skills/` via
  `[compat.claude] skills = true` (default). No Grok entry in `sync_tools` yet.
