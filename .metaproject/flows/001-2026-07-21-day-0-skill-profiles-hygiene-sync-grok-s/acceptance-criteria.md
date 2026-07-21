# Acceptance Criteria

Rules:

- Criteria lines use the exact format `- ACn: <criterion>`.
- After `flow freeze` this file is checksum-protected: any edit outside
  `keryx flow ac update` fails every gate and status transition.
- Completion requires every ACn to be confirmed via
  `keryx flow ac confirm <id> <ACn>`.

## Criteria

- AC1: No untracked junk platform profiles left under skills/ (no untracked SKILL.cursor.md / SKILL.codex.md / SKILL.opencode.md / SKILL.zed.md)
- AC2: Skills synced to configured tools with claude at minimum (sync-skills or sync-skills --skip-validation completed successfully)
- AC3: grok inspect shows goodai skills job-orchestrator and brd-creator or spec-orchestrator
- AC4: Short report in flow journal.md with validate result, sync command used, and grok sample lines
