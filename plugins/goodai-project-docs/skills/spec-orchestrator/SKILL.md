---
name: spec-orchestrator
description: "Use when a user request needs to be converted into a full pre-implementation documentation suite (BRD → PRD → FSD → TRD) with iterative review at each document stage."
triggers:
  - "Create full spec"
  - "Write all docs"
  - "Full spec pipeline"
  - "Spec orchestrator"
  - "BRD to TRD"
  - "Pre-implementation docs"
  - "Prepare spec"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "orchestration"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill entirely.
Proceed directly with your assigned task.
</SUBAGENT-STOP>

# Spec Orchestrator

## 1. Purpose

Orchestrates the full pre-implementation documentation pipeline:

```
[Gather] → [Expand] → BRD → PRD → FSD → TRD
```

Stages 1–2 collect raw information. Stages 3–6 produce documents — each followed by an **iterative review loop** that refines the document until the reviewer finds zero problems (or `max_review_iterations` is reached).

**PRD is mandatory.** All other stages are optional and skippable.

---

## 2. Stage Table

| # | Stage key | Sub-skill | Output artifact | Review loop |
|---|-----------|-----------|-----------------|-------------|
| 1 | `gather`  | `interviewer` (batch mode) | `raw-requirements.md` | no |
| 2 | `expand`  | `brainstorm` (batch mode) | `brainstorm.md` | no |
| 3 | `brd`     | `brd-creator` (new) | `brd.md` | yes |
| 4 | `prd`     | `prd-creator` (existing) | `prd.md` | yes |
| 5 | `fsd`     | `fsd-creator` (new) | `fsd.md` | yes |
| 6 | `trd`     | `trd-creator` (new) | `trd.md` | yes |

### Skipping stages

Set `skip_stages` to an array of stage keys. `"prd"` cannot be skipped — it causes an immediate validation error. Unknown keys produce a warning and are ignored.

### Early exits (before any stage runs)

- `request` is empty or a single word → `STATUS: NEEDS_CONTEXT`. No files created.
- `prd-creator` skill is absent from the runtime → `STATUS: BLOCKED`. No files created.

### Optional stage not found

When an optional stage's skill is absent from the runtime, mark the stage `SKIPPED` (logged as "Skill not found") and continue.

### Creator failure

- Optional stage creator fails → stage marked `SKIPPED`. Pipeline continues.
- PRD creator fails → write log with `STATUS: BLOCKED`. Pipeline stops.

---

## 3. Artifact Location

```
<JOBS_ROOT>/<job-name>/
  raw-requirements.md
  brainstorm.md
  brd.md
  prd.md            ← mandatory
  fsd.md
  trd.md
  spec-pipeline-log.md
```

**Job name derivation** (when `job_name` not provided): lowercase → strip punctuation (keep spaces) → first 5 words → replace spaces with hyphens. Example: "Add JWT auth!" → `add-jwt-auth`. Auto-append `-2`, `-3`... on collision.

---

## 4. Stages 1–2: Gather and Expand

Invoke each sub-skill with `mode: "batch"`. If a skill doesn't support batch mode, use the fallback below. If the skill is absent entirely, mark the stage SKIPPED.

**Stage 1 batch envelope:**
```json
{ "mode": "batch", "request": "<request>", "output_path": "<JOBS_ROOT>/<job-name>/raw-requirements.md" }
```
**Fallback** (batch unsupported): write `request` content directly to `raw-requirements.md`; mark DONE.

**Stage 2 batch envelope:**
```json
{
  "mode": "batch",
  "request": "<request>",
  "upstream": { "raw_requirements": "<raw-requirements.md content or null>" },
  "output_path": "<JOBS_ROOT>/<job-name>/brainstorm.md"
}
```
**Fallback** (batch unsupported): spawn a general-purpose sub-agent with `request` + `raw_requirements` as context to produce `brainstorm.md`; mark DONE.

---

## 5. Review Loop (stages 3–6)

### 5.1 Reviewer Model Resolution

Resolved once at startup, used for all reviewer invocations. Priority order (highest first):

1. `reviewer_model` input field
2. `GOODAI_SPEC_REVIEWER_MODEL` env var
3. Provider detection:
   - `ANTHROPIC_API_KEY` set or session model contains `claude` → cheapest available Haiku model (verify in Anthropic catalogue at implementation time; at spec-writing time: `claude-haiku-4-*` family)
   - `OPENAI_API_KEY` set or session model contains `gpt`/`o1`/`o3`/`o4` → `gpt-4o-mini`
   - `OPENROUTER_API_KEY` or `OPENAI_BASE_URL` set → omit model param
   - None of the above → omit model param

