---
name: review-frontend
description: "Use when a frontend review is requested, checking React component patterns, MobX state management (observer, actions, computed, reactions, lifecycle), View-Store boundaries, and TypeScript safety in changed frontend code. NOT for backend patterns, security vulnerabilities, performance bottlenecks, or cross-layer architecture."
triggers:
  - "review frontend"
  - "frontend review"
  - "review React"
  - "review MobX"
  - "review store"
  - "review components"
  - dispatched by review-orchestrator
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "review"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# Review: Frontend (React + MobX + TypeScript)

## Purpose

Validates frontend-specific patterns in the changed code of the current branch. Covers React component correctness (observer wrapping, MVVM boundary, useEffect misuse, accessibility basics, key props), full MobX store patterns (structure, member ordering, accessibility modifiers, observable collections, reactions, async actions, bidirectional sync, lifecycle, API placement), and TypeScript safety.

This skill consolidates what was previously split between `code-style-review` (frontend parts) and `code-mobx-store-review`. It supersedes both for frontend changes.

---

## Input Contract

| Field | Required | Description |
|-------|----------|-------------|
| Branch / diff range | No | Defaults to merge-base..HEAD + uncommitted changes |
| Explicit commit hash/range | No | Review only that range when provided |
| `JOB_NAME` | No | Job name when dispatched by orchestrator |
| `CONTEXT_PATH` | No | Path to context doc when dispatched by orchestrator |

---

## Scope Boundaries

| Concern | This skill | Use instead |
|---------|-----------|-------------|
| React component patterns (observer, MVVM, useEffect, keys, a11y) | YES | — |
| MobX store: structure, actions, computed, reactions, lifecycle | YES | — |
| MobX: observable collections, bidirectional sync, disposers | YES | — |
| View↔Store boundary violations | YES | — |
| TypeScript safety in frontend code (no any, I* prefix, ?./??/!) | YES | — |
| Backend patterns, NestJS, server-side logic | NO | `review-logic`, `review-architecture` |
| Cross-layer architecture (service layer design, module boundaries) | NO | `review-architecture` |
| Security vulnerabilities (XSS, injection, auth gaps) | NO | `review-security-code` |
| Performance bottlenecks (N+1, bundle size, re-render frequency) | NO | `review-performance` |
| Code style, naming outside frontend conventions | NO | `code-style-review` |

---

## Iron Laws

1. **Every observable mutation outside an action or `runInAction` is at minimum a `major` finding.** No exception for "small stores" or "simple assignments".
2. **Missing `observer()` on a component that reads MobX observables is always a `blocker`.** The component will not react to state changes — this is a silent, runtime correctness bug.
3. **An API call in a component is always a `blocker`.** API/IO belongs in private store methods, not in JSX, hooks, or event handlers within the component file.
4. **`public` keyword on any class member is always an error.** The ESLint rule `@typescript-eslint/explicit-member-accessibility` with `"no-public"` forbids it.
5. **Inter-store callbacks (`onChangeX`, `handleX`, `syncX`) without `private` are always a `major`.** Ask: "Is this called from JSX?" If no — it must be `private`.

---

## Scope Detection

See shared script: `skills/shared/git-merge-base.md`

Run the script from that file to determine `MERGE_BASE` (`BASE_SHA`) and `SCOPE` before proceeding.

### Commands to collect the review slice

```bash
git status
git log --oneline "${BASE_SHA}..HEAD"
git diff --stat --name-status "${BASE_SHA}..HEAD"
git diff "${BASE_SHA}..HEAD"

# Include uncommitted changes (default mode):
git diff --stat --name-status "${BASE_SHA}"
git diff "${BASE_SHA}"
git ls-files --others --exclude-standard
```

For explicit hash/range mode:

```bash
git diff --stat --name-status <FROM_SHA>..<TO_SHA>
git diff <FROM_SHA>..<TO_SHA>
```

