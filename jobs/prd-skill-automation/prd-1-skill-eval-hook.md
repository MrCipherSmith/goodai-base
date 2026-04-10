# PRD: Skill Evaluation Hook — Auto Skill Selection System

## 1. Overview

A `UserPromptSubmit` hook (`skill-eval.js`) that intercepts every user prompt before Claude processes it, scores it against a registry of skill trigger patterns, and injects a structured skill suggestion into Claude's context when confidence is high enough. This eliminates the need for users to manually name a skill or navigate the AGENTS.md routing table for common, well-defined intents.

---

## 2. Context

- **Product:** goodai-base (knowledge-base repo for Claude Code / multi-tool agents)
- **Module:** Hooks system (`~/.claude/settings.json` → `UserPromptSubmit`)
- **User Role:** Developer using Claude Code interactively or via Telegram channel
- **Tech Stack:** Node.js (CommonJS), JSON settings, Markdown skill definitions, existing `skills/*/SKILL.md` frontmatter
- **Reference:** `MrCipherSmith/claude-code-showcase` — `skill-eval.js` hook using keyword/regex/path pattern scoring (keyword=2pts, path=5pts)

---

## 3. Problem Statement

Skill selection in goodai-base is entirely manual. Users must either know the exact skill name or navigate the AGENTS.md routing table. The routing logic in AGENTS.md is rich but entirely in Claude's reasoning loop — there is no mechanical pre-filter. The showcase repo demonstrates a hook-based pre-filter that adds near-zero latency and runs outside the LLM loop.

---

## 4. Goals

- Automatically detect the most relevant skill(s) for a given prompt before Claude processes it
- Inject a ranked skill suggestion (with confidence score and rationale) into Claude's context via `UserPromptSubmit`
- Read skill trigger patterns from a single machine-readable registry — no code changes when skills are added
- Score prompts using keyword (+2pts), regex (+2pts), and file-path (+5pts) pattern matching
- Suggestions must be non-blocking and advisory only
- Integrate with `sync-skills.sh` so registry stays in sync with skill frontmatter

---

## 5. Non-Goals

- Replacing AGENTS.md routing logic or the Step 1.5 orchestrator check
- LLM inference inside the hook (pure JS, no API calls)
- Auto-invoking a skill without user visibility
- Supporting Cursor, Codex, Zed, or OpenCode hook formats in v1
- Multi-turn context awareness

---

## 6. Functional Requirements

**FR-1: Hook Registration** — A `UserPromptSubmit` hook registered in `~/.claude/settings.json` pointing to `~/goodai-base/hooks/skill-eval.js`.

**FR-2: Skill Registry File** — `~/goodai-base/hooks/skill-registry.json` with skill descriptors:
```json
{
  "skills": [
    {
      "name": "feature-analyzer",
      "description": "Deep cross-repo analysis of feature branches",
      "keywords": ["analyze branch", "cross-repo", "investigate"],
      "patterns": ["\\banalyze\\b.*\\bbranch\\b"],
      "paths": ["*.feature.ts"],
      "minScore": 4
    }
  ],
  "hookConfig": {
    "enabled": true,
    "maxSuggestions": 3,
    "globalMinScore": 4,
    "wholeWordMatch": false
  }
}
```
Each keyword match = +2pts, regex match = +2pts, path match = +5pts.

**FR-3: Scoring Engine** — Per-skill score computed from keyword/regex/path matches; ranked descending; `minScore` threshold applied.

**FR-4: Context Injection** — Output JSON `{ "skillSuggestions": [...] }` with fields: `skill`, `score`, `confidence` (high/medium/low), `reason`.

**FR-5: Claude Context Prompt Prefix** — Natural-language prefix injected into context:
```
[Skill Evaluator] Suggested skill(s) based on prompt analysis:
1. feature-analyzer (HIGH, score=7) — matched: "analyze branch", path ".feature.ts"
```

**FR-6: Registry Sync** — `scripts/generate-skill-registry.sh` regenerates registry from `skills/*/SKILL.md` `triggers` frontmatter field. Integrated into `sync-skills.sh`.

**FR-7: Logging** — One-line log per invocation to `~/.claude/logs/skill-eval.log` (timestamp, prompt length, top skill + score). Truncated at 500KB.

**FR-8: Configuration** — `hookConfig` block: `enabled`, `maxSuggestions` (default 3), `globalMinScore` (default 4), `wholeWordMatch` (default false).

---

## 7. Non-Functional Requirements

