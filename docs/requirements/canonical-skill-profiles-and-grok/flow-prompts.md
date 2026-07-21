# Flow-Orchestrator Prompts (copy-paste)

Version: 1.0.0

Use with **flow-orchestrator** in project root `~/goodai-base` (repo with `.metaproject`).

**How to use**

1. Copy the **current phase** prompt into a new agent session.
2. Agent runs `flow-orchestrator` → `keryx flow init/start` → implement → your completion choice.
3. For Day 1+: after **PR is merged to `main`**, pull main, then paste the **next** prompt.
4. Do not paste two phase prompts in one session.

**Package source of truth**

- `docs/requirements/canonical-skill-profiles-and-grok/`
- Plan: `implementation-plan.md`
- Spec: `specification.md`
- Decision: **Strategy A (canonical-only)** — platform profiles optional.

**Repo**

```text
cwd: /Users/Goodea/goodai-base
remote: origin/main
```

---

## PHASE 0 — Day 0 local smoke (run now)

```text
Run skill: flow-orchestrator (mode: auto).

Project root: /Users/Goodea/goodai-base
Read first: .metaproject/index.md

Title for flow:
  "Day 0: skill profiles hygiene + sync + Grok smoke (canonical-skill-profiles-and-grok)"

Requirements package (source of truth):
  docs/requirements/canonical-skill-profiles-and-grok/
  - README.md, prd.md, specification.md, implementation-plan.md

### Scope — ONLY Day 0 (do not start Day 1 code changes)

0.1 Untracked profiles
  - git status under skills/
  - Delete only untracked identical SKILL.{cursor,codex,opencode,zed}.md if any
  - Do NOT delete tracked platform profiles already on main
  - Do NOT invent new profile copies

0.2 Sync
  - cd scripts
  - bun run validate-skills-before-sync
  - If FAIL due to missing profiles: bun src/sync-skills.ts --skip-validation
  - Else: bun run sync-skills
  - Confirm goodai.config.json has claude (and preferably cursor) in sync_tools

0.3 Grok smoke
  - grok inspect (or --json) must list at least: job-orchestrator and brd-creator or spec-orchestrator
  - Prefer source under ~/.claude/skills/ via Claude compat
  - If missing: re-sync with claude; check [compat.claude] skills is not false in ~/.grok/config.toml

### Constraints
- No feature implementation of strategy A (validator change) in this flow
- No PR required unless you find a real bug fix worth a tiny PR (default: handoff without PR)
- Never edit flow.json by hand; use keryx flow CLI
- Prefer keryx ctx rg over bare rg for project search
- Use gdgraph/gdwiki before broad file reads when relevant
- Commit email if any commit: use GitHub noreply (avoid GH007)

### Acceptance criteria (freeze these)
- AC1: No untracked junk platform profiles left under skills/
- AC2: Skills synced to configured tools (claude at minimum)
- AC3: grok inspect shows goodai skills (job-orchestrator + one of brd-creator/spec-orchestrator)
- AC4: Short report in flow journal: validate result, sync command used, grok sample lines

### Completion
After AC met, ask how to finish (A draft PR / B handoff / C keep open).
Default recommendation: B verified handoff (no PR for Day 0).

When done, print for the user:
  NEXT_PROMPT: PHASE 1 (paste from docs/requirements/canonical-skill-profiles-and-grok/flow-prompts.md after any PR merge + git pull origin main)
```

---

## PHASE 1 — Day 1 strategy A (after Day 0 done; start from updated main)