---

## Review Checklist

### Part A: React Component Patterns

#### A1. MobX Observer Wrapping

- [ ] Every component that reads a MobX observable (directly from a store, or from `useLocalObservable`) MUST be wrapped in `observer(ComponentName)` or be a class component extending `React.Component` with `observer` applied
- [ ] `observer` must wrap the **entire** component, not just a sub-section
- [ ] HOC composition order: `observer` should be the **outermost** wrapper (applied last): `observer(withRouter(MyComponent))` — NOT `withRouter(observer(MyComponent))`
- [ ] Conditional reading of observables is still observable access — `if (store.isLoaded)` triggers tracking; wrapper is required regardless of conditionality

Flags:
- Component reads `store.*` or `useLocalObservable` result but is not wrapped in `observer` — **blocker**
- `observer` applied inside another HOC wrapper instead of outside — **major**

#### A2. MVVM Boundary (Business Logic in Store, Not Component)

- [ ] Business logic MUST live in Store/Service, not in component
- [ ] IO (API calls, file reads, WebSocket messages) MUST originate from private store methods
- [ ] Component event handlers must only call store action methods — no logic between the event and the store call
- [ ] Computed/derived values MUST be `@computed` getters in the store, not inline derivations in the component body

Flags:
- `fetch()` / `axios` / `httpClient` call directly in component (hook or handler) — **blocker**
- Business logic (conditionals, transformations, validation) inside a component event handler instead of a store method — **major**
- Derived value computed inline in component that could be a `@computed` getter — **minor**

#### A3. useEffect Misuse

- [ ] `useEffect` must not contain business logic
- [ ] `useEffect` must not call `store.init()`, `store.load()`, or `store.onMount()` — lifecycle initialization is the parent store's responsibility
- [ ] `useEffect` must not contain API calls or IO
- [ ] `useEffect` used to synchronize component state with store state is a sign the component should be an `observer` instead
- [ ] Every `useEffect` that creates a subscription, timer, or listener MUST return a cleanup function

Flags:
- `useEffect` calls `store.init()` or `store.loadX()` — **major**
- `useEffect` contains `fetch()` or IO — **blocker** (API in component)
- `useEffect` contains business logic / state derivation — **major**
- `useEffect` creates a subscription/timer/listener with no cleanup return — **major** (memory leak)

#### A4. Key Props on Lists

- [ ] Every `.map()` rendering React elements MUST have a `key` prop on the root returned element
- [ ] Keys must be stable, unique identifiers — not array index when the list can reorder or filter
- [ ] Key must be on the element returned by `.map()`, not a child inside it

Flags:
- Missing `key` prop on list — **major** (causes reconciliation bugs)
- `key={index}` on a list that can reorder, filter, or paginate — **minor**

#### A5. Accessibility Basics

- [ ] `<img>` tags MUST have `alt` attribute (can be `alt=""` for decorative images, must be descriptive for content images)
- [ ] Interactive elements (`<button>`, `<a>`) with no visible text content MUST have `aria-label` or `aria-labelledby`
- [ ] Form inputs MUST have an associated `<label>` (via `htmlFor` + `id`, or `aria-label`)
- [ ] `role="button"` on a `<div>` or `<span>` without `tabIndex={0}` and keyboard handler — prefer a real `<button>`
- [ ] `onClick` on non-interactive elements without keyboard equivalent

Flags:
- `<img>` without `alt` — **major**
- Interactive element without accessible name — **major**
- Non-semantic interactive element without keyboard support — **minor**

---

### Part B: MobX Store Patterns

#### B1. Store Structure

- [ ] Store class MUST call `makeObservable(this)` in the constructor
- [ ] Observable state MUST use `@observable`, `@observable.shallow`, `@observable.ref`, or `@observable.struct` decorators
- [ ] Derived values MUST live in `@computed` getters, not recomputed in components or plain methods
- [ ] `@observable.ref` is preferred for large external objects or objects that manage their own reactivity

