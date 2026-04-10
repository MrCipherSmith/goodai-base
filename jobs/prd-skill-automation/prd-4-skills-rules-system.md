# PRD: Unified Skills + Rules Activation System

## 1. Overview

A hook-based auto-detection system that analyses every incoming user prompt and injects BOTH relevant skills (as activation suggestions) AND relevant rules (as inline context) into Claude's active context window. The system is driven by a single `rules.json` registry defining trigger patterns for every skill and every rule in goodai-base. AGENTS.md remains the canonical source of truth for skill descriptions; `rules.json` is generated from it and kept in sync.

---

## 2. Context

| Field | Value |
|---|---|
| **Product** | goodai-base — Claude Code agent knowledge base |
| **Module** | Skills + Rules activation pipeline |
| **User Role** | Developer using Claude Code configured with goodai-base |
| **Tech Stack** | Bash/Zsh hooks, JSON registry, Claude Code settings.json hooks, Markdown `.mdc` rules, SKILL.md files |

---

## 3. Problem Statement

goodai-base includes skills (`skills/*/SKILL.md`), rules (`rules/core/*.mdc`), and AGENTS.md as a routing table. The existing showcase only evaluates **skills** for auto-detection. **Rules are never auto-injected** — a user asking "how do I write NestJS DTOs?" will not automatically receive `nestjs-dto.mdc` in context. Likewise, skill routing relies entirely on the agent reading AGENTS.md manually.

**Result:** Context that should be injected is often missing, leading to incorrect outputs, missed standards, and repeated clarification cycles.

---

## 4. Goals

- **G-1:** Auto-detect relevant **rules** from any user prompt and inject them as context before the agent responds
- **G-2:** Auto-detect relevant **skills** from any user prompt and suggest activation
- **G-3:** Provide a single `rules.json` registry defining triggers for both skills and rules, generated from AGENTS.md
- **G-4:** Keep AGENTS.md as the **source of truth**; `rules.json` is derived and stays in sync automatically
- **G-5:** Separate injection mechanisms: rules → prepended as inline context; skills → suggested for Skill tool invocation
- **G-6:** Introduce `validate-rules-json.sh` to lint `rules.json` against AGENTS.md on every sync
- **G-7:** Zero-config for end users — detection runs automatically via Claude Code hooks

---

## 5. Non-Goals

- Does NOT replace AGENTS.md — it remains the human-readable routing table
- Does NOT auto-execute skills without user confirmation
- Does NOT support fuzzy-ML/embedding-based matching in v1 — keyword/regex triggers only
- Does NOT modify existing rule `.mdc` files or skill `SKILL.md` files
- Does NOT inject all rules simultaneously — only matched rules are injected
- Does NOT handle multi-turn session context accumulation in v1

---

## 6. Functional Requirements

**FR-1 — Rules Registry (`rules.json`)**
`~/goodai-base/rules.json` schema:
```json
{
  "version": "1.0.0",
  "generated_from": "AGENTS.md",
  "config": {
    "max_rules_injected": 3,
    "skill_auto_activate_threshold": 0.9,
    "rule_match_min_keywords": 1
  },
  "entries": [
    {
      "id": "nestjs-dto",
      "type": "rule",
      "path": "rules/core/nestjs-dto.mdc",
      "triggers": {
        "keywords": ["dto", "nestjs", "class-validator", "validation annotation"],
        "intents": ["how to write", "standards for", "create dto"]
      },
      "description": "NestJS DTO and validation annotation standards"
    },
    {
      "id": "feature-analyzer",
      "type": "skill",
      "path": "skills/feature-analyzer/SKILL.md",
      "triggers": {
        "keywords": ["analyze branch", "cross-repo", "investigate feature"],
        "intents": ["analyze", "investigate", "study"]
      },
      "description": "Deep cross-repository analysis of feature branches"
    }
  ]
}
```

**FR-2 — Prompt Analyzer (`detect-context.sh`)**
`scripts/detect-context.sh` accepts the user prompt as stdin, reads `rules.json`, and returns JSON:
```json
{
  "matched_rules": ["rules/core/nestjs-dto.mdc"],
  "matched_skills": ["skills/feature-analyzer"]
}
```

