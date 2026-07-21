# Plan — Day 0

## Approach

1. Inspect `skills/` for untracked `SKILL.*.md` only; delete junk clones if any.
2. Run validate; if blocked by missing profiles, sync with `--skip-validation`; else full sync.
3. Confirm `sync_tools` includes `claude`.
4. Smoke Grok via `grok inspect` for target skill names.
5. Record evidence in journal; complete as **handoff without PR**.

## Trade-offs

- May use `--skip-validation` pre-Day-1; that is expected and temporary.
- Do not touch validator code (Day 1).
- Do not remove tracked platform profiles.

## Tasks mapping

| Task | Work |
|------|------|
| T1 context | Status of profiles + config |
| T2 implement | Sync + Grok smoke commands |
| T3 test | Not applicable — skip |
| T4 review | Journal report + handoff (no draft PR) |
