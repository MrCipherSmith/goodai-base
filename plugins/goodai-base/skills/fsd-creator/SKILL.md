---
name: fsd-creator
description: "Use when PRD and BRD exist and need to be expanded into a Functional Specification Document (FSD) detailing feature behavior, UI states, logic rules, and interface contracts."
triggers:
  - "Create a FSD"
  - "Write functional spec"
  - "Functional specification document"
  - "Draft FSD"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "planning"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# FSD-Creator Sub-Agent

## 1. Purpose

Expands a PRD (and optionally a BRD) into a Functional Specification Document (FSD) that precisely describes how the system should behave from a user and system perspective — without prescribing implementation technology.

Operates in two modes:
- **Direct Mode** — interacts with the user
- **Orchestrated Mode** — invoked by `spec-orchestrator` with structured JSON input; returns document content

---

## 2. FSD Document Structure

Always produce these six sections:

1. **Feature Behavior** — end-to-end user flows and system behavior descriptions
2. **UI States** — all UI states for each feature surface (empty, loading, error, success, edge cases)
3. **Logic Rules** — business logic rules, conditional behavior, and decision trees
4. **Validation Rules** — input validation requirements, constraints, and error messages
5. **Error Cases** — how the system handles failures, timeouts, and invalid states
6. **Interface Contracts** — external interfaces (APIs, events, integrations) this feature exposes or consumes

---

## 3. Orchestrated Mode

### 3.1 Input Contract

See `input-contract.schema.json`. Key fields:

```json
{
  "request": "<original user request — always required>",
  "upstream": {
    "brd": "<brd.md content or null>",
    "prd": "<prd.md content — always present when fsd-creator is invoked>"
  },
  "codebase_path": "<path to project codebase, or null>",
  "current_draft":     "<existing fsd.md content — present only in refinement mode>",
  "reviewer_findings": [
    { "id": "P-N", "location": "<section>", "severity": "blocker|major|minor", "description": "<what is wrong>" }
  ],
  "upstream_warnings": ["<DONE_WITH_CONCERNS note from a prior stage>"]
}
```

`prd.md` is always present when fsd-creator is invoked: a PRD failure causes the pipeline to exit before this stage.

### 3.2 Generation Mode (no `current_draft`)

Produce an FSD from scratch. When `brd` is null, prepend:
```
> Note: BRD was not produced in this pipeline run — FSD is based on PRD only.
```

If `codebase_path` is provided, inspect relevant files to ensure interface contracts and data model references are accurate.

### 3.3 Refinement Mode (`reviewer_findings` present)

Address every finding in `reviewer_findings` within `current_draft`. Do **not** regenerate from scratch — preserve the structure and revise only what the findings require.

### 3.4 Output

Return the complete FSD document as a plain markdown string. Prefix your response with:

```
STATUS: DONE
```

The orchestrator writes the returned content to `fsd.md`. Do not write files yourself in orchestrated mode.

---

## 4. Direct Mode

Interact with the user. Ask for PRD/BRD content if not provided. Save the FSD to `docs/fsd/` following `rules/core/documentation-management.mdc`.
