# Code Verifier

**Skill:** `skills/code-verifier/SKILL.md` · **Version:** v1.0.0
**Pipeline position:** task-implementer → **code-verifier** → review

Runs the full quality gate: lint, type-check, tests, circular import detection. Provides a structured pass/fail report the orchestrator uses to proceed or trigger a fix loop.

---

## When to Use

- Dispatched by `job-orchestrator` after each task-implementer wave (Step 7, mandatory)
- Dispatched again after fix iterations (Step 11, conditional)
- Dispatched by `feature-dev` Phase 6 (mandatory)
- Standalone: "run quality gate", "verify my code", "check lint and tests"

---

## How to Launch (standalone)

```
/code-verifier
```

Options:
```
/code-verifier --scope full          # check entire project, not just changed files
/code-verifier --path /project/path  # specify project directory
```

---

## What It Checks

```
Phase 1: DETECT
  → auto-detects package manager: bun / pnpm / npm / yarn / python / go
  → finds available tools: ESLint, Biome, tsc, vitest, jest, pytest, madge
  → determines scope: changed files (default) or full project

Phase 2: RUN — all checks, never aborts on first failure
  lint:             npx eslint <changed_files> --max-warnings 0
                    OR $RUNNER lint
  type-check:       npx tsc --noEmit
                    OR $RUNNER type-check
  tests:            $RUNNER test --run  (vitest)
                    OR npx jest --ci
                    OR pytest --tb=short -q
  circular-imports: npx madge --circular src/ (if madge installed)

Phase 3: ANALYZE
  → classifies findings by severity
  → determines gate status

Phase 4: REPORT
  → returns VERIFICATION_RESULT
```

---

## Severity Classification

| Finding | Severity | Gate impact |
|---|---|---|
| TypeScript type error | CRITICAL | FAIL |
| Test failure | CRITICAL | FAIL |
| ESLint error (not warning) | HIGH | FAIL |
| Circular import | HIGH | FAIL |
| ESLint warning | LOW | PASS_WITH_WARNINGS |
| Skipped test | INFO | no impact |

---

## Gate Logic

```
any CRITICAL or HIGH → gate: FAIL         → orchestrator triggers fix
LOW/INFO only        → gate: PASS_WITH_WARNINGS → proceed, log as informational
no findings          → gate: PASS         → proceed
```

---

## Output Format

```
VERIFICATION_RESULT:
  gate: PASS | PASS_WITH_WARNINGS | FAIL
  scope: changed

  checks:
    lint:
      status: pass
      errors: 0
      warnings: 2
      command_used: "npx eslint src/ --max-warnings 0"

    type_check:
      status: fail
      errors: 3
      command_used: "npx tsc --noEmit"

    tests:
      status: pass
      passed: 24
      failed: 0
      skipped: 1
      command_used: "bun test --run"

    circular_imports:
      status: pass
      cycles: 0

  findings:
    - severity: CRITICAL
      check: type-check
      file: src/services/UserService.ts
      line: 42
      rule: TS2345
      message: "Argument of type 'string' is not assignable to 'number'"

  summary: "1 type error blocks proceed. Lint clean. Tests green."

STATUS: DONE
```

---

## How Orchestrator Uses This

```
After task-implementer wave:
  dispatch code-verifier (scope: changed)

  IF gate == FAIL:
    extract CRITICAL/HIGH findings
    dispatch task-implementer in fix mode with findings
    re-dispatch code-verifier

    IF still FAIL after 2 cycles:
      escalate to user — ask: "Continue anyway? Abort?"

  IF gate == PASS or PASS_WITH_WARNINGS:
    proceed to review
    log LOW findings as informational in job docs
```

---

## Key Principle: Run ALL Checks

The verifier never aborts after the first failed check. Even if lint fails, it continues to type-check and tests. The orchestrator needs the complete picture to decide what to fix.

---

## See Also

- `skills/code-verifier/SKILL.md` — full specification
- `docs/agents/job-orchestrator.md` — where code-verifier fits in the full pipeline
- `rules/core/tdd-workflow.mdc` — TDD rules (tests must pass the gate)
