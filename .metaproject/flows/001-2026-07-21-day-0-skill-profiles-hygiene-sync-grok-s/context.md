# Context

Collected for Day 0 smoke. Requirements package is source of truth.

## Requirements package

- `docs/requirements/canonical-skill-profiles-and-grok/README.md`
- `docs/requirements/canonical-skill-profiles-and-grok/prd.md`
- `docs/requirements/canonical-skill-profiles-and-grok/specification.md`
- `docs/requirements/canonical-skill-profiles-and-grok/implementation-plan.md`
- `docs/requirements/canonical-skill-profiles-and-grok/flow-prompts.md`

## Decision

- Strategy A (canonical-only) for Day 1 — **not** in this flow
- Day 0 = hygiene + sync + Grok smoke only
- Default completion: verified handoff **without PR**

## Code / tooling

- Validator: `scripts/src/validate-skills-before-sync.ts` (still hard-requires cursor/codex)
- Sync: `scripts/src/sync-skills.ts` (fallback to SKILL.md; supports `--skip-validation`)
- Config: `goodai.config.json` → `sync_tools`
- Graph: `.metaproject/data/gdgraph/artifacts/summary.md` (scripts-focused)

## Baseline known

- Five skills already have **tracked** platform profiles on main (tactical)
- Grok discovers skills from `~/.claude/skills` when Claude compat enabled
- Untracked only expected: machine-local `.cursor/mcp.json`, `.mcp.json` (out of scope)

## Metaproject

- tasks, gdgraph, gdwiki, gdskills, health, testing, security, mcp enabled
