# Model Selection Test

## Test Scenario

**User Request:**
> "Run feature-analyzer on my project, but use gpt-5.1-codex-mini model for the sub-agent since it's a simple analysis"

## Expected Behavior

1. Agent recognizes this is a `feature-analyzer` skill request
2. Agent notices user wants to **change model** for sub-agent
3. Agent should:
   - Load `core/model-selection.mdc` rule
   - Run `detect-models.sh` to show available models
   - Present options to user with descriptions
   - Ask for confirmation before using different model

## Test Prompt

You can test this by saying:

```
Test model selection: I want to run feature-analyzer but use a different model than the current one. Show me available models first.
```

## What to Verify

- [ ] Agent detects user wants to change model
- [ ] Agent loads model-selection.mdc rule
- [ ] Agent runs detect-models.sh or shows known models
- [ ] Agent presents model options with descriptions
- [ ] Agent asks user to confirm which model to use

## Manual Test Command

```bash
~/goodea/goodai-base/scripts/detect-models.sh
```

Should output:
```
=== Codex Models ===
gpt-5.2-codex - Frontier agentic coding model.
gpt-5.3-codex - Latest frontier agentic coding model.
gpt-5.1-codex-max - Codex-optimized flagship for deep and fast reasoning.
gpt-5.2 - Latest frontier model with improvements across knowledge, reasoning and coding
gpt-5.1-codex-mini - Optimized for codex. Cheaper, faster, but less capable.
```
