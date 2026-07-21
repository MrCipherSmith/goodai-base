# Acceptance Criteria

Rules:

- Criteria lines use the exact format `- ACn: <criterion>`.
- After `flow freeze` this file is checksum-protected: any edit outside
  `keryx flow ac update` fails every gate and status transition.
- Completion requires every ACn to be confirmed via
  `keryx flow ac confirm <id> <ACn>`.

## Criteria

- AC1: validate-skills-before-sync passes without requiring cursor/codex files
- AC2: unit tests updated and green
- AC3: sync-skills works without --skip-validation
- AC4: docs no longer contradict (CONTRIBUTING / workflow / scripts README / onboarding Grok)
- AC5: draft PR opened with link to requirements package
