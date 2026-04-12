---
name: code-mobx-store-review
description: "Use when reviewing MobX store changes, validating state management, actions, computed values, reactions, or View-Store boundaries."
triggers:
  - "Review MobX store"
  - "Check store changes"
  - "MobX review"
metadata:
  author: "MrCipherSmith"
  version: "1.1.0"
  category: "review"
license: "MIT"
compatibility: "cursor,codex,zed,opencode"
---

# Code MobX Store Review (current branch only)

## Review Scope

This skill covers **Stage 2 (Code Quality) only** — specifically for MobX store patterns. It does NOT perform Stage 1 (Spec Compliance). Before running a MobX store review, ensure spec compliance has already been confirmed via `code-review`, `code-ai-review`, or `code-boss-review`.

## Red Flags — Stop and re-read if you are thinking:

| Rationalization | Why it's wrong |
|---|---|
| "The store looks fine, no need to check action boundaries" | MobX action violations are silent in dev — always verify runInAction |
| "I'll mark observable mutation outside action as INFO, not WARNING" | Direct mutation outside action is always at least WARNING |
| "The spec compliance already passed, I can be lenient on patterns" | Stage 2 standards don't lower because Stage 1 passed |
| "This is a small store, full pattern review isn't needed" | Store size doesn't exempt from pattern requirements |

**IRON LAW: EVERY OBSERVABLE MUTATION MUST HAPPEN INSIDE AN ACTION OR runInAction — NO EXCEPTIONS BASED ON "SIMPLICITY".**

Review only current branch changes from merge-base with the parent branch. Focus on state correctness, MobX patterns, and architecture boundaries.

## Scope

- If the user **did not provide a commit hash/range**, review the full slice from merge-base to working tree:
  - committed changes (`BASE_SHA..HEAD`)
  - local (`staged/unstaged/untracked`)
- If the user **explicitly provided a commit hash/range**, review only that range.
- Do not review legacy code outside the changed scope.
- Tie findings to changed lines in diff.

## Scope Detection

See shared script: `skills/shared/git-merge-base.md`

Run the script from that file to determine MERGE_BASE and SCOPE before proceeding with the review.

### Commands to collect changes

```bash
git status
git log --oneline "${BASE_SHA}..HEAD"
git diff --name-status --find-renames "${BASE_SHA}..HEAD"
git diff --find-renames "${BASE_SHA}..HEAD"
git diff --name-status --find-renames "${BASE_SHA}"
git diff --find-renames "${BASE_SHA}"
git ls-files --others --exclude-standard
```

## MobX Review Checklist

### Store Structure
- Store class MUST have `makeObservable(this)` in constructor.
- State is stored in `@observable` / `@observable.shallow` / `@observable.ref` / `@observable.struct`.
- Derived values live in `@computed`, not in View.
- `@observable.ref` is preferred for large external objects or when inner reactivity is handled elsewhere.
- Private backing field (`@observable private _value`) with `@computed get value()` and a public setter action is the correct pattern for controlled access.

### Member Ordering
Check class member order against the canonical layout:
1. `private` fields
2. public fields (`@observable`, `readonly`, public plain props)
3. `constructor`
4. public methods (`@computed` getters, lifecycle methods, public non-mutating helpers/selectors, public `@action.bound` UI entrypoints)
5. `private` methods

### Member Accessibility Modifiers
ESLint: `@typescript-eslint/explicit-member-accessibility: ["error", { accessibility: "no-public" }]` — the word `public` is **forbidden**.

- *(no modifier)*: public observable fields, computed getters, lifecycle methods, public helper methods, public `@action.bound` UI methods.
- `private`: internal state (`disposed`, `initialized`, `_value`), helper methods, API-call methods (`fetchX`, `performX`), inter-store callbacks (`onChangeX`, `onFireX`, `handleX`, `syncX`).
- `private readonly`: constructor-injected dependencies, immutable configuration (`service`, `context`, `id`).
- `readonly`: immutable public identity fields (`pipelineType`, `contextActions`).
- `protected`: only in abstract base classes for extension points.

Review flags:
- Using the word `public` — **error**.
- Missing `private` on internal state or helper methods — **warning**.
- Internal dependency that should be `private readonly` — **suggestion**.

### Observable Collections
- `IObservableArray` and `ObservableMap` MUST use MobX-specific mutation methods inside `runInAction`.
- Do **not** reassign the whole collection variable when using `IObservableArray` / `ObservableMap` — mutate in place.
- `@observable.ref` is correct for large external objects or when the object handles its own reactivity.

Review flags:
- `IObservableArray` field reassigned instead of using `.replace()` — **warning**.
- `ObservableMap` field reassigned instead of using `.replace()` — **warning**.
- Deep `@observable` on a large external object/instance — **suggestion**: consider `@observable.ref`.

### Reactions and Disposers
- `autorun`, `reaction`, `when` created in constructor/store setup MUST be disposed in `dispose()`.
- Disposers should be stored in a `private disposers: IReactionDisposer[]` array.

Review flags:
- `autorun` / `reaction` / `when` without a disposer call in `dispose()` — **warning**.
- Missing `dispose()` in a store that has reactions — **warning**.