- **NFR-1: Latency** — Under 50ms for prompts up to 10,000 chars
- **NFR-2: Reliability** — All errors caught; on error output `{"skillSuggestions":[]}` and log; never crash Claude Code
- **NFR-3: Maintainability** — Adding a skill requires only registry update, no code changes to `skill-eval.js`
- **NFR-4: Testability** — Export `scorePrompt(prompt, registry)` as a pure function for unit testing
- **NFR-5: Compatibility** — Node.js 18+, built-ins only, no npm dependencies
- **NFR-6: No LLM Dependency** — Fully deterministic, offline

---

## 8. Constraints

- Hook receives raw prompt as stdin; output to stdout as JSON
- Pure Node.js, CommonJS-safe
- Suggestions advisory only — AGENTS.md Step 1.5 routing remains authoritative
- Hook script and registry live in `~/goodai-base/hooks/`
- `triggers` frontmatter in `SKILL.md` files is the canonical source for auto-generated keywords

---

## 9. Edge Cases

| Case | Handling |
|------|----------|
| Score tie | Both injected; path-match skills rank higher |
| Prompt < 5 chars | Skip scoring, empty output |
| Prompt explicitly names a skill | Hook suggests it (high score), Claude sees alignment |
| Registry missing/malformed | Catch, log, empty output, no crash |
| All scores 0 | Empty output, no prefix injected |
| `enabled: false` | Exit immediately with empty output |
| Russian prompts | Registry includes Russian variants ("полное ревью" → `job-orchestrator`) |

---

## 10. Acceptance Criteria (Gherkin)

```gherkin
Feature: Skill Evaluation Hook auto-suggests skills on prompt submission

  Scenario: High-confidence keyword match triggers suggestion
    Given the skill registry contains "commit" with keywords ["commit", "stage", "git commit"]
    And the global minScore is 4
    When the user submits "commit my changes with a good message"
    Then skillSuggestions contains "commit" with score >= 4
    And context prefix includes "[Skill Evaluator] Suggested skill(s)"

  Scenario: Path pattern boosts score above threshold
    Given the registry has "code-mobx-store-review" with paths [".store.ts"]
    When the user submits "review UserStore.store.ts for correctness"
    Then "code-mobx-store-review" receives +5 from path match and appears in skillSuggestions

  Scenario: No match produces empty suggestions
    Given no skill scores >= minScore
    When the user submits "what is the meaning of life"
    Then skillSuggestions is an empty array and no prefix is injected

  Scenario: Hook error does not crash Claude Code
    Given skill-registry.json is malformed JSON
    When the hook is invoked
    Then output is {"skillSuggestions": []} and an error is logged
    And Claude Code continues normally

  Scenario: Registry sync regenerates keywords from frontmatter
    Given a new skill with triggers ["Create migration", "Run migrations"]
    When generate-skill-registry.sh runs
    Then skill-registry.json contains it with those keywords lowercased

  Scenario: maxSuggestions cap is respected
    Given maxSuggestions is 2 and 5 skills score above threshold
    Then only the top 2 appear in skillSuggestions

  Scenario: Russian trigger keyword matches
    Given "job-orchestrator" has keyword "полное ревью"
    When the user submits "полное ревью моего кода"
    Then "job-orchestrator" appears in skillSuggestions

  Scenario: Hook completes within latency budget
    Given a 10,000-char prompt and a registry with 40 skills
    When the hook executes
    Then total execution time is under 50ms
```

---

## 11. Verification

**Unit tests** (`hooks/skill-eval.test.js`): test `scorePrompt` pure function with fixtures covering all match types, tie-breaking, error paths.
```bash
node --test hooks/skill-eval.test.js
```

**Integration test**: register hook, submit "commit all staged files", verify `[Skill Evaluator]` appears in Claude context and log entry is written.

**Registry sync test**: add dummy skill, run `generate-skill-registry.sh`, assert it appears in registry with correct keywords.

**Performance test**: `time node hooks/skill-eval.js` with 10,000-char stdin — assert < 50ms.

**Observability**: `~/.claude/logs/skill-eval.log` one entry per prompt. Registry `mtime` must be newer than all source `SKILL.md` files after sync.

---

## 12. Deliverables

| Artifact | Path |
|----------|------|
| Hook script | `~/goodai-base/hooks/skill-eval.js` |
| Skill registry | `~/goodai-base/hooks/skill-registry.json` |
| Registry generator | `~/goodai-base/scripts/generate-skill-registry.sh` |
| Unit tests | `~/goodai-base/hooks/skill-eval.test.js` |
| Hook registration | `~/.claude/settings.json` (UserPromptSubmit entry) |
| This PRD | `~/goodai-base/jobs/prd-skill-automation/prd-1-skill-eval-hook.md` |
