# PRD: Canonical Skill Profiles & Grok Integration

Version: 1.0.0

## Problem

goodai-base ships multi-agent skills under `skills/<name>/`. Three sources of
truth disagree:

1. **`rules/core/skills-storage-workflow.mdc`** — platform variants optional;
   `sync-skills` falls back to `SKILL.md`.
2. **`CONTRIBUTING.md`** — authors must add `SKILL.cursor.md`, `SKILL.codex.md`,
   `SKILL.zed.md`, `SKILL.opencode.md`.
3. **`validate-skills-before-sync`** — hard-fails without
   `SKILL.cursor.md` and `SKILL.codex.md`.

Effects:

- New skills (e.g. brd/fsd/trd/spec/caveman) blocked pre-sync until identical
  copies are fabricated.
- Repo accumulates ~4× duplicate profile files with no behavioral difference.
- Operators need ad-hoc `--skip-validation` or local copies to sync.
- Grok already consumes Claude-synced skills, but this path is undocumented;
  teams may invent unnecessary Grok-specific sync targets.

## Goal

Adopt **strategy A (canonical-only)** as the single policy:

- Canonical skill body lives in `SKILL.md`.
- Platform files only when content truly differs.
- Validator accepts skills with only `SKILL.md`; validates any present variants.
- Sync remains fallback-based (already implemented).
- Document how **Grok** loads goodai skills (Claude compat first; optional
  `paths` / future target only if needed).
- Phased local rollout (Day 0 hygiene + smoke; Day 1 code/docs PR; optional
  Grok config).

## Users

| Persona | Need |
|---------|------|
| Skill author | Add one `SKILL.md` + AGENTS.md entry; sync without inventing four clones |
| Maintainer / CI | Green validate + sync without `--skip-validation` |
| Agent operator (Claude/Cursor/Grok) | Discover same skill catalog after normal sync |
| Grok user | Know that Claude sync is enough; optional deeper config documented |

## Requirements

### Functional

| ID | Requirement |
|----|-------------|
| FR-1 | Validator MUST require only `SKILL.md` per skill directory (plus frontmatter rules on existing files). |
| FR-2 | Validator MUST NOT fail solely because `SKILL.cursor.md` / `SKILL.codex.md` are absent. |
| FR-3 | Validator MUST still validate frontmatter of any present `SKILL.<platform>.md`. |
| FR-4 | `sync-skills` MUST keep canonical fallback (already true); MAY print summary counts. |
| FR-5 | Docs (CONTRIBUTING, skills-storage-workflow, scripts/README, onboarding) MUST state one policy. |
| FR-6 | Onboarding MUST document Grok discovery via Claude (and Cursor) compat. |
| FR-7 | Optional: document `[skills] paths = ["~/goodai-base/skills"]` for Grok. |
| FR-8 | Optional (only if paths insufficient): add `grok` target in `sync-skills` → `~/.grok/skills/`. |

### Non-functional

| ID | Requirement |
|----|-------------|
| NFR-1 | No new runtime dependency. |
| NFR-2 | Changes limited to scripts, tests, docs; no skill body rewrites required. |
| NFR-3 | Existing skills with platform files remain valid. |
| NFR-4 | Do not commit machine-absolute MCP paths. |

### Non-goals

- Strategy B (mandatory full platform matrix) as default.
- Auto-generator that materializes N copies of every skill on each sync.
- ZCode marketplace changes.
- Forcing Grok into `goodai.config.json: sync_tools` by default.

## Success Criteria

1. `cd scripts && bun run validate-skills-before-sync` passes with **only**
   `SKILL.md` for a fixture skill that has no platform files.
2. `cd scripts && bun run sync-skills` passes without `--skip-validation` on
   current `main` skill tree under strategy A.
3. `grok inspect` lists goodai skills (e.g. `job-orchestrator`, `brd-creator`)
   after Claude-targeted sync.
4. CONTRIBUTING + skills-storage-workflow + scripts/README no longer contradict
   the validator.
5. Onboarding has an explicit **Grok** subsection.

## Risks

| Risk | Mitigation |
|------|------------|
| Some tools historically expected platform files | Fallback already in sync; keep variants when content differs |
| Authors stop creating needed divergences | Docs: create platform file only when behavior differs |
| Committed identical profiles become stale vs SKILL.md | Day 1 allows keeping them; optional later cleanup PR |
| Grok compat disabled by user | Document `[compat.claude] skills = true` |

## Recommendation

**Implement strategy A** with Day 0 local smoke + Day 1 PR (validator, tests,
docs). Defer Grok `paths` and `sync-skills` target to optional follow-up only
after smoke shows Claude compat is insufficient.