### Actions and Async
- Public methods called from React components or route/UI handlers MUST be `@action.bound`.
- Public sync `@action.bound` methods may mutate store state directly and should not wrap those direct mutations in `runInAction`.
- Public async `@action.bound` methods should stay thin: optional guard → delegate to `private async` method.
- Public non-mutating helpers/selectors are not actions and should not use `runInAction`; arrow helpers are acceptable when context can escape.
- Private async/orchestration methods should usually use `try/catch/finally`.
- State mutations inside private methods must happen in `runInAction`, especially after `await`.
- `catch (err: unknown)` MUST be used.

Review flags:
- Public UI method missing `@action.bound` — **warning**.
- Public helper method marked `@action.bound` even though it does not mutate state — **warning**.
- Public async action doing API/IO itself instead of delegating — **warning**.
- Private async method mutating state outside `runInAction` — **warning**.
- Missing `try/catch/finally` around private async workflow that owns loading/saving flags — **warning**.

### Inter-Store Callbacks and Internal Handlers
Methods serving as internal callbacks between stores or internal event handlers MUST be `private`.

Name patterns that MUST be `private` unless they are React-facing UI entrypoints:
- `onChangeEditorState(state)`
- `onFireExecutorChange()`
- `onChangeX(value)`
- `handleX()`
- `syncX()`

Decision rule: ask "Is this called from JSX / a React event handler?" If NO — it is `private`.

Review flags:
- Public method with `onChangeX`, `onFireX`, `handleX`, `syncX` pattern not called from components — **warning**.
- Inter-store callback without `private` — **warning**.
- `@action.bound` on a private method that is not passed as a callback reference — **warning**.

### Bidirectional Sync Bounce Protection
When two stores synchronize state in both directions, at least one direction MUST have an equality guard (`if (newValue !== currentValue)`) before writing to the other store.

Review flags:
- Bidirectional store sync without equality guard — **critical**.
- Store A writes to Store B in a callback from Store B without `!==` check — **critical**.

### Truthy vs Equality Guards for Optional Values
For state update guards, prefer equality comparison (`!==`) over truthy checks (`if (value && ...)`) for optional/nullable fields.

Review flags:
- Truthy guard on optional/nullable field — **warning**.
- `if (value)` instead of `if (value !== currentValue)` in inter-store sync logic — **warning**.

### API Calls Placement
- API/IO calls belong in `private` store methods.
- Public `@action.bound` methods are thin: guard-check → delegate to private method.
- Components never call API directly.

Review flags:
- API call inside a public `@action.bound` method — **warning**.
- API call in a component — **critical**.

### Lifecycle Initialization
- `init()` / `onMount()` of a child store is called from the **parent store**, not from component `useEffect`.
- Components must not trigger store data loading via `useEffect`.
- `dispose()` is called by the parent store in its `onUnmount()` to prevent stale-state updates.

Review flags:
- Component `useEffect` calls `store.loadX()` or `store.init()` — **warning**.
- Missing `dispose()` / disposed guard in store with async operations — **warning**.
- Parent store does not call `child.dispose()` in `onUnmount()` — **warning**.

### View ↔ Store Boundaries
- Business logic and IO remain in Store/Service, not in View.
- Components reading observables MUST be `observer(...)`.
- `useEffect` must not replace store lifecycle logic.

### TypeScript Safety
- No `any` and unsafe casts.
- Use explicit interfaces for state and store public API.
- Avoid `!` without strict proof of initialization.

## Output Format

```markdown
## Summary
- [1-3 bullets with findings overview]

## Scope
- Branch: `<BRANCH>`
- Parent ref: `<PARENT>`
- Merge-base: `<BASE_SHA>`
- Scope mode: `<default-with-uncommitted | explicit-hash-range>`

## Critical Issues (must fix)
### [Short title]
- **Rule**: [core/mobx-store-template.mdc / core/code-style-patterns.mdc]
- **Why**: [why this is a risk]
- **Where**: `path/to/file.ts` (lines from diff)
- **Fix**: [minimal fix]
- **Proposed patch**:
```diff
[unified diff]
```

## Warnings
[same format]

## Suggestions
[targeted improvements without scope expansion]

## File-by-file notes
- `path/to/file`: [brief notes]
```

## Rules of Engagement

- Do not suggest new libraries without request.
- If multiple options exist, give one default and one brief alternative.
- Suggest fixes as minimal patches; do not rewrite large blocks unnecessarily.

---

## Scope Boundaries

| Concern | This skill | Use instead |
|---------|-----------|-------------|
| Store structure, actions, computed, reactions, async runInAction | YES | — |
| View↔Store boundary violations | YES | — |
| General code quality, readability, tests | NO | `code-ai-review` |
| boss-style logic enforcement | NO | `code-boss-review` |
| Naming/style/architecture patterns outside stores | NO | `code-style-review` |

---

## Job Context Awareness

When dispatched by `job-orchestrator` as part of a job pipeline, the prompt MAY include:

```
JOB_NAME:     <job-name>
CONTEXT_PATH: <JOBS_ROOT>/<job-name>/ai/context.md
```

If provided and the file exists, read the context document before starting the review. Use it to:
- Understand which libraries and patterns were intentionally chosen for the implementation
- Validate MobX patterns against documented project conventions
- Avoid flagging intentional architectural decisions as issues

If the file does not exist or is not provided, proceed normally — context is optional and non-blocking.
