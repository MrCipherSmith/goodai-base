---
name: doubt-driven-development
description: "Use when a non-trivial decision is about to stand — branching logic, cross-boundary change, unverifiable invariant, or irreversible blast radius — and you want a fresh-context adversarial reviewer to catch a wrong direction in-flight, while correction is still cheap. NOT for mechanical edits, one-liners, or explicit user instructions."
triggers:
  - "/doubt"
  - "doubt this"
  - "stress-test this decision"
  - "am I sure about this"
  - "adversarial review"
  - "sanity-check before I commit"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "validation"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# Doubt-Driven Development

## What It Does

Materializes a **fresh-context adversarial reviewer** before a non-trivial decision stands, so a wrong direction is caught early — while course-correction is still cheap.

> "A confident answer is not a correct one."

Long sessions accumulate context that silently converts assumptions into "facts." This skill applies rigorous skepticism **in-flight**, not post-hoc. It is the cheap, per-decision counterpart to the full `review-orchestrator` (post-hoc, whole-diff) and `plan-gatekeeper` (interactive, whole-plan).

## When It Applies

A decision qualifies as **non-trivial** if it:

- Introduces or modifies branching logic
- Crosses a module / service / package boundary
- Asserts a property the type system cannot verify (thread-safety, idempotence, ordering, an invariant)
- Depends on context future readers will not see
- Has irreversible blast radius (production deploy, data migration, public-API or contract change)

**Skip it for:** mechanical operations, clear user instructions, reading existing code, one-liners, tooling operations, or when the user has explicitly prioritized speed. Doubt on a formatting change is theater.

## The Five-Step Process

```
CLAIM → EXTRACT → DOUBT → RECONCILE → STOP
```

### 1. CLAIM
Name the decision compactly and state why it matters (which of the "non-trivial" triggers it hits). One or two sentences. This is for *you*; it is **not** passed to the reviewer.

### 2. EXTRACT
Isolate the **artifact** (the code / diff / design) plus its **contract** (the behavior it must satisfy — signature, invariants, pre/post-conditions), stripped of your reasoning and your conclusion.

### 3. DOUBT
Invoke an adversarial reviewer over **ARTIFACT + CONTRACT only**. Framing is mandatory and issues-only:

> "Find what is wrong with this. List concrete failure modes. Do not validate; do not balance praise against criticism."

Options, cheapest first:
- **Same-model sub-agent** — dispatch the `code-reviewer` agent (or `review-logic` skill) with the issues-only prompt.
- **Cross-model** (higher signal, higher cost) — an external CLI such as Codex or Gemini. In interactive mode **always offer** cross-model review before RECONCILE and let the user decide the cost/benefit; announce it if you skip it.

### 4. RECONCILE
Re-read the artifact text against **each** finding and classify:
`contract-misread` (reviewer lacked context — discard, but note the ambiguity) → `actionable` (real defect — fix) → `trade-off` (surface to user) → `noise` (drop).
Disagreement is *data*, not a verdict. Never rubber-stamp.

### 5. STOP
Halt when any of: findings are trivial, **3 cycles** reached, or the user gives an explicit go-ahead. Three unresolved cycles means the artifact may not be ready — escalate to the user, do not loop.

## Load-Bearing Details

- **Never pass the CLAIM (your conclusion) to the reviewer** — it biases agreement.
- **Adversarial framing is mandatory** — "find issues" beats the reviewer's default balanced tone.
- **Bounded recursion** — 3 cycles max; then escalate.
- **External CLIs**: verify the binary is on PATH, confirm flags with the user, and pipe the artifact via **stdin** (never interpolate it into a shell string — injection risk).
- **Orchestrate from the main session** — the reviewer persona does not spawn its own sub-reviewers.

## Rationalizations — Stop and re-read the rule if you think:

| Rationalization | Why it is wrong |
|---|---|
| "I'm confident this is right, no need to doubt" | Confidence is exactly the signal to doubt — accumulated context masquerades as fact |
| "I'll ask the reviewer 'is this good?'" | That invites agreement; the only valid framing is "find what is wrong" |
| "I'll paste my reasoning so the reviewer understands" | Your conclusion biases the reviewer — pass artifact + contract only |
| "The reviewer found nothing actionable across 3 cycles, so it's fine" | Doubt theater — if substantive findings keep surfacing but none are ever classified actionable, you are validating, not doubting |
| "Cross-model is expensive, I'll silently skip it" | In interactive mode you must offer it and let the user decide; silent skips hide the cost/benefit call |
| "This branch is trivial" | If it changes branching, crosses a boundary, or is irreversible, it is non-trivial by definition |

**IRON LAW: THE REVIEWER RECEIVES THE ARTIFACT AND ITS CONTRACT — NEVER YOUR CONCLUSION — AND IS ALWAYS ASKED TO REFUTE, NEVER TO APPROVE.**

## Red Flags

- Spawning a doubt cycle for formatting / rename / comment changes
- Prompting "is this correct?" instead of "find what is wrong"
- Rubber-stamping reviewer output without re-reading the artifact against each finding
- Looping past 3 cycles alone instead of escalating
- Passing the CLAIM or your reasoning into the reviewer prompt
- Interpolating the artifact into a shell command for an external CLI instead of piping via stdin
- **Doubt theater**: 2+ cycles produce findings, zero are ever actioned

## Relationship to Other Skills

- `review-orchestrator` / `review-*` — post-hoc, whole-diff verdict; doubt is per-decision and in-flight.
- `plan-gatekeeper` — interactive interrogation of a whole *plan* with ADR output; doubt targets a single decision or artifact.
- **TDD** — a failing test *is* the doubt step for a behavioral claim; use doubt for claims a test cannot express (invariants, ordering, blast radius).

## Verification Checklist

- [ ] Decision met at least one non-trivial trigger (else the skill should have been skipped)
- [ ] Reviewer prompt contained artifact + contract and **no** conclusion/reasoning
- [ ] Reviewer framing was "find what is wrong", not "is this good"
- [ ] Cross-model review offered (interactive) or its skip announced
- [ ] Every finding classified (contract-misread / actionable / trade-off / noise) with the artifact re-read
- [ ] Loop stopped at trivial findings, 3 cycles, or explicit go-ahead — not left running

## STATUS Protocol (when run as a sub-agent)

```
STATUS: DONE                 — doubt cycle complete, no actionable findings remain
STATUS: DONE_WITH_CONCERNS   — trade-offs surfaced for the user to decide
STATUS: BLOCKED              — 3 cycles reached with unresolved actionable findings; escalate
STATUS: NEEDS_CONTEXT        — contract could not be extracted; artifact under-specified
```
