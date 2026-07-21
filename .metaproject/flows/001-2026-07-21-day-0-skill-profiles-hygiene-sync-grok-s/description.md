# Day 0: skill profiles hygiene + sync + Grok smoke

Status: ready for freeze  
Source: PHASE 0 prompt + docs/requirements/canonical-skill-profiles-and-grok/

## Problem

Operators need a clean local baseline before Day 1 (strategy A validator change):
no junk untracked skill profiles, skills synced to tools, Grok able to discover
goodai skills via Claude compat.

## Expected Outcome

- No untracked platform profile junk under `skills/`
- Skills synced (claude at minimum)
- `grok inspect` shows `job-orchestrator` and `brd-creator` or `spec-orchestrator`
- Journal documents validate/sync/grok evidence

## Out of Scope

- Day 1 validator/tests/docs/PR (strategy A implementation)
- Deleting tracked platform profiles on main
- Grok `[skills] paths` or `sync-skills` grok target (optional phase)
- Creating new skill profile copies