Flags:
- `makeObservable(this)` missing from constructor — **blocker**
- Observable state missing `@observable` decorator — **blocker**
- Derived value in plain method instead of `@computed` — **minor**

#### B2. Member Ordering

The canonical class member order (flag deviations):

1. `private` fields (internal state, disposers, injected deps as `private readonly`)
2. Public fields (`@observable`, `readonly`, public plain props)
3. `constructor`
4. Public methods: `@computed` getters, lifecycle (`init`, `dispose`, `onMount`, `onUnmount`), public helpers/selectors, public `@action.bound` UI entrypoints
5. `private` methods

Flags:
- Constructor before field declarations — **minor**
- Private methods before public methods — **minor**
- `@action.bound` public method buried among private methods — **minor**

#### B3. Member Accessibility Modifiers

ESLint rule: `@typescript-eslint/explicit-member-accessibility: ["error", { accessibility: "no-public" }]` — the word `public` is **forbidden** on any class member.

Correct accessibility:
- *(no modifier)*: observable fields, computed getters, lifecycle methods, public helper methods, public `@action.bound` UI methods
- `private`: internal state (`disposed`, `initialized`, `_value`), helper methods, API-call methods (`fetchX`, `performX`), inter-store callbacks (`onChangeX`, `onFireX`, `handleX`, `syncX`)
- `private readonly`: constructor-injected dependencies, immutable configuration (`service`, `context`, `id`)
- `readonly`: immutable public identity fields (`pipelineType`, `contextActions`)
- `protected`: only in abstract base classes for extension points

Decision rule for inter-store callbacks: ask "Is this called from JSX or a React event handler?" If NO — it is `private`.

Flags:
- `public` keyword on any member — **blocker** (ESLint error)
- `onChangeX`, `onFireX`, `handleX`, `syncX` without `private` — **major**
- Missing `private` on internal state or helper methods — **major**
- Missing `private readonly` on injected dependencies — **minor**

#### B4. Observable Collections

- [ ] `IObservableArray` MUST be mutated in place using MobX methods (`.replace()`, `.push()`, `.splice()`, etc.) inside `runInAction` — never reassigned
- [ ] `ObservableMap` MUST be mutated using `.set()`, `.delete()`, `.merge()`, `.replace()` — never reassigned
- [ ] Deep `@observable` on a large external object/instance should use `@observable.ref` instead

Flags:
- `IObservableArray` field reassigned instead of using `.replace()` — **major**
- `ObservableMap` field reassigned instead of `.replace()` or `.merge()` — **major**
- Observable mutation outside `runInAction` in async context — **blocker** (Iron Law 1)

#### B5. Reactions and Disposers

- [ ] Every `autorun`, `reaction`, or `when` created in the store MUST be disposed in `dispose()`
- [ ] Disposers MUST be stored in `private disposers: IReactionDisposer[]`
- [ ] `dispose()` MUST call `this.disposers.forEach(d => d())` (or equivalent)
- [ ] Stores with async operations MUST have a `disposed` guard: check `if (this.disposed) return` after each `await`

Flags:
- `autorun` / `reaction` / `when` without disposer in `dispose()` — **major**
- Missing `dispose()` in a store that creates reactions — **major**
- Missing `disposed` guard in async store methods — **major**
- `private disposers: IReactionDisposer[]` missing when reactions are used — **minor**

#### B6. Actions and Async

**Public methods (UI entrypoints):**
- [ ] Public mutating methods called from React components or route handlers MUST be `@action.bound`
- [ ] Public `@action.bound` methods MUST stay thin: optional guard → delegate to private method
- [ ] Public non-mutating helpers/selectors must NOT be `@action.bound` (unnecessary and misleading)
- [ ] Arrow method on a class used as an event handler alternative: acceptable when context must escape but generally prefer `@action.bound`

