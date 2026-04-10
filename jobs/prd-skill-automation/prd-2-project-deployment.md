# PRD: Project-Level Skill Evaluation Deployment

## 1. Overview

A lightweight deployment system that connects individual project repositories to the centralized goodai-base skill/rule library. A one-time `deploy-skill-hook.sh` script installs a thin hook in the target project; the hook reads skill definitions from goodai-base at runtime and surfaces relevant skills based on the developer's current prompt. No skill files are duplicated into the project — the project only holds the hook wiring and an optional override manifest.

---

## 2. Context

| Field | Value |
|-------|-------|
| Product | goodai-base — centralized AI knowledge base |
| Module | Skills subsystem + project integration layer |
| User Role | Developer working in any project repo (frontend, backend, etc.) |
| Tech Stack | Bash/zsh, Claude Code CLI, Markdown skill files, JSON config |

---

## 3. Problem Statement

Skills and rules live in `~/goodai-base/skills/` and `~/goodai-base/rules/core/`. When a developer works in a separate project repo, those skills are invisible unless manually copied there. The showcase approach (`MrCipherSmith/claude-code-showcase`) copies skill files into each project's `.claude/skills/` — this creates duplication, version drift, and maintenance overhead.

There is no mechanism today to:
- Deploy a reference hook to a project repo that reads from goodai-base at runtime
- Suggest relevant skills to the developer without embedding the skill source
- Allow per-project overrides without forking the canonical files

---

## 4. Goals

- **G-1:** Provide a single `deploy-skill-hook.sh` script that installs the evaluation hook into any target project with one command
- **G-2:** The installed hook reads skill definitions from goodai-base at runtime (no copies in the project)
- **G-3:** The hook suggests relevant skills based on current prompt context
- **G-4:** Projects can declare local overrides (disable skills, add project-local skills) via a lightweight manifest
- **G-5:** Zero goodai-base knowledge required from the project developer — works transparently
- **G-6:** Updating goodai-base skills is automatically reflected in all projects (no re-deploy needed for content changes)

---

## 5. Non-Goals

- Does NOT copy or embed skill Markdown files into the project repo
- Does NOT modify any existing goodai-base skill or rule files
- Does NOT support non-Claude-Code AI tooling in v1 (Cursor, Zed, OpenCode out of scope)
- Does NOT implement skill versioning or a registry protocol — goodai-base HEAD is the single source
- Does NOT handle multi-user or team-wide distribution — targets a single developer's local environment

---

## 6. Functional Requirements

**FR-1 — Deploy Script**
`scripts/deploy-skill-hook.sh <target-project-path>` that:
- Accepts an absolute path to a target project repo
- Creates `.claude/` directory in the target project if absent
- Writes a hook config entry into `.claude/settings.json` (creates if absent) registering the skill-evaluator hook
- Writes `.claude/hooks/skill-evaluator.sh` referencing `GOODAI_BASE` env var (defaulting to `~/goodai-base`)
- Creates default `.claude/skill-overrides.json` with empty `disabled`, `local_skills`, and `extra_context` fields
- Is idempotent: re-running updates without duplicating entries
- Prints a confirmation summary listing files created/updated

**FR-2 — Hook Template**
`.claude/hooks/skill-evaluator.sh` that:
- Reads `GOODAI_BASE` path from env (default: `~/goodai-base`)
- Scans `$GOODAI_BASE/skills/*/SKILL.md` to build the skill index
- Accepts the current user prompt via stdin JSON payload per Claude Code hook API
- Runs keyword/intent matching against each skill's "Use When" section and trigger keywords
- Outputs up to 3 ranked skill suggestions as a formatted hint injected into agent context
- Respects `.claude/skill-overrides.json`: skips disabled skills, includes local skill paths
- Exits 0 in all cases (hook failures must never block the agent)

**FR-3 — Override Manifest**
`.claude/skill-overrides.json` schema:
```json
{
  "disabled": ["skill-name"],
  "local_skills": [
    { "name": "skill-name", "path": ".claude/skills/skill-name/SKILL.md" }
  ],
  "extra_context": "Optional plain-text context appended to every suggestion prompt."
}
```

**FR-4 — Skill Index Caching**
Hook builds a JSON index from skill files on first run per session and caches at `$TMPDIR/goodai-skill-index-<hash>.json` keyed by goodai-base path + mtime of skills dir. Cache is invalidated when the skills directory mtime changes.

**FR-5 — Hook Registration Format**
Registered in `.claude/settings.json` under `hooks.UserPromptSubmit` so it fires before the agent processes a new user message.

**FR-6 — Uninstall**
`scripts/deploy-skill-hook.sh --uninstall <target-project-path>` removes the hook entry from `.claude/settings.json` and deletes `.claude/hooks/skill-evaluator.sh`. Does NOT delete the override manifest.

---

## 7. Non-Functional Requirements

