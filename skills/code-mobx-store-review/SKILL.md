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
- State is stored in `@observable`/`@observable.shallow`/`@observable.ref`.
- Derived values in `@computed`, not in View.

### Member Ordering
Check class member order (matches `@typescript-eslint/member-ordering` and project convention):
1. `@observable` fields (public state, no modifier)
2. `private` fields (internal state: `disposed`, `initialized`, etc.)
3. `constructor`
4. `@computed` getters
5. `dispose()` — lifecycle cleanup
6. `init()` / `onMount()` — lifecycle initialization
7. `@action.bound` methods — UI-facing actions
8. `private` methods — API calls and internal logic

### Member Accessibility Modifiers
ESLint: `@typescript-eslint/explicit-member-accessibility: ["error", { accessibility: "no-public" }]` — the word `public` is **forbidden**.

- *(no modifier)*: `@observable` fields, `@computed` getters, `@action.bound` methods, `dispose()`, `init()` — public store API.
- `private`: internal state (`disposed`, `initialized`), helper methods, API-call methods (`fetchX`, `performX`), inter-store callbacks (`onChangeX`, `onFireX`, `handleX`, `syncX`).
- `private readonly`: constructor-injected dependencies, immutable configuration (`id`, `context`).
- `readonly`: immutable public identity fields (`pipelineType`, `contextActions`).
- `protected`: only in abstract base classes for extension points.

Review flags:
- Using the word `public` — **ESLint error** (error level).
- `private` field that could be `private readonly` — suggest `readonly`.
- Missing `private` on internal state or helper methods — **warning**.

### Actions and Async
- Any state mutation inside actions (`@action.bound` or via `runInAction`).
- After `await` for mutations, use `runInAction`.
- Avoid direct store mutations from outside the action layer.

### Action Binding Rules
- **`@action.bound`**: only for methods called from UI (components). These are thin wrappers delegating to private methods.
- **Private method + `runInAction`**: for methods containing API calls and state mutations.
- **Never** use `@action.bound` on private methods.
- **Exception**: `@action.bound private` is acceptable for inter-store callbacks — methods passed as bound references to child/sibling stores (e.g. `new CodeEditorStore(this.onChangeEditorState)`).

Review flags:
- `@action.bound` method contains an API call directly — **warning**: move API call to private method.
- `@action.bound` on private method (except inter-store callbacks) — **warning**: remove decorator, use `runInAction` inside.
- Method called from another store marked `@action.bound` instead of plain method — **suggestion**.

### Inter-Store Callbacks and Internal Handlers
Methods serving as **internal callbacks** between stores or internal event handlers MUST be `private`. They are NOT part of the store's public API.

**Name patterns that MUST be `private`:**
- `onChangeEditorState(state)` — callback receiving state from child/sibling store
- `onFireExecutorChange()` — internal sync handler on executor change
- `onChangeX(value)` — handler for internal state synchronization between stores
- `handleX()`, `syncX()` — any internal coordination method

**Decision rule:** Ask "Is this method called from a React component via JSX/event handler?" If NO — it is `private`.

Review flags:
- Public method with `onChangeX`, `onFireX`, `handleX`, `syncX` pattern not called from components — **warning**: make `private`.
- Inter-store callback without `private` — **warning**: violation of store encapsulation.

### Bidirectional Sync Bounce Protection
When two stores synchronize state **in both directions** (Store A → Store B and Store B → Store A), at least one direction MUST have an equality guard (`if (newValue !== currentValue)`) before writing to the other store, to prevent infinite callback loops.

```typescript
// CORRECT — equality guard prevents bounce
private onChangeEditorState(editorState: ICodeEditorState) {
  this.setRawScript(editorState.script);
  const codeExecutorId = this.codeExecutor?.id;
  if (codeExecutorId && this.codeEditorStore.executorId !== codeExecutorId) {
    this.codeEditorStore.setExecutorId(codeExecutorId);
  }
}

// WRONG — no guard, infinite loop
private onChangeEditorState(editorState: ICodeEditorState) {
  this.setRawScript(editorState.script);
  const codeExecutorId = this.codeExecutor?.id;
  if (codeExecutorId) {
    this.codeEditorStore.setExecutorId(codeExecutorId); // bounces back
  }
}
```

Review flags:
- Bidirectional store sync without equality guard — **critical**: risk of infinite callback loop.
- Store A writes to Store B in a callback from Store B without `!==` check — **critical**.

### Truthy vs Equality Guards for Optional Values
For state update guards, prefer **equality comparison** (`!==`) over **truthy checks** (`if (value && ...)`) for optional/nullable fields. Truthy guards block propagation of legitimate `undefined`/`null`/`0`/`""` values.

```typescript
// WRONG — truthy guard blocks clearing
if (executor && executor.id !== this.executorId) {
  this.setExecutorId(executor.id);
}
// executor = undefined → nothing happens → stale value

// CORRECT — equality guard allows clearing
if (executor?.id !== this.executorId) {
  this.setExecutorId(executor?.id);
}
// executor = undefined → executorId = undefined → field cleared
```

Review flags:
- Truthy guard (`if (x && x !== y)`) on optional/nullable field — **warning**: blocks propagation of `undefined`/falsy clearing.
- `if (value)` instead of `if (value !== currentValue)` in inter-store sync logic — **warning**: potentially blocks clearing.

### API Calls Placement
- API/IO calls **only** in `private` store methods.
- `@action.bound` methods are thin: guard-check → delegate to private method.
- Components **never** call API directly.

Review flags:
- API call inside an `@action.bound` method — **warning**: move to private method.
- API call in a component — **critical**: move to store.

### Lifecycle Initialization
- `init()` / `onMount()` of a child store is called from the **parent store**, not from component `useEffect`.
- Components **must not** trigger store data loading via `useEffect`. The parent store orchestrates child store lifecycle.
- `dispose()` is called by the parent store in its `onUnmount()` to prevent stale-state updates.

Review flags:
- Component `useEffect` calls `store.loadX()` or `store.init()` — **warning**: move call to parent store `onMount`.
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
CONTEXT_PATH: ~/goodai-base/jobs/<job-name>/ai/context.md
```

If provided and the file exists, read the context document before starting the review. Use it to:
- Understand which libraries and patterns were intentionally chosen for the implementation
- Validate MobX patterns against documented project conventions
- Avoid flagging intentional architectural decisions as issues

If the file does not exist or is not provided, proceed normally — context is optional and non-blocking.