### 5.2 Loop Pseudocode

```python
# Generation pass
content = creator({ request, upstream, upstream_warnings })
# brd/fsd/trd-creator return content; prd-creator writes to output_path itself (content=None)
if content is not None:
    write(artifact_path, content)
artifact_content = read(artifact_path)

fixer_calls = 0
problems = []
while fixer_calls < max_review_iterations:
    result = reviewer({
        request, artifact_path, artifact_content,
        codebase_path,   # null for BRD/PRD
        upstream_artifacts,   # all prior artifacts available to this stage
        mission_instruction
    })
    problems = result["problems"]
    if len(problems) == 0:
        break
    content = creator({ request, upstream, current_draft: artifact_content,
                        reviewer_findings: problems, upstream_warnings })
    if content is not None:
        write(artifact_path, content)
    artifact_content = read(artifact_path)
    fixer_calls += 1

# Final reviewer pass after max iterations
if fixer_calls == max_review_iterations and len(problems) > 0:
    result = reviewer({ ..., artifact_content })
    problems = result["problems"]

stage_status = DONE if len(problems) == 0 else DONE_WITH_CONCERNS
```

`max_review_iterations` defaults to 5. Values ≤ 0 are reset to 5 with a log warning.

### 5.3 Reviewer Input Contract

The reviewer is a sub-agent (no separate SKILL.md). It receives **full upstream context** — not a clean-context call — so it can check cross-artifact consistency:

```json
{
  "request":            "<original user request>",
  "artifact_path":      "<path to the document being reviewed>",
  "artifact_content":   "<full document text>",
  "codebase_path":      "<path or null>",
  "upstream_artifacts": {
    "raw_requirements": "<content or null>",
    "brainstorm":       "<content or null>",
    "brd":              "<content or null>",
    "prd":              "<content or null>",
    "fsd":              "<content or null>"
  },
  "mission_instruction": "<stage-specific instruction below>"
}
```

**BRD and PRD mission instruction:**
> "Review this document for completeness and internal consistency. Use the upstream artifacts and original request to check that requirements are covered and nothing contradicts them. Return JSON: `{\"problems\": [{\"id\": \"P-N\", \"location\": \"<section>\", \"severity\": \"blocker|major|minor\", \"description\": \"<what and why>\"}]}`. If no problems: `{\"problems\": []}`."

**FSD and TRD mission instruction:**
> "Review this document for completeness and internal consistency. Use the upstream artifacts to check cross-document consistency. If `codebase_path` is not null, also verify that technology and architecture claims match the actual codebase. Return JSON: `{\"problems\": [{\"id\": \"P-N\", \"location\": \"<section>\", \"severity\": \"blocker|major|minor\", \"description\": \"<what and why>\"}]}`. If no problems: `{\"problems\": []}`."

Pass only the artifacts that were produced by prior stages; set others to null.

**Invalid reviewer response:** retry once. If second call is also invalid, mark stage `DONE_WITH_CONCERNS` and log the failure.

### 5.4 DONE_WITH_CONCERNS Propagation

A stage that exits DONE_WITH_CONCERNS passes its artifact to downstream stages unchanged. Add an entry to `upstream_warnings` for each DONE_WITH_CONCERNS stage so downstream creators are aware.

---

## 6. Sub-Agent Envelopes

### 6.1 brd-creator (generation)

```json
{
  "request": "<request>",
  "upstream": { "raw_requirements": "<content or null>", "brainstorm": "<content or null>" },
  "upstream_warnings": ["<notes>"]
}
```

### 6.2 brd-creator (refinement)

```json
{
  "request": "<request>",
  "upstream": { "raw_requirements": "<content or null>", "brainstorm": "<content or null>" },
  "current_draft": "<brd.md content>",
  "reviewer_findings": [{ "id": "P-N", "location": "...", "severity": "...", "description": "..." }],
  "upstream_warnings": ["<notes>"]
}
```

### 6.3 prd-creator (generation)

```json
{
  "mode": "orchestrated",
  "initialRequest": "<request>",
  "upstream_context": "<first available: brd.md → brainstorm.md → raw-requirements.md → null>",
  "metadata": { "output_path": "<JOBS_ROOT>/<job-name>/prd.md" },
  "upstream_warnings": ["<notes>"]
}
```

### 6.4 prd-creator (refinement)

