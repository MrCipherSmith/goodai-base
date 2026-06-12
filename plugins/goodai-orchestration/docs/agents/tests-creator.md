# Tests Creator

**Skill:** `skills/tests-creator/SKILL.md` · **Version:** v1.0.0
**Pipeline position:** issue-analyzer → **tests-creator** → task-implementer

Generates failing test stubs (RED phase of TDD) from acceptance criteria before any implementation code is written. Mandatory in all implementing pipelines.

---

## When to Use

- Dispatched by `job-orchestrator` before every `task-implementer` wave (automatic)
- Dispatched by `feature-dev` Phase 4 (automatic)
- Standalone: "write tests first", "generate test specs", "TDD stubs for <feature>"

**NEVER skip this.** The Iron Law: no implementation code before failing tests exist.

---

## How to Launch (standalone)

```
/tests-creator
```

Or describe the task:
> "Write test cases for the UserValidator service before I implement it"
> "Generate TDD stubs from these acceptance criteria: [...]"

---

## What It Does

```
Phase 1: DETECT
  → reads package.json for test dependencies
  → finds vitest.config.ts / jest.config.ts / pytest.ini
  → reads 2-3 existing test files for conventions (import style, describe/it nesting, mock patterns)

Phase 2: ANALYZE
  → maps each acceptance criterion to scenarios:
     happy path: "User can register with valid email"
     edge case:  "Email must be ≤255 chars"
     error path: "Reject email without @ symbol"

Phase 3: GENERATE
  → writes test files using forward-declared assertions (call the future API)
  → tests FAIL because the module doesn't exist yet — that's correct
  → commits: "test(<scope>): add failing stubs for <task> [RED phase]"
  → runs tests, confirms all are FAILING

Phase 4: REPORT
  → returns TEST_CASE_SPECS to orchestrator/caller
```

---

## Output Format

```
TEST_CASE_SPECS:
  framework: vitest          ← detected automatically
  test_files:
    - path: src/__tests__/UserValidator.test.ts
      target_module: src/services/UserValidator.ts
      test_count: 6
      tests:
        - { id: test-1, description: "should accept valid email", type: happy_path, status: written }
        - { id: test-2, description: "should reject missing @",   type: error_path, status: written }
  run_command: "bun test src/__tests__/UserValidator.test.ts"
  expected_result: "all failing (RED phase)"

STATUS: DONE
tests_written: 6
all_criteria_covered: true
```

---

## Supported Frameworks

| Language | Framework | Detection |
|---|---|---|
| TypeScript / JavaScript | vitest | `vitest.config.*` or `vitest` in devDependencies |
| TypeScript / JavaScript | jest | `jest.config.*` or `jest` in devDependencies |
| TypeScript / JavaScript | bun:test | `bun.lockb` + no explicit framework |
| Python | pytest | `pytest` in `pyproject.toml` or `requirements.txt` |
| Go | go test | `go.mod` present |

---

## Test File Convention

Tests are written in the **forward-declared** style — they call the future API with real assertions. This means:

1. The test file imports a module that doesn't exist yet
2. The assertions describe exactly what the module must do
3. The file fails to compile/run until task-implementer creates the module
4. Once task-implementer implements the code, the tests go GREEN

This is stricter than `it.todo()` — it forces the implementer to match the exact API shape.

---

## Integration with task-implementer

When task-implementer receives `test_case_specs`:
1. Reads the test files (already committed, RED state)
2. Runs tests — confirms FAIL
3. Implements code until tests are GREEN
4. Does NOT rewrite or delete tests — only writes implementation

---

## See Also

- `skills/tests-creator/SKILL.md` — full specification
- `rules/core/tdd-workflow.mdc` — RED-GREEN-REFACTOR rules
- `docs/agents/job-orchestrator.md` — where tests-creator fits in the full pipeline