**FR-3 — Rule Injection**
Matched `.mdc` file content is prepended to Claude's context as:
```
<!-- AUTO-INJECTED RULE: nestjs-dto -->
{content of nestjs-dto.mdc}
```
Maximum 3 rules injected per turn by match score descending; excess matches noted but not injected.

**FR-4 — Skill Suggestion**
Structured suggestion block prepended to agent context:
```
[AUTO-DETECTED SKILL]: feature-analyzer
Trigger reason: prompt contains "analyze branch"
To activate: Use the `feature-analyzer` skill.
```

**FR-5 — Sync Script (`generate-rules-json.sh`)**
Parses AGENTS.md (Core Rule Catalog + Skills Catalog sections), extracts `id`, `path`, `description`, and trigger examples for each entry, writes/updates `rules.json`, preserves manually added `triggers.keywords`, outputs a diff summary.

**FR-6 — Validation Script (`validate-rules-json.sh`)**
Verifies:
- Every `path` in `rules.json` exists on disk
- Every skill/rule in AGENTS.md has a `rules.json` entry
- Warns on orphaned entries
- Exits non-zero on errors
Must be invoked by `validate-skills-before-sync.sh`.

**FR-7 — Hook Configuration**
Claude Code hook entry in `~/.claude/settings.json` under `hooks.UserPromptSubmit` calling `detect-context.sh`. Must fail-open (never block the prompt if the script fails).

**FR-8 — Manual Override**
Users suppress auto-injection for a single turn by prefixing their prompt with `!nocontext`. The flag is stripped before forwarding to Claude.

**FR-9 — Logging**
Each activation event appended to `~/.claude/logs/context-activation.log`:
```
2026-04-10T09:00:00Z | prompt_hash=abc123 | rules=[nestjs-dto] | skills=[feature-analyzer]
```

---

## 7. Non-Functional Requirements

- **NFR-1 — Performance:** `detect-context.sh` completes in under 200ms for prompts up to 2000 characters
- **NFR-2 — Reliability:** Hook must fail-open — errors pass the prompt through unmodified
- **NFR-3 — Coverage:** Initial `rules.json` must cover 100% of rules in Core Rule Catalog and 100% of skills in Skills Catalog
- **NFR-4 — Maintainability:** Adding a rule/skill to AGENTS.md + running `generate-rules-json.sh` is sufficient for it to participate in auto-detection
- **NFR-5 — Idempotency:** `generate-rules-json.sh` produces identical output on repeated runs given the same AGENTS.md
- **NFR-6 — Auditability:** All auto-injected context blocks are visually distinguishable via `<!-- AUTO-INJECTED -->` markers

---

## 8. Constraints

- Detection script must be pure Bash — no Node.js, Python, or external runtimes
- Must not modify AGENTS.md, any `SKILL.md`, or any `.mdc` file
- AGENTS.md is always the source of truth; `rules.json` is always derived from it
- Must be compatible with existing `sync-skills.sh` and `validate-skills-before-sync.sh` workflows
- v1 uses keyword/regex matching only (semantic/embedding matching deferred to v2)
- Maximum 3 rules injected per turn to avoid context window bloat

---

## 9. Edge Cases

| Case | Handling |
|------|----------|
| No matches | Pass through unmodified |
| Multiple rule matches above limit | Top 3 by keyword match count injected; remaining listed as a note |
| Rule file missing on disk | Caught at sync time by `validate-rules-json.sh`; at runtime skipped and logged |
| Ambiguous skill match (multiple at same score) | All suggested; none auto-activated |
| `!nocontext` prefix | Detection pipeline bypassed; flag stripped before forwarding |
| Large rule files (>10 KB) | Injected as truncated excerpt (first 5 KB) with note pointing to full path |
| AGENTS.md format changes | `generate-rules-json.sh` gracefully skips unrecognized sections |
| Concurrent hook executions | Log writes must be atomic (append-only with file locking) |

---

## 10. Acceptance Criteria (Gherkin)

