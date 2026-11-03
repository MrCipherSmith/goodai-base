# Implementation Plan: Canonical Skill Profiles & Grok

Version: 1.0.0

## High-level plan

1. **Day 0 — Local hygiene & smoke** (no PR required if tree already clean).
2. **Day 1 — Strategy A in goodai-base** (validator + tests + docs + PR).
3. **Optional — Grok depth** only if Claude-compat smoke is insufficient.

**Decision locked:** Strategy A (canonical-only). Strategy B (full matrix) is
rejected as default.

**Context baseline (2026-07-21):**

- Platform profiles for five skills already **committed** on `main` (tactical).
- Day 0 “delete untracked profiles” applies only if local untracked clones
  reappear; do not delete the committed copies in Day 0 without a follow-up
  cleanup PR.
- Grok already sees goodai skills via `~/.claude/skills` after sync.

---

## Detailed plan

### Day 0 (local)

#### 0.1 Untracked profiles

| Step | Action | Notes |
|------|--------|-------|
| 0.1.1 | `git status` under `skills/` | Look for untracked `SKILL.*.md` |
| 0.1.2 | If untracked identical clones exist | Delete them (`rm`) — sync uses `SKILL.md` |
| 0.1.3 | If profiles are **tracked** on main | Keep them until optional cleanup PR after Day 1 |

**Do not** invent new copies “to make validate green” once Day 1 lands.

#### 0.2 Sync

**Before Day 1 merge:**

```bash
cd ~/goodai-base/scripts
bun run validate-skills-before-sync   # may fail pre-Day-1
# if FAIL due to missing profiles on other skills:
bun src/sync-skills.ts --skip-validation
# else:
bun run sync-skills
```

**After Day 1 merge:** always `bun run sync-skills` (no skip).

Confirm `goodai.config.json` includes at least `claude` (and preferably
`cursor`) in `sync_tools`.

#### 0.3 Grok smoke

```bash
grok inspect | rg "job-orchestrator|brd-creator|spec-orchestrator|claude"
# or
grok inspect --json | python3 -c "import json,sys; d=json.load(sys.stdin); print([s['name'] for s in d['skills'] if s['name'] in ('job-orchestrator','brd-creator')])"
```

Pass criteria:

- Skill names present.
- Source path under `~/.claude/skills/` (or cursor/paths if configured).
- `compatibilityStatus` enabled when vendor is claude.

If empty: re-run sync with `claude`, verify
`[compat.claude] skills` is not false in `~/.grok/config.toml`.

---

### Day 1 (goodai-base, strategy A)

#### 1.1 Validator

**File:** `scripts/src/validate-skills-before-sync.ts`

- Remove hard fail for missing `SKILL.cursor.md` / `SKILL.codex.md`.
- Add hard fail if `SKILL.md` missing or invalid frontmatter.
- Keep validation loop over existing platform files.
- Preserve schema + rules.json chain behavior.

#### 1.2 Tests

**File:** `scripts/tests/validate-skills-before-sync.test.ts`

- Invert cases “missing cursor/codex → exit 1” to expect exit 0 when
  `SKILL.md` is valid.
- Add case “missing SKILL.md → exit 1”.
- Keep invalid frontmatter cases.

```bash
cd scripts && bun test validate-skills-before-sync
cd scripts && bun run validate-skills-before-sync && bun run sync-skills
```

#### 1.3 Docs

| File | Edit |
|------|------|
| `CONTRIBUTING.md` | Platform variants optional; only when divergent |
| `rules/core/skills-storage-workflow.mdc` | Align with A; fix script names to `bun run …` if needed |
| `scripts/README.md` | Validator policy; Grok discovery note |
| `docs/onboarding.md` | Section **Grok integration** (Claude compat primary) |

Suggested onboarding bullets:

- Sync to Claude: skills land in `~/.claude/skills`.
- Grok loads them via Claude compatibility by default.
- Smoke: `grok inspect`.
- Optional: `[skills] paths` pointing at repo `skills/`.
- Grok is **not** a required `sync_tools` entry.

#### 1.4 PR

- Branch e.g. `fix/canonical-skill-profiles-strategy-a`.
- Title: `fix(skills): treat platform profiles as optional (strategy A)`.
- Body links:
  `docs/requirements/canonical-skill-profiles-and-grok/`.
- Checklist: tests green, validate green, sync green, no secrets.

Author email: use GitHub noreply if GH007 privacy protection is enabled.

---

### Optional

#### 7. Grok `[skills] paths` (local only)

```toml
# ~/.grok/config.toml
[skills]
paths = ["~/goodai-base/skills"]

[compat.claude]
skills = true
```

Then `grok inspect` again. Prefer this over a new sync target when the goal is
zero-copy source-of-truth.

#### 8. `grok` target in `sync-skills` (only if 7 is not enough)

Add to `ALL_TOOLS` in `scripts/src/sync-skills.ts`:

- `id: "grok"`
- `skillsDir: join(home, ".grok", "skills")`
- `suffix: "grok"` (or force canonical only)

Also: setup wizard / `goodai.config.json` option; docs; collision policy with
bundled Grok skills.

**Gate to start 8:** Day 0 smoke failed after Claude sync **and** paths option
failed or is unacceptable for the environment.

---

## Execution tracking

### Day 0

- [x] 0.1 Inspect untracked profiles; delete only untracked noise
- [x] 0.2 Sync (skip-validation only if pre-Day-1 validator blocks)
- [x] 0.3 `grok inspect` smoke pass

### Day 1

- [x] 1.1 Validator strategy A
- [x] 1.2 Tests updated and green
- [x] 1.3 Docs: CONTRIBUTING, workflow rule, scripts README, onboarding Grok
- [x] 1.4 PR opened / merged

### Optional

- [x] 7 Local Grok `paths` (if desired) — deferred; smoke OK via claude
- [x] 8 Design+implement `grok` sync target (only if justified) — not needed (gate)

### Follow-ups (not required for Done)

- [ ] Cleanup PR: remove identical platform files that match `SKILL.md` byte-for-byte
- [ ] CI: ensure validate gate uses new semantics
