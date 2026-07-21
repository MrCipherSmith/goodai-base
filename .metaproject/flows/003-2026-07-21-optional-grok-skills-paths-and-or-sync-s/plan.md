# Plan — Gate decision

## Smoke result
Grok already lists goodai skills via `~/.claude/skills` (Claude compat).

## Decision: **neither** (no code, no required local config change)

| Option | Decision | Why |
|--------|----------|-----|
| 7 Local `[skills] paths` | **Optional tip only** — not applied | Claude-compat sufficient; onboarding already documents snippet |
| 8 `sync-skills` grok target | **Not needed** | Gate: smoke green via claude; do not implement |

## Evidence
See journal.md for grok inspect sample.

## Optional user tip (not applied)
```toml
# ~/.grok/config.toml — only if you want zero-copy repo source
[skills]
paths = ["~/goodai-base/skills"]
[compat.claude]
skills = true
```