```gherkin
Feature: Auto-injection of rules from prompt analysis

  Scenario: Rule injection for NestJS DTO question
    Given the user submits "How do I write NestJS DTOs with validation?"
    And rules.json contains an entry for "nestjs-dto" with keyword "dto"
    And rules/core/nestjs-dto.mdc exists on disk
    When the UserPromptSubmit hook runs detect-context.sh
    Then matched_rules contains "rules/core/nestjs-dto.mdc"
    And the content of nestjs-dto.mdc is prepended to Claude's context
    And the block starts with "<!-- AUTO-INJECTED RULE: nestjs-dto -->"

  Scenario: Skill suggestion for analysis request
    Given the user submits "Analyze branch changes in the pipeline"
    And rules.json contains an entry for "feature-analyzer" with keyword "analyze branch"
    When detect-context.sh runs
    Then matched_skills contains "skills/feature-analyzer"
    And the context includes a suggestion block mentioning "feature-analyzer"
    And no Skill tool call is made automatically

  Scenario: No injection on unmatched prompt
    Given the user submits "What is the weather today?"
    When detect-context.sh runs
    Then matched_rules is empty and matched_skills is empty
    And Claude's context is passed through unmodified

  Scenario: Manual override suppresses injection
    Given the user submits "!nocontext How do I write NestJS DTOs?"
    When the hook detects the "!nocontext" prefix
    Then detect-context.sh is NOT called
    And Claude receives "How do I write NestJS DTOs?" with no injected context

  Scenario: Injection limit enforced
    Given the prompt matches 5 different rules
    When detect-context.sh returns 5 matched rules
    Then only the top 3 by keyword match count are injected
    And a note lists the remaining 2

  Scenario: Fail-open on hook error
    Given detect-context.sh exits with non-zero status
    When the hook processes the prompt
    Then the prompt is passed to Claude unmodified with no user-visible error

  Scenario: generate-rules-json.sh produces valid output
    Given AGENTS.md contains all 19 rules and 28 skills
    When generate-rules-json.sh runs
    Then rules.json contains one entry per rule in Core Rule Catalog
    And one entry per skill in Skills Catalog
    And all entry "path" values resolve to existing files

  Scenario: validate-rules-json.sh detects missing file
    Given rules.json contains path "rules/core/nonexistent.mdc"
    When validate-rules-json.sh runs
    Then it exits non-zero with an error referencing the missing path

  Scenario: Sync workflow integration
    Given validate-rules-json.sh is registered in validate-skills-before-sync.sh
    When validate-skills-before-sync.sh runs
    Then validate-rules-json.sh is called in the validation chain
    And sync-skills.sh does not proceed if validate-rules-json.sh exits non-zero

  Scenario: Activation event logged
    Given a prompt matches one rule and one skill
    When the hook completes injection
    Then an entry is appended to ~/.claude/logs/context-activation.log
    And the entry contains prompt hash, matched rule IDs, and matched skill IDs
```

---

## 11. Architecture

```
UserPromptSubmit
      │
      ▼
[Hook: detect-context.sh]  ←── reads rules.json
      │
      ├── matched_rules  → inject .mdc content as <rule> blocks
      └── matched_skills → append skill suggestion block
                                    │
                                    ▼
                         [Claude processes augmented context]
                                    │
                                    ▼
                         [Agent follows AGENTS.md routing — unchanged]
```

---

## 12. Deliverables

| File | Purpose |
|------|---------|
| `rules.json` | Unified trigger registry for rules + skills |
| `scripts/detect-context.sh` | Prompt analyzer; returns matched entries as JSON |
| `scripts/generate-rules-json.sh` | Derives `rules.json` from AGENTS.md |
| `scripts/validate-rules-json.sh` | Validates `rules.json` against disk + AGENTS.md |
| `~/.claude/settings.json` | Add `UserPromptSubmit` hook entry |
| `scripts/validate-skills-before-sync.sh` | Add call to `validate-rules-json.sh` |
| `~/.claude/logs/context-activation.log` | Activation audit log |
| This PRD | `~/goodai-base/jobs/prd-skill-automation/prd-4-skills-rules-system.md` |

---

## 13. Open Questions

- Should `rules.json` include trigger *examples* from AGENTS.md descriptions, or require explicit `triggers` blocks in each SKILL.md?
- Who maintains trigger keywords for rules (`.mdc` files don't currently have frontmatter triggers)?
- Should rule injection truncation (10KB limit) warn Claude about the truncation, or silently truncate?
