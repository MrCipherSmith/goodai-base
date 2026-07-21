# Acceptance Criteria

Rules:

- Criteria lines use the exact format `- ACn: <criterion>`.
- After `flow freeze` this file is checksum-protected: any edit outside
  `keryx flow ac update` fails every gate and status transition.
- Completion requires every ACn to be confirmed via
  `keryx flow ac confirm <id> <ACn>`.

## Criteria

- AC1: Decision recorded in flow plan.md (7 only / 8 needed / neither)
- AC2: If Option 7: grok inspect still green and user has config snippet (or N/A if not chosen)
- AC3: If Option 8: sync --tools grok works with tests/docs/PR (or N/A if not chosen)
- AC4: If neither: explicit not-needed handoff with smoke evidence