```text
Run skill: flow-orchestrator (mode: auto).

Project root: /Users/Goodea/goodai-base
Read first: .metaproject/index.md

Preconditions (do before init if needed):
  - git checkout main && git pull origin main
  - Confirm Day 0 smoke was done (Grok sees skills; sync works)

Title for flow:
  "Day 1: strategy A — optional platform profiles in validator + docs + PR"

Requirements package:
  docs/requirements/canonical-skill-profiles-and-grok/
  Follow specification.md §3 and implementation-plan.md Day 1.

### Scope — ONLY Day 1 (strategy A implementation)

1.1 Validator — scripts/src/validate-skills-before-sync.ts
  - REMOVE hard-require of SKILL.cursor.md / SKILL.codex.md
  - REQUIRE valid SKILL.md (exists + frontmatter)
  - Still validate frontmatter of any present SKILL.<platform>.md
  - Keep schema / validate-rules-json chain behavior

1.2 Tests — scripts/tests/validate-skills-before-sync.test.ts
  - Missing cursor/codex + valid SKILL.md → exit 0
  - Missing SKILL.md → exit 1
  - Keep invalid-frontmatter failure cases
  - Run: cd scripts && bun test validate-skills-before-sync
  - Run: bun run validate-skills-before-sync && bun run sync-skills (must pass WITHOUT --skip-validation)

1.3 Docs (single policy: canonical-only)
  - CONTRIBUTING.md — platform variants optional, only when divergent
  - rules/core/skills-storage-workflow.mdc — align with A; prefer bun run … script names
  - scripts/README.md — validator policy + short Grok discovery note
  - docs/onboarding.md — section "Grok integration":
      primary path = sync to claude → ~/.claude/skills → Grok compat.claude
      smoke = grok inspect
      optional [skills] paths
      grok is NOT required in sync_tools by default

1.4 PR
  - Branch: fix/canonical-skill-profiles-strategy-a
  - Draft PR to main
  - Body links docs/requirements/canonical-skill-profiles-and-grok/
  - Author email: GitHub noreply (avoid GH007)

### Out of scope
- Grok sync target in sync-skills (optional phase)
- Deleting all identical platform files repo-wide (optional cleanup later)
- ZCode / Codex plugin redesign

### Constraints
- Strategy B (mandatory full profile matrix) is rejected
- Never edit flow.json by hand
- TDD where applicable for tests
- Prefer keryx ctx / gdgraph before broad search
- code-verifier + review before completion choice

### Acceptance criteria (freeze these)
- AC1: validate-skills-before-sync passes without requiring cursor/codex files
- AC2: unit tests updated and green
- AC3: sync-skills works without --skip-validation
- AC4: docs no longer contradict (CONTRIBUTING / workflow / scripts README / onboarding Grok)
- AC5: draft PR opened with link to requirements package

### Completion
When verified: recommend A) Create draft PR and complete managed flow.
After user merges PR to main, they will run PHASE optional (or stop if Done).

When done, print:
  NEXT_PROMPT: after merge to main → git pull → paste PHASE OPTIONAL from flow-prompts.md
  If optional not needed (Grok smoke already OK): mark package Done; skip optional.
```

---

## PHASE OPTIONAL — Grok paths / sync target (only after Day 1 PR merged)

```text
Run skill: flow-orchestrator (mode: auto).

Project root: /Users/Goodea/goodai-base
Read first: .metaproject/index.md

Preconditions:
  - git checkout main && git pull origin main
  - Day 1 strategy A is already on main (validator no longer requires platform profiles)
  - Re-run smoke: bun run sync-skills && grok inspect

Title for flow:
  "Optional: Grok skills paths and/or sync-skills grok target"

Requirements package:
  docs/requirements/canonical-skill-profiles-and-grok/specification.md §4–5
  implementation-plan.md Optional §7–8

### Gate (decide first, write into plan.md)

Run smoke after Day 1:
  - If grok inspect already lists goodai skills via ~/.claude/skills → PREFER only documenting [skills] paths as optional local tip; NO code change unless user still wants paths documented in onboarding (already Day 1).
  - Only implement code if Claude-compat is insufficient OR user explicitly wants grok in sync_tools.

### Scope options (pick minimum)

Option 7 — Local config only (no PR, or docs-only PR):
  Document / apply in ~/.grok/config.toml:
    [skills]
    paths = ["~/goodai-base/skills"]
    [compat.claude]
    skills = true
  Smoke grok inspect again.
  Completion: B handoff (local config) unless onboarding needs a tweak.

Option 8 — Code: grok target in sync-skills (PR):
  ONLY if Option 7 / Claude-compat fail or product decision requires it.
  - Add ALL_TOOLS entry: id grok, skillsDir ~/.grok/skills
  - setup / goodai.config.json support
  - Collision policy with bundled Grok skills
  - Tests + docs
  - Draft PR

### Constraints
- Do not re-open strategy A validator work
- Prefer Option 7 over Option 8
- Never edit flow.json by hand
- No machine-absolute paths committed into repo MCP configs

### Acceptance criteria
- AC1: Decision recorded in flow plan.md (7 only / 8 needed / neither)
- AC2: If 7: grok inspect still/better green; user has config snippet
- AC3: If 8: sync --tools grok works; tests/docs/PR
- AC4: If neither: explicit "not needed" handoff with smoke evidence

### Completion
- 7 only → B handoff (or tiny docs PR if needed)
- 8 → A draft PR

When done, print:
  NEXT_PROMPT: none — package complete. Optional follow-up: cleanup identical platform files PR (separate flow).
```

---

## After each phase (operator checklist)

```text
1) Agent finishes flow → you choose A/B/C
2) If PR: review, merge to main
3) Locally:
     cd /Users/Goodea/goodai-base
     git checkout main
     git pull origin main
4) Paste NEXT phase prompt from this file
5) Tick checkboxes in implementation-plan.md Execution tracking
```

## Phase order summary

| Order | Prompt | Needs PR? | Next |
|------:|--------|-----------|------|
| 0 | PHASE 0 Day 0 | usually no | PHASE 1 |
| 1 | PHASE 1 Day 1 | yes | merge → PHASE OPTIONAL or stop |
| 2 | PHASE OPTIONAL | maybe | none |

## One-liner to start Phase 0

```text
Запусти flow-orchestrator по промпту PHASE 0 из docs/requirements/canonical-skill-profiles-and-grok/flow-prompts.md
```
