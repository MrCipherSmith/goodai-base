---
name: review-ui-ux
description: |
  Use when: reviewing UI changes or a live page/screen for UX quality and AI-slop — usability
  heuristics, system states, forms, visual hierarchy, WCAG 2.2 AA, craft thresholds, and the
  generic "AI-generated look". Works on a diff (code mode) and on a running URL or screenshots
  (live mode). Triggers: "UI review", "UX review", "ревью UI/UX", "looks like AI slop?",
  "review --ui-ux", or dispatched by review-orchestrator for --ui-ux, --all, or diffs touching
  *.tsx, *.jsx, *.vue, *.svelte, *.css, *.scss, *.html.
  NOT for: React/MobX structure (review-frontend), naming and readability (review-style),
  re-render cost (review-performance), repository class conventions (review-frontend-conventions),
  or choosing/building a new design (ui-direction, ui-craft).
version: "1.0.0"
triggers:
  - "ui review"
  - "ux review"
  - "ui/ux review"
  - "ревью ui"
  - "review --ui-ux"
  - "ai slop check"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "review"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# Review — UI/UX & Anti-Slop

Read-only reviewer for what the user sees and does. Three passes, cheapest and most objective
first: deterministic checks → usability heuristics → aesthetic judgment. The tell catalog,
tiers, thresholds, and slop score come from `rules/core/ui-anti-slop.mdc` (`~/goodai-base/rules/core/ui-anti-slop.mdc` when running outside goodai-base) — read it first.
Never edits code; fixes are proposed, not applied.

---

## Workflow

```
review-ui-ux Progress:
- [ ] Step 1: Read Job Context and DESIGN.md (if present)
- [ ] Step 2: Determine mode (code | live | both) and scope
- [ ] Step 3: Restate context: product, audience, primary task, surface type
- [ ] Step 4: Pass 1 — deterministic checks (code + render)
- [ ] Step 5: Pass 2 — usability heuristics, states, forms
- [ ] Step 6: Pass 3 — hierarchy, distinctiveness, slop score
- [ ] Step 7: Rate severity, attach evidence, write fixes
- [ ] Step 8: Emit report; list checks not run
```

---

## Input Contract

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | no | Branch to review. Defaults to current branch. |
| `commit_range` | string | no | Explicit range. Overrides merge-base detection. |
| `url` | string | no | Running page/screen for live mode (dev server, preview, staging). |
| `screenshots` | string[] | no | Image paths when no URL is available. |
| `primary_task` | string | no | The one job the screen must enable. Inferred and stated if absent. |
| `context_doc` | string | no | Path to job context document. |

## Scope Detection

- **Code mode** — see `skills/shared/git-merge-base.md` for `BASE_SHA`; review UI files changed
  in scope (`*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.css`, `*.scss`, `*.html`, theme/token
  files, Tailwind config). Flag only what the diff introduced or touched.
- **Live mode** — `url` or `screenshots` given, or a dev server for the changed screens can be
  started from the project's own scripts. Render at **1440**, **768**, **390** px; light and dark
  when supported.
- **Both** — preferred whenever the changed screens can be rendered. Code shows intent; the render
  shows truth (computed contrast, actual fonts, real target sizes).

If neither a diff with UI files nor a renderable surface exists, return `NEEDS_CONTEXT`.

---

## Pass 1 — Deterministic checks

Objective, measurable, run first. Each finding cites the measured value and the threshold.

| Check | Code mode signal | Live mode measurement |
|---|---|---|
| Focus | `outline: none` / `outline-0` without `:focus-visible` | Tab through: ring visible, ≥3:1, not hidden by sticky bars (WCAG 2.4.7, 2.4.11) |
| Contrast | Token pairs computed from theme | Computed colors: text ≥4.5:1, large/UI ≥3:1 (1.4.3, 1.4.11) |
| Color-only meaning | Status by class color only | Errors/status readable in grayscale (1.4.1) |
| Targets | Icon buttons with tiny padding | ≥24×24px; ≥44px on touch (2.5.8) |
| Reduced motion | Animations with no `prefers-reduced-motion` branch; `transition: all` | Emulate reduced motion: content stays, travel stops |
| Reflow & zoom | `user-scalable=no`, fixed-height text boxes | 320px width: no 2-D scroll (1.4.10) |
| Names & semantics | Icon-only buttons without accessible name; `div` with `onClick`; heading skips | Accessibility tree check |
| Forms | Placeholder-as-label, missing `type`/`autocomplete`, pre-disabled submit, paste blocked | Submit empty: first error focused, message next to field |
| Fonts | Only Inter/Roboto/Arial/system in theme | Computed font-family on headings and body |
| Palette tells | `from-purple-* to-blue-*`, `bg-clip-text`, untouched `indigo-500`/`emerald-500` | Visible on render |
| Uniform surfaces | Same radius + shadow class on most containers; cards in cards | Visual scan |
| Copy tells | Filler verbs, emoji in headings, Jane Doe / Acme, lorem, invented round stats | Visible text |

## Pass 2 — Usability

Against the stated primary task:

- **Nielsen's 10 heuristics** — status visibility, real-world language, control & undo,
  consistency & standards, error prevention, recognition over recall, accelerators, minimalism,
  error recovery, help. Cite the heuristic number.
- **States** — every interactive element: hover, focus-visible, active, disabled, loading.
  Every data view: loading (indicator after ~150–300ms; percent-done + cancel ≥10s), empty
  (specific reason + action, never "No results" while loading), error (near source, cause +
  remedy, input kept), sparse, dense.
- **Forms** — labels, inline errors, no redundant entry (3.3.7), password managers allowed (3.3.8).
- **Laws of UX** — Fitts (primary actions large and near; destructive not adjacent to primary),
  Hick (choices reduced, recommended option marked), Jakob (behavior conventional even when the
  look is not), proximity/common region (grouping matches meaning).