```json
{
  "mode": "orchestrated",
  "initialRequest": "<request>",
  "upstream_context": "<same as generation call>",
  "metadata": { "output_path": "<JOBS_ROOT>/<job-name>/prd.md" },
  "current_draft": "<current prd.md content>",
  "reviewer_findings": [{ "id": "P-N", "location": "...", "severity": "...", "description": "..." }],
  "upstream_warnings": ["<notes>"]
}
```

prd-creator writes `prd.md` to `metadata.output_path` itself. After each invocation, read `prd.md` from that path to get `artifact_content`.

### 6.5 fsd-creator (generation)

```json
{
  "request": "<request>",
  "upstream": { "brd": "<content or null>", "prd": "<prd.md content>" },
  "codebase_path": "<path or null>",
  "upstream_warnings": ["<notes>"]
}
```

### 6.6 fsd-creator (refinement)

Add `"current_draft"` and `"reviewer_findings"` to the generation envelope.

### 6.7 trd-creator (generation)

```json
{
  "request": "<request>",
  "upstream": { "brd": "<content or null>", "prd": "<prd.md content>", "fsd": "<content or null>" },
  "codebase_path": "<path or null>",
  "upstream_warnings": ["<notes>"]
}
```

### 6.8 trd-creator (refinement)

Add `"current_draft"` and `"reviewer_findings"` to the generation envelope.

---

## 7. Input Contract

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `request` | string | yes | User intent. Empty or single-word → NEEDS_CONTEXT. |
| `skip_stages` | string[] | no | Keys to skip. `"prd"` is rejected. Unknown keys warned. |
| `job_name` | string | no | Explicit job name. Auto-derived if absent. |
| `jobs_root` | string | no | Override jobs root path. |
| `reviewer_model` | string | no | Explicit reviewer model id. Highest priority in §5.1. |
| `max_review_iterations` | int | no | Max fixer calls per stage. Default: 5. Values ≤ 0 reset to 5. |
| `codebase_path` | string\|null | no | Path to codebase for FSD/TRD checks. Defaults to CWD. |

---

## 8. Output Contract

```
STATUS: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
```

- `DONE` — all active document stages completed with zero remaining problems.
- `DONE_WITH_CONCERNS` — at least one stage's final reviewer pass left unresolved problems.
- `BLOCKED` — prd-creator missing at startup, or PRD creator failed at runtime.
- `NEEDS_CONTEXT` — request too short to act on.

---

## 9. Pipeline Log (`spec-pipeline-log.md`)

Not written for NEEDS_CONTEXT or startup BLOCKED exits. Written for all other exits including runtime PRD BLOCKED.

```markdown
# Spec Pipeline Log

## Run metadata
- job: <job-name>
- started_at: <ISO timestamp>
- reviewer_model: <resolved model id, gpt-4o-mini, or model_omitted>
- skip_stages: [<list or "none">]
- max_review_iterations_effective: <N>

## Stage results

### Stage N: <Name>
- status: DONE | DONE_WITH_CONCERNS | SKIPPED | BLOCKED
- fixer_invocations: <N or N/A>
- reviewer_invocations: <N or N/A>
- artifact: <path or "none">
- problems_found_initial: <count or N/A>
- problems_remaining: <count or N/A>

<If problems_remaining > 0, list findings from final reviewer pass>

## Final status
STATUS: DONE | DONE_WITH_CONCERNS | BLOCKED
```

---

## 10. Implementation Steps

1. Create `skills/spec-orchestrator/SKILL.md` ← this file
2. Create `skills/brd-creator/SKILL.md` and `skills/brd-creator/input-contract.schema.json`
3. Create `skills/fsd-creator/SKILL.md` and `skills/fsd-creator/input-contract.schema.json`
4. Create `skills/trd-creator/SKILL.md` and `skills/trd-creator/input-contract.schema.json`
5. Modify `skills/prd-creator/SKILL.md` — document orchestrated mode refinement behavior; document that prd-creator writes to `metadata.output_path` in orchestrated mode
6. Modify `skills/prd-creator/input-contract.schema.json` — add optional fields: `upstream_context` (string|null), `metadata.output_path` (string), `current_draft` (string), `reviewer_findings` (array), `upstream_warnings` (array)
7. Update `AGENTS.md` routing entries for all new/modified skills
8. Run `cd scripts && bun run generate-agents`
9. Bump `CHANGELOG.md`
10. Run `cd scripts && bun test` — confirm all existing tests pass