**Private async methods:**
- [ ] State mutations after `await` MUST be wrapped in `runInAction()`
- [ ] Private async methods that own loading/error flags MUST use `try/catch/finally`
- [ ] `catch (err: unknown)` MUST be used — NOT `catch (err: any)` or untyped `catch (err)`
- [ ] `finally` block MUST reset loading flags (e.g., `this.isLoading = false`) inside `runInAction`

Flags:
- Public UI method missing `@action.bound` — **major**
- Public helper method marked `@action.bound` but does not mutate state — **minor**
- Public async action doing API/IO directly instead of delegating to private — **major**
- State mutation after `await` outside `runInAction` — **blocker** (Iron Law 1)
- Missing `try/catch/finally` on private async method owning loading flags — **major**
- `catch (err: any)` instead of `catch (err: unknown)` — **minor**

#### B7. Inter-Store Callbacks and Internal Handlers

Methods serving as callbacks between stores or internal event handlers MUST be `private`.

Patterns that MUST be `private` unless called from JSX:
- `onChangeEditorState(state)`
- `onFireExecutorChange()`
- `onChangeX(value)`
- `handleX()`
- `syncX()`

The test: "Is this method called from JSX or passed as a React event handler prop?" If NO — it is `private`, full stop.

Flags:
- Public method matching `onChangeX`, `onFireX`, `handleX`, `syncX` naming not called from components — **major**
- Inter-store callback without `private` — **major**
- `@action.bound` on a `private` method that is not passed as a callback reference — **minor**

#### B8. Bidirectional Sync Bounce Protection

When two stores synchronize state in both directions, at least one direction MUST have an equality guard (`if (newValue !== currentValue)`) before writing to the other store. Without this, changes bounce indefinitely.

Flags:
- Bidirectional store sync without equality guard — **blocker**
- Store A writes to Store B in a callback from Store B without `!==` check — **blocker**
- Truthy guard (`if (value)`) on optional/nullable field instead of equality check in sync logic — **major**

#### B9. API Calls Placement

- [ ] API/IO calls belong in `private` store methods only
- [ ] Public `@action.bound` methods are thin: guard-check → delegate to private method
- [ ] Components MUST NOT call APIs directly (fetch, axios, httpClient, service.callX) — even inside `useEffect`

Flags:
- API call inside a public `@action.bound` method body — **major**
- API call in a component (hook, handler, useEffect) — **blocker** (Iron Law 3)

#### B10. Lifecycle Initialization and Disposal

- [ ] `init()` / `onMount()` of a child store is called from the **parent store's** `init()` / `onMount()`, NOT from a component `useEffect`
- [ ] Components must NOT trigger store data loading via `useEffect` (e.g., `useEffect(() => { store.load() }, [])`)
- [ ] Parent store's `onUnmount()` / `dispose()` MUST call `childStore.dispose()` to prevent stale-state updates
- [ ] Store `dispose()` MUST set `this.disposed = true` before canceling async work

Flags:
- Component `useEffect` calls `store.loadX()`, `store.init()`, or `store.onMount()` — **major**
- Parent store does not call `child.dispose()` in `onUnmount()` / `dispose()` — **major**
- Missing `disposed` flag in store with async operations — **major**

---

### Part C: TypeScript Safety

- [ ] No `any` type in changed code — use `unknown` + type guards or specific types
- [ ] No `as any` or `as unknown as T` unsafe double-cast without a comment explaining why
- [ ] No `!` non-null assertion without a comment proving the value cannot be null/undefined at that point
- [ ] Props interface MUST use `I` prefix: `interface IMyComponentProps { ... }`
- [ ] Prefer optional chaining (`?.`) and nullish coalescing (`??`) over `!` assertions
- [ ] `catch (err: unknown)` — typed error handling, not `catch (err)` or `catch (err: any)`

