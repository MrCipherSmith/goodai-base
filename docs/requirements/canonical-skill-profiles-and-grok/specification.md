# Specification: Canonical Skill Profiles & Grok Integration

Version: 1.0.0

## 1. Identity

| Field | Value |
|-------|-------|
| Package | `canonical-skill-profiles-and-grok` |
| Kind | tooling policy + implementation plan |
| Repo | `goodai-base` |
| Decision | **Strategy A — canonical-only** |

## 2. Problem Model

```text
skills/<name>/
  SKILL.md              # REQUIRED — canonical
  SKILL.cursor.md       # OPTIONAL — only if differs from canonical
  SKILL.codex.md        # OPTIONAL
  SKILL.zed.md          # OPTIONAL
  SKILL.opencode.md     # OPTIONAL
  SKILL.claude.md       # OPTIONAL (Claude slash/commands path may use SKILL.md)
```

### Policy contradictions to resolve

| Source | Today | Target |
|--------|-------|--------|
| `skills-storage-workflow.mdc` | optional variants | keep optional |
| `CONTRIBUTING.md` | “Add platform variants” | “Optional; only when different” |
| `validate-skills-before-sync` | require cursor+codex | require SKILL.md only; validate present variants |
| `sync-skills` | fallback OK | keep; optional summary |

## 3. Component Design

### 3.1 Validator (`scripts/src/validate-skills-before-sync.ts`)

**Current (implemented):** for each skill dir, if `SKILL.cursor.md` or
`SKILL.codex.md` missing → `FAIL` + exit 1.

**Target:**

1. Require `SKILL.md` exists and passes frontmatter checks (`name`,
   `description`, delimiters, name charset/length).
2. For each existing `SKILL.<platform>.md` in
   `{cursor,codex,zed,opencode,claude,antigravity}` (or current PLATFORMS set),
   run the same frontmatter validation.
3. Do **not** fail when cursor/codex files are absent.
4. Keep schema sanity check for
   `rules/schemas/skill-workflow-result.schema.json` if still chained.
5. Keep optional chain to `validate-rules-json` (warnings OK).

### 3.2 Sync (`scripts/src/sync-skills.ts`)

**Current (implemented):** per tool, prefer `SKILL.<suffix>.md`, else
`SKILL.md` with `NOTE … using canonical`. Supports `--skip-validation`,
`--tools`, `--all`.

**Target:**

- No behavior change required for strategy A.
- Optional UX: end-of-run summary `variants_used / fallback_used`.
- **Do not** add `grok` tool by default (see §5).

### 3.3 Tests (`scripts/tests/validate-skills-before-sync.test.ts`)

| Case | Today | Target |
|------|-------|--------|
| Missing cursor profile | exit 1 | exit 0 (if SKILL.md valid) |
| Missing codex profile | exit 1 | exit 0 (if SKILL.md valid) |
| Missing SKILL.md | (if tested) | exit 1 |
| Invalid frontmatter on present platform file | fail | fail (unchanged) |

### 3.4 Documentation surfaces

| File | Change |
|------|--------|
| `CONTRIBUTING.md` | Step 3: platform variants optional; create only when divergent |
| `rules/core/skills-storage-workflow.mdc` | Align wording with validator (already optional); remove stale `.sh` names if needed |
| `scripts/README.md` | Document validate policy + Grok note under sync targets |
| `docs/onboarding.md` | New subsection **Grok** under multi-tool / sync |

## 4. Grok Integration (discovery model)

Grok skill discovery priority (from Grok user guide):

1. Project / local `.grok/skills`
2. User `~/.grok/skills`
3. **Claude compat** `~/.claude/skills` (default on)
4. **Cursor compat** `~/.cursor/skills` (default on)
5. Extra dirs via `[skills] paths` in `~/.grok/config.toml`

### Primary path (recommended, implemented today)

```text
goodai-base/skills
  → sync-skills (tool: claude)
  → ~/.claude/skills/<name>/SKILL.md
  → Grok [compat.claude]
```

Smoke: `grok inspect` shows skills with `vendor: claude` and path under
`~/.claude/skills/`.

### Optional path A — config paths

```toml
# ~/.grok/config.toml
[skills]
paths = ["/Users/<you>/goodai-base/skills"]  # or ~/goodai-base/skills

[compat.claude]
skills = true
```

Pros: no copy step; always reads repo source.  
Cons: absolute/home path is machine-local; not committed to repo.

### Optional path B — sync target `grok`

Only if A and Claude compat are insufficient:

| Field | Value |
|-------|-------|
| id | `grok` |
| skillsDir | `~/.grok/skills` |
| suffix | `grok` or reuse canonical |
| agentsFile | none (Grok uses own config) |

Risk: collision with Grok bundled skills; need name policy.

## 5. CLI / Skill Surface

| Command | Role after change |
|---------|-------------------|
| `bun run validate-skills-before-sync` | Green under canonical-only |
| `bun run sync-skills` | No `--skip-validation` required for missing profiles |
| `bun src/sync-skills.ts --skip-validation` | Remains for emergencies |
| `grok inspect` | Smoke discovery |
| `keryx` / metaproject | Orthogonal; not required for this package |

No new public skill is required. This package is a **tooling policy** package.

## 6. Data Contracts

No new JSON schemas. Existing:

- Skill frontmatter: YAML `name`, `description` (and optional metadata).
- `goodai.config.json`: `sync_tools` array (claude, cursor, …) — no `grok`
  unless optional path B is approved later.

## 7. Acceptance Criteria

### Day 0 (local)

- [ ] No orphan untracked profile copies needed for daily work (or documented
      why kept).
- [ ] Sync succeeds (with or without skip depending on pre-Day-1 state).
- [ ] `grok inspect` lists at least `job-orchestrator` and one of
      `brd-creator` / `spec-orchestrator`.

### Day 1 (PR)

- [ ] Validator implements FR-1–FR-3.
- [ ] Tests updated; suite green.
- [ ] Docs updated (FR-5, FR-6).
- [ ] PR description links this package path.

### Optional

- [ ] Local `~/.grok/config.toml` `[skills] paths` applied if desired.
- [ ] Design note recorded if `grok` sync target is still needed after smoke.

## 8. Implementation Status Honesty

| Item | Status |
|------|--------|
| Sync fallback to SKILL.md | **implemented** |
| `--skip-validation` | **implemented** |
| Hard-require cursor/codex | **implemented (to remove)** |
| Strategy A docs alignment | **not implemented** |
| Grok onboarding section | **not implemented** |
| Grok sync target | **not implemented** (optional, deferred) |
| Identical profiles for 5 skills on main | **implemented** (tactical; not strategy end-state) |

## 9. Integration Points

```text
Author → skills/<name>/SKILL.md
       → CONTRIBUTING / AGENTS.md
       → validate-skills-before-sync
       → sync-skills → tool dirs
       → Grok (compat.claude / paths)
```