- **NFR-1 — Performance:** Hook execution under 500ms with up to 50 skills; cached calls under 50ms
- **NFR-2 — Reliability:** Hook never crashes the Claude Code session; all errors logged to `$TMPDIR/goodai-skill-evaluator.log`; exits 0
- **NFR-3 — Portability:** Works on macOS (zsh/bash) and Linux (bash). Requires only POSIX tools + `jq`
- **NFR-4 — Idempotency:** Deploy script is safe to re-run without side effects
- **NFR-5 — Transparency:** Suggestions appear in a clearly delimited block distinguishable from agent output
- **NFR-6 — Security:** Hook reads only from `GOODAI_BASE` and the project's `.claude/`; no network requests; no eval of arbitrary strings

---

## 8. Constraints

- Skills remain exclusively in `~/goodai-base/skills/` — hook is read-only
- Must use Claude Code hook API (`UserPromptSubmit` events with JSON stdin payload)
- Deploy script must merge into existing `.claude/settings.json` without destroying existing hooks
- `GOODAI_BASE` defaults to `~/goodai-base` but is overridable via env
- `jq` is a required dependency; must fail gracefully with human-readable error if absent

---

## 9. Edge Cases

| Case | Handling |
|------|----------|
| goodai-base path does not exist at hook runtime | Log warning, no suggestions, exit 0 |
| Target project has no `.claude/settings.json` | Deploy script creates it |
| Skill SKILL.md is malformed or empty | Skip silently |
| `skill-overrides.json` references non-existent local skill | Log warning, skip |
| All skills disabled | Hook exits 0 with no output |
| Empty or whitespace-only prompt | No suggestions, exit 0 |
| Concurrent Claude Code sessions | Cache keyed by mtime (not PID), safe for concurrent reads |
| Deploy script run on goodai-base itself | Warn and abort (circular reference) |

---

## 10. Acceptance Criteria (Gherkin)

```gherkin
Feature: Project Hook Deployment

  Scenario: Successful hook deployment
    Given a developer has goodai-base at ~/goodai-base with 10+ skills
    And a target project repo at ~/projects/my-app with no .claude/ directory
    When the developer runs: scripts/deploy-skill-hook.sh ~/projects/my-app
    Then .claude/settings.json is created with a hooks entry for skill-evaluator
    And .claude/hooks/skill-evaluator.sh is created and executable
    And .claude/skill-overrides.json is created with empty disabled and local_skills arrays
    And the script prints a confirmation listing the 3 files created

  Scenario: Skill suggestion on matching prompt
    Given the hook is installed in ~/projects/my-app
    And goodai-base contains "feature-analyzer" with trigger "Analyze branch"
    When the developer submits "Analyze the changes in this branch"
    Then the agent context includes a Skill Suggestions block
    And "feature-analyzer" appears as the top suggestion

  Scenario: Disabled skill is not suggested
    Given the hook is installed and .claude/skill-overrides.json has "feature-analyzer" in disabled
    When the developer submits a prompt matching "feature-analyzer" triggers
    Then "feature-analyzer" is NOT suggested
    And other matching skills ARE suggested normally

  Scenario: Local skill override is suggested
    Given .claude/skill-overrides.json declares a local_skill "db-seed" at .claude/skills/db-seed/SKILL.md
    And that file exists with triggers "seed database"
    When the developer submits "Seed the database with test data"
    Then the hook suggests "db-seed" from the local path

  Scenario: Hook never blocks the agent
    Given GOODAI_BASE points to a non-existent directory
    When the developer submits any prompt
    Then the hook exits with code 0
    And a warning is written to $TMPDIR/goodai-skill-evaluator.log
    And the Claude Code agent continues normally

  Scenario: Idempotent re-deployment
    Given the hook is already installed in ~/projects/my-app
    When the developer runs the deploy script again
    Then the hook entry in .claude/settings.json is NOT duplicated
    And .claude/hooks/skill-evaluator.sh is updated to latest template
    And existing .claude/skill-overrides.json is NOT overwritten

  Scenario: Uninstall
    Given the hook is installed in ~/projects/my-app
    When the developer runs: scripts/deploy-skill-hook.sh --uninstall ~/projects/my-app
    Then the skill-evaluator entry is removed from .claude/settings.json
    And .claude/hooks/skill-evaluator.sh is deleted
    And .claude/skill-overrides.json is preserved
```

---

## 11. Verification

1. **Deploy unit test:** Run against `/tmp/test-project`; assert file structure and no duplicate hook entries on re-run
2. **Hook suggestion unit test:** Create minimal skills directory with 2 skills; invoke hook with crafted JSON payload; assert output contains expected skill name
3. **Hook resilience test:** Set `GOODAI_BASE` to nonexistent path; assert exit code 0 and log file written
4. **Integration test:** Deploy to a real project repo, submit a prompt known to match a skill trigger, visually confirm the Skill Suggestions block appears
5. **Override tests:** Add to `disabled`, submit matching prompt, confirm skill absent; add to `local_skills`, submit matching prompt, confirm local skill appears

---

## 12. Deliverables

| Artifact | Path |
|----------|------|
| Deploy script | `~/goodai-base/scripts/deploy-skill-hook.sh` |
| Hook template (canonical) | `~/goodai-base/scripts/templates/skill-evaluator.sh` |
| Override JSON schema | `~/goodai-base/rules/schemas/skill-overrides.schema.json` |
| This PRD | `~/goodai-base/jobs/prd-skill-automation/prd-2-project-deployment.md` |