Flags:
- `any` type in new code — **major**
- `!` non-null assertion without justification comment — **minor**
- Props interface without `I` prefix — **minor**
- `catch (err: any)` — **minor**

---

## Output Contract

### Status line (first line of response)

```
STATUS: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
```

- `DONE` — review complete, findings (if any) are below
- `DONE_WITH_CONCERNS` — one or more `blocker` or `major` findings found
- `NEEDS_CONTEXT` — cannot assess a finding without additional context not present in the diff (e.g., parent store file not changed but referenced)
- `BLOCKED` — cannot run git commands or access the repo

### Report structure

```markdown
STATUS: DONE_WITH_CONCERNS

## Frontend Review

### Scope
- Branch: `<BRANCH>`
- Parent ref: `<PARENT>`
- Merge-base: `<BASE_SHA>`
- Scope mode: default-with-uncommitted | explicit-hash-range
- Changed files reviewed: <N>

### Summary
- Blockers: <N>
- Major: <N>
- Minor: <N>
- Info: <N>

### Findings

### [F-001] Title
- **Severity**: blocker | major | minor | info
- **File**: path/to/file.ts:line
- **Rule**: Part A3 — useEffect Misuse | Part B6 — Actions and Async | etc.
- **Problem**: what is wrong in the code
- **Why it matters**: concrete impact (silent non-reactivity, stale state, memory leak, etc.)
- **Fix**: concrete suggestion
- **Patch** (optional):
```diff
- wrong line
+ correct line
```

### Clean Areas
[List checklist sections with no findings, confirming they were checked]
```

### Severity definitions

| Severity | Meaning |
|----------|---------|
| `blocker` | Silent correctness bug or Iron Law violation; component will not behave correctly or store will corrupt state |
| `major` | Pattern violation that will cause bugs under realistic usage or future changes |
| `minor` | Convention deviation or defensive gap; does not cause immediate bugs but reduces maintainability |
| `info` | Observation worth noting; no concrete bug in current code |

---

## Red Flags Table

Stop and re-read these rules if you are thinking:

| Rationalization | Why it's wrong |
|---|---|
| "The store is small, no need for full observer wrapping" | Missing observer() is a blocker regardless of store size — Iron Law 2 |
| "The mutation happens in a non-async method, so runInAction isn't needed" | Mutations outside action/runInAction are always at least major — Iron Law 1 |
| "I'll mark the API call in component as minor to avoid friction" | API in component is always a blocker — Iron Law 3 |
| "The `public` keyword is just a style issue, I'll call it minor" | It's an ESLint error that will fail CI — it is a blocker |
| "This inter-store callback works fine as public" | Iron Law 5: if it's not called from JSX, it must be private |
| "No spec compliance check needed for this skill" | Correct — this skill covers Stage 2 (code quality) only; spec compliance is handled by the orchestrator or review-logic |
| "I can suggest adding useCallback everywhere for safety" | With MobX+observer, useCallback is rarely needed and adds noise; only flag when concretely justified |
| "The bidirectional sync looks fine, no equality guard needed" | Bidirectional sync without equality guard is a blocker — infinite loop risk |

---

## Job Context Awareness

When dispatched by `job-orchestrator` or `review-orchestrator` as part of a job pipeline, the prompt MAY include:

```
JOB_NAME:     <job-name>
CONTEXT_PATH: <JOBS_ROOT>/<job-name>/ai/context.md
```

If provided and the file exists, read the context document before starting the review. Use it to:
- Understand which MobX version and decorator configuration the project uses (legacy decorators vs. `makeObservable`)
- Identify custom base store classes or lifecycle conventions that differ from defaults
- Understand which accessibility standard the project targets (WCAG 2.1 AA vs. custom)
- Identify intentional patterns that appear to violate rules but are documented exceptions
- Validate findings against documented project-specific conventions

If the file does not exist or is not provided, proceed normally — context is optional and non-blocking.
