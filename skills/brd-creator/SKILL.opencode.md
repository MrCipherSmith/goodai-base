---
name: brd-creator
description: "Use when a user request needs to be transformed into a Business Requirements Document (BRD) capturing business context, stakeholders, and success metrics."
triggers:
  - "Create a BRD"
  - "Write business requirements"
  - "Business requirements document"
  - "Draft BRD"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "planning"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# BRD-Creator Sub-Agent

## 1. Purpose

Transforms a user request into a structured Business Requirements Document (BRD) that captures the business context, stakeholders, objectives, and success metrics needed to align teams before any design or implementation work begins.

Operates in two modes:
- **Direct Mode** — interacts with the user to gather context and produce a BRD
- **Orchestrated Mode** — invoked by `spec-orchestrator` with structured JSON input; returns document content

---

## 2. BRD Document Structure

Always produce these seven sections:

1. **Business Problem** — the core problem or opportunity being addressed
2. **Objectives** — measurable business goals (use OKR or KPI format where possible)
3. **Stakeholders** — who is affected, who decides, who must be informed
4. **Scope** — what is included in this initiative
5. **Success Metrics** — how success will be measured and by when
6. **Constraints** — business, regulatory, budget, and resource constraints
7. **Out of Scope** — explicit exclusions to prevent scope creep

---

## 3. Orchestrated Mode

### 3.1 Input Contract

See `input-contract.schema.json`. Key fields:

```json
{
  "request": "<original user request — always required>",
  "upstream": {
    "raw_requirements": "<raw-requirements.md content or null>",
    "brainstorm":       "<brainstorm.md content or null>"
  },
  "current_draft":      "<existing brd.md content — present only in refinement mode>",
  "reviewer_findings":  [
    { "id": "P-N", "location": "<section>", "severity": "blocker|major|minor", "description": "<what is wrong>" }
  ],
  "upstream_warnings":  ["<DONE_WITH_CONCERNS note from a prior stage>"]
}
```

### 3.2 Generation Mode (no `current_draft`)

Produce a BRD from scratch using `request` and any available `upstream` content.

When all upstream fields are null, prepend:
```
> Note: generated from raw request only — no upstream artifacts were available.
```

### 3.3 Refinement Mode (`reviewer_findings` present)

Address every finding in `reviewer_findings` within `current_draft`. Do **not** regenerate the document from scratch — preserve the original structure and revise only what the findings require. Mark addressed findings with inline notes if the change is non-obvious.

### 3.4 Output

Return the complete BRD document as a plain markdown string. Prefix your response with:

```
STATUS: DONE
```

The orchestrator writes the returned content to `brd.md`. Do not write files yourself in orchestrated mode.

---

## 4. Direct Mode

Interact with the user. Ask up to 5 clarifying questions if the request is ambiguous (prefer multiple-choice). Save the BRD to `docs/brd/` following `rules/core/documentation-management.mdc`.
