---
name: plan-gatekeeper
description: "Interactive relentless plan gatekeeper. Interrogates designs, checks constraints, and outputs ADRs. Use before implementation/execution phases."
triggers:
  - "/plan-gatekeeper"
  - "plan-gatekeeper"
  - "gatekeep plan"
  - "grill plan"
  - "stress-test plan"
metadata:
  author: "Antigravity"
  version: "1.0.0"
  category: "validation"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# Plan Gatekeeper

A relentless architectural and design gatekeeper. It interrogates the proposed implementation plan, stress-tests decisions against codebase constraints, and refuses to proceed until technical uncertainty is eliminated and architectural decisions are formalized (via ADRs).

## Input Contract

```json
{
  "plan": "The proposed implementation plan or steps",
  "context": "Context collected from context-collector or issue-analyzer",
  "project": "Absolute path to the project root directory",
  "known_facts": ["List of already known architectural decisions or facts"]
}
```

## Output Contract

Consistent with the Subagent Status Protocol:

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT",
  "decisions": [
    {"question": "...", "answer": "...", "impact": "high | medium"}
  ],
  "adr_proposals": [
    {
      "title": "...",
      "status": "Proposed | Accepted",
      "context": "...",
      "decision": "...",
      "consequences": "..."
    }
  ],
  "refined_plan": "Refined and validated version of the plan"
}
```

## Workflow

### Step 1: Design Verification
Analyze the proposed plan and context against the codebase. Identify the "core architectural layers" being touched (e.g. database, state store, API boundary, UI layer). Check for potential issues:
- Unhandled edge cases (network failure, concurrent actions, null/undefined values).
- Violation of codebase design guidelines (e.g., MobX stores not using action decorators, NestJS DTOs lacking validation tags, dependency cycle violations).
- Ambiguous API or data contract changes.

### Step 2: Relentless Interview
Generate a targeted set of critical questions (maximum 6 questions). Ask questions **one at a time**, offering options (A, B, C, D) where appropriate.

Do not proceed to the next question until the user has resolved the current one.
Each question must target a high-risk decision, e.g.:
- "How will we handle state synchronization between component X and store Y?"
- "Should database updates be run in a transaction?"
- "What is the error fallback behavior if the service call fails?"

### Step 3: Synthesis & ADR Generation
Once the interview is complete, compile the final results.
If the interview yielded major technical decisions, formulate them as ADRs using the specified response structure:

```
STATUS: DONE

## Completed
- Interrogated implementation plan and resolved all uncertainty zones

## Architectural Decisions (ADR)
- **Title**: [Title, e.g., use-mobx-for-local-state]
- **Status**: Accepted
- **Context**: [The problem and context]
- **Decision**: [The choice and reasoning]
- **Consequences**: [The trade-offs or constraints introduced]

## Refined Plan
[Provide the final, updated implementation steps]
```

## Rules of Engagement

1. **Be Rigorous**: Do not accept "I'll figure it out later" or vague answers. Push the user to define exact contracts or constraints.
2. **One Question at a Time**: Never dump multiple questions in a single turn. Wait for user response.
3. **Align with Codebase Patterns**: Check the existing codebase files (like `rules/core/`) to ensure the proposed answers conform to project-specific standards.
4. **Propose ADRs**: Any decision that alters data flow, database structure, framework libraries, or directory boundaries MUST be captured in a `## Architectural Decisions (ADR)` block.
