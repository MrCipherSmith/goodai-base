# Skill Authoring Template

The canonical shape for a `skills/<name>/SKILL.md` in goodai-base.

It codifies three discipline sections — **Rationalizations**, **Red Flags / Iron Law**,
and a **Verification Checklist** — adopted from the Google-style engineering discipline in
[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) and required by
[agent-discipline phase 2 (anti-rationalization)](./agent-discipline/phase-2-anti-rationalization.md).

> Descriptions are **triggers, not workflow summaries** — say *when* to use the skill
> ("Use when X … NOT for Y"), per [phase 1](./agent-discipline/phase-1-cso-descriptions.md).

---

## Frontmatter (required)

```yaml
---
name: my-skill                 # kebab-case, matches folder name
description: "Use when <trigger condition> … NOT for <anti-trigger>."
triggers:                      # phrases / slash-commands that route to this skill
  - "/my-skill"
  - "natural language trigger"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"             # semver — bump on behavior change (see CLAUDE.md)
  category: "validation"       # validation | quality | orchestration | utility | review | ...
  agent_worthy: true           # optional — set when the skill runs well as a sub-agent
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---
```

## Body sections

```markdown
# <Skill Title>

## What It Does
One paragraph: the outcome, not the mechanism.

## When to Use   (and when NOT to)
Bullets of trigger conditions. Always include an explicit "Avoid when / NOT for" list —
an anti-trigger prevents mis-routing.

## The Process
Numbered, checkpointed steps with clear exit criteria. Keep load-bearing details
(the parts an agent skips under pressure) in their own callout.

## Rationalizations — Stop and re-read the rule if you think:
A table of the *verbatim, first-person* excuses an agent generates under pressure,
each paired with a concrete (not abstract) rebuttal.

| Rationalization | Why it is wrong |
|---|---|
| "This is too small to bother with the process" | Simplicity of the task does not remove the process |
| "The user is in a hurry, I'll skip X" | Violating the letter is violating the spirit |
| "I understood it from the description, no need to read on" | The description is a trigger, not the workflow |

**IRON LAW: <the one non-negotiable rule, in caps>.**

## Red Flags
Bullet list of observable behaviors that mean the skill is being subverted
(e.g. "prompting 'is this good?' instead of 'find issues'").

## Verification Checklist
- [ ] Objective, checkable exit conditions — evidence, not "seems right"
- [ ] Each item is something a reviewer could confirm from the artifact

## STATUS Protocol (if run as a sub-agent)
STATUS: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
(see rules/core/subagent-status-protocol.md)
```

---

## Why these three sections

| Section | Failure mode it closes |
|---|---|
| **Rationalizations** | The agent follows the *letter* of a rule while violating its *spirit*, using a self-generated excuse. Naming the excuse verbatim removes the loophole. |
| **Red Flags / Iron Law** | Rules described only as "what to do" don't survive pressure. One caps-locked law + observable red flags give a hard stop. |
| **Verification Checklist** | "Seems right" is not evidence. Checkable exit criteria force proof. |

Write rationalizations **from the agent's first person** ("I think…"), and make every
rebuttal concrete. Three is the minimum per skill (agent-discipline phase-2 acceptance criteria).

## Authoring workflow (per CLAUDE.md)

1. Create `skills/<name>/SKILL.md` from this template.
2. `cd scripts && bun run validate-skills-before-sync` — validate frontmatter.
3. `bun run sync-skills` — generate provider variants (`SKILL.codex.md`, `.cursor.md`, …).
4. `bun run generate-agents` + `bun run generate-skill-catalog` + `bun run generate-skill-registry`.
5. Update `CHANGELOG.md` with the version bump.
