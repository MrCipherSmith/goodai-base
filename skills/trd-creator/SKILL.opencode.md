---
name: trd-creator
description: "Use when PRD and FSD exist and need to be expanded into a Technical Requirements Document (TRD) covering architecture, tech stack, data models, API contracts, and non-functional requirements."
triggers:
  - "Create a TRD"
  - "Write technical requirements"
  - "Technical requirements document"
  - "Draft TRD"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "planning"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# TRD-Creator Sub-Agent

## 1. Purpose

Expands PRD and FSD into a Technical Requirements Document (TRD) that specifies how the system must be built — architecture decisions, data models, API contracts, NFRs, and deployment notes — grounding functional requirements in technical reality.

Operates in two modes:
- **Direct Mode** — interacts with the user
- **Orchestrated Mode** — invoked by `spec-orchestrator` with structured JSON input; returns document content

---

## 2. TRD Document Structure

Always produce these seven sections:

1. **Architecture** — system architecture decisions, component boundaries, and key design patterns
2. **Tech Stack** — languages, frameworks, libraries, and services selected and why
3. **Data Models** — entity definitions, relationships, key fields, and storage decisions
4. **API Contracts** — endpoint signatures, request/response shapes, authentication, error codes
5. **Non-Functional Requirements** — performance targets, scalability, reliability, security, observability
6. **Integration Points** — external systems, third-party services, and internal service dependencies
7. **Deployment Notes** — infrastructure requirements, environment variables, migration steps, rollout strategy

---

## 3. Orchestrated Mode

### 3.1 Input Contract

See `input-contract.schema.json`. Key fields:

```json
{
  "request": "<original user request — always required>",
  "upstream": {
    "brd": "<brd.md content or null>",
    "prd": "<prd.md content — always present when trd-creator is invoked>",
    "fsd": "<fsd.md content or null>"
  },
  "codebase_path": "<path to project codebase, or null>",
  "current_draft":     "<existing trd.md content — present only in refinement mode>",
  "reviewer_findings": [
    { "id": "P-N", "location": "<section>", "severity": "blocker|major|minor", "description": "<what is wrong>" }
  ],
  "upstream_warnings": ["<DONE_WITH_CONCERNS note from a prior stage>"]
}
```

`prd.md` is always present when trd-creator is invoked: a PRD failure causes the pipeline to exit before this stage.

### 3.2 Generation Mode (no `current_draft`)

Produce a TRD from scratch. For each optional upstream artifact that is null, note its absence and state what assumptions the TRD makes in its place. If `codebase_path` is provided, inspect relevant files to ground tech stack and architecture claims in actual code.

### 3.3 Refinement Mode (`reviewer_findings` present)

Address every finding in `reviewer_findings` within `current_draft`. Do **not** regenerate from scratch — preserve the structure and revise only what the findings require.

### 3.4 Output

Return the complete TRD document as a plain markdown string. Prefix your response with:

```
STATUS: DONE
```

The orchestrator writes the returned content to `trd.md`. Do not write files yourself in orchestrated mode.

---

## 4. Direct Mode

Interact with the user. Ask for PRD/FSD content if not provided. Save the TRD to `docs/trd/` following `rules/core/documentation-management.mdc`.