- **Destructive & async** — confirm or Undo; optimistic updates roll back; double-submit guarded.

## Pass 3 — Hierarchy and distinctiveness

- **Squint test** — blur the render; the intended focal element still dominates. ≤3 contrast
  treatments and ≤2 large elements per view.
- **Five-second test** — first screen says what this is and what to do.
- **DESIGN.md conformance** — palette roles, type scale, signature element present and single,
  "not doing" list respected. Drift from DESIGN.md is a finding.
- **Swap / competitor test** — could a competitor's logo go on this unnoticed?
- **Slop score** — count tells by tier per `ui-anti-slop.mdc` (`T1×3 + T2×2 + T3×1`), list them,
  honor recorded exemptions. Score ≥9 → recommend `ui-direction`, not patching.
- **Restraint** — name the one element that should be removed.

---

## Severity

NN/g 0–4 mapped to the orchestrator scale. Rate after collecting, weighing frequency, impact,
and persistence.

| Severity | NN/g | Typical findings |
|---|---|---|
| `blocker` | 4 | Primary task impossible or unsafe; keyboard trap; invisible focus on primary flow; text contrast failure on primary content; destructive action without confirm/undo; invented proof (fake stats/logos/testimonials) |
| `major` | 3 | Missing loading/empty/error state on a primary view; WCAG 2.2 AA failure off the primary path; T1 slop tell; slop score ≥9; form errors not tied to fields |
| `minor` | 2 | T2 tells; hierarchy competition; inconsistent tokens; generic CTA labels; heuristic issues with workarounds |
| `info` | 1 | T3 tells; polish; craft suggestions; anything unmeasured that would otherwise be higher |

**Evidence law:** a contrast, size, or layout finding without a measurement (computed value,
screenshot region, or exact token pair) is capped at `info`.

## Finding Format

```markdown
### [F-001] Title

- **Severity**: blocker | major | minor | info
- **Criterion**: WCAG 2.5.8 | Nielsen #1 | State: empty | Slop T1: gradient text | DESIGN.md: palette
- **Location**: path/to/file.tsx:line | screenshot @390px, header region
- **Evidence**: measured value vs threshold (e.g. 3.1:1 vs 4.5:1; 18×18px vs 24×24px)
- **Impact**: what the user experiences
- **Fix**: concrete change (token, component, copy, state)
```

## Orchestrated Review Contract

When dispatched by `review-orchestrator`, follow the `reviewer-input.schema.json` payload. Return
a `REVIEW_RESULT` compatible with `skills/review-orchestrator/reviewer-finding.schema.json`, then a
concise markdown summary. Include `suggested_fix` for every blocker/major. Return `NEEDS_CONTEXT`
instead of guessing when the primary task or the renderable surface is unknown and needed.

## Output Contract

```
STATUS: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
```

- `DONE` — no blocker/major findings
- `DONE_WITH_CONCERNS` — one or more blocker/major findings
- `NEEDS_CONTEXT` — no UI in scope and nothing renderable, or primary task unknowable
- `BLOCKED` — cannot access diff or render; state reason

```markdown
# UI/UX Review Report

## Verdict: APPROVE | APPROVE_WITH_SUGGESTIONS | REQUEST_CHANGES

## Context
Product, audience, primary task, surface type (marketing | app), mode (code | live | both).

## Scores
- Slop score: N (T1: a, T2: b, T3: c) — <band>
- WCAG 2.2 AA floor: pass | fail (N issues)
- Viewports checked: 1440 / 768 / 390 | not run

## Top 3 changes
Highest-leverage fixes, in order.

## Blockers
## Major Issues
## Minor & Info

## What works (keep)
Specific strengths to protect from regressions.

## Checks not run
Every check skipped and why (no browser, no dark mode, no dev server…).
```

---

## Iron Laws

| Rule | Why |
|---|---|
| Read-only | Critique and fixing are separate jobs; mixing them hides findings |
| Measure on the render when possible | Class names are intent; pixels are truth |
| One tell is not slop; the stack is | Inter for body text alone is fine; five defaults together are not |
| Distinctive look, conventional behavior | Never penalize a standard interaction pattern as "generic" |
| DESIGN.md and recorded exemptions win | A deliberate choice is not a tell |
| Never claim checks that weren't run | List them under "Checks not run" |

## Scope Boundaries

| Concern | This skill | Use instead |
|---|---|---|
| Usability, states, forms, hierarchy, a11y floor, slop | YES | — |
| React/MobX structure, component boundaries | NO | `review-frontend` |
| Repository class/token conventions | NO | `review-frontend-conventions` |
| Naming, readability | NO | `review-style` |
| Re-render cost, bundle size | NO | `review-performance` |
| Logic bugs behind the UI | NO | `review-logic` |
| Creating a direction or rebuilding the UI | NO | `ui-direction`, `ui-craft` |

## Job Context Awareness

When dispatched with `JOB_NAME` / `CONTEXT_PATH`, read the context document before scope
detection. Use it for the primary task, audience, and any agreed design decisions; treat agreed
decisions like DESIGN.md exemptions.

## Red Flags

| Rationalization | Reality |
|---|---|
| "It looks fine to me" | State the measurement or cap at `info` |
| "Generic is safe for an admin panel" | Quiet is fine; untouched defaults and missing states are not |
| "Accessibility is a separate review" | The WCAG 2.2 AA floor is in scope here |
| "No browser, so I'll assume the contrast passes" | Compute from tokens or list it under "Checks not run" |
| "Every card has the same style — that's consistency" | Consistency of tokens, yes; one radius + shadow on everything is the card kit |
