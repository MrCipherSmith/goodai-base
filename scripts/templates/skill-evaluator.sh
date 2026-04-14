#!/usr/bin/env bash
# skill-evaluator.sh — installed into target projects by deploy-skill-hook.sh
#
# This is the UserPromptSubmit hook template for individual project repos.
# It delegates to the centralized skill-eval.js in goodai-base without
# copying any skill files into the project.
#
# Environment variables:
#   GOODAI_BASE  — path to goodai-base repo (default: ~/goodai-base)
#
# Override manifest (optional): .claude/skill-overrides.json
#   {
#     "disabled": ["skill-name"],
#     "local_skills": [{ "name": "...", "path": "..." }],
#     "extra_context": "Optional text prepended to every suggestion"
#   }

set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
OVERRIDES_FILE="$PROJECT_ROOT/.claude/skill-overrides.json"
LOG_FILE="${TMPDIR:-/tmp}/goodai-skill-evaluator.log"

GOODAI_BASE="${GOODAI_BASE:-$HOME/goodai-base}"
SKILL_EVAL="$GOODAI_BASE/hooks/skill-eval.js"

# Timestamp for logging
_log() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | $*" >> "$LOG_FILE" 2>/dev/null || true
}

# Fail-open: always exit 0
trap 'exit 0' ERR

# Validate goodai-base exists
if [[ ! -d "$GOODAI_BASE" ]]; then
  _log "WARN: GOODAI_BASE not found: $GOODAI_BASE"
  echo '{}'
  exit 0
fi

if [[ ! -f "$SKILL_EVAL" ]]; then
  _log "WARN: skill-eval.js not found: $SKILL_EVAL"
  echo '{}'
  exit 0
fi

# Read stdin (Claude Code hook payload)
INPUT="$(cat)"

# Apply disabled list from overrides — inject into env for skill-eval.js
DISABLED_SKILLS=""
EXTRA_CONTEXT=""
LOCAL_SKILLS_JSON="[]"

if [[ -f "$OVERRIDES_FILE" ]]; then
  # All data is passed via process.argv — no shell interpolation into code strings
  DISABLED_SKILLS=$(node -e "
    try {
      const data = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
      process.stdout.write((data.disabled || []).join(','));
    } catch { process.stdout.write(''); }
  " "$OVERRIDES_FILE" 2>/dev/null || true)

  EXTRA_CONTEXT=$(node -e "
    try {
      const data = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
      process.stdout.write(data.extra_context || '');
    } catch { process.stdout.write(''); }
  " "$OVERRIDES_FILE" 2>/dev/null || true)

  LOCAL_SKILLS_JSON=$(node -e "
    const path = require('path');
    try {
      const data = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
      const projectRoot = process.argv[2];
      const localSkills = (data.local_skills || []).map(s => {
        if (s.path && !path.isAbsolute(s.path)) {
          s.path = path.join(projectRoot, s.path);
        }
        return s;
      });
      process.stdout.write(JSON.stringify(localSkills));
    } catch { process.stdout.write('[]'); }
  " "$OVERRIDES_FILE" "$PROJECT_ROOT" 2>/dev/null || true)
fi

# Build a registry override that respects disabled list and local skills
# We do this by creating a temporary registry that merges goodai-base registry
# with local skills, then removes disabled ones
REGISTRY="$GOODAI_BASE/hooks/skill-registry.json"
MERGED_REGISTRY=""

if [[ -n "$DISABLED_SKILLS" || "$LOCAL_SKILLS_JSON" != "[]" ]]; then
  # All data passed via process.argv — safe from shell injection
  MERGED_REGISTRY=$(node -e "
    const fs = require('fs');
    const path = require('path');
    const registryPath = process.argv[1];
    const disabledArg = process.argv[2];
    const localSkillsArg = process.argv[3];

    try {
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      const disabled = new Set(disabledArg ? disabledArg.split(',').map(s => s.trim()).filter(Boolean) : []);
      const localSkills = JSON.parse(localSkillsArg || '[]');

      // Remove disabled skills
      registry.skills = (registry.skills || []).filter(s => !disabled.has(s.name));

      // Add local skills
      for (const ls of localSkills) {
        const name = ls.name || '';
        const skillPath = ls.path || '';
        if (!name || !skillPath || disabled.has(name)) continue;

        let description = '';
        if (fs.existsSync(skillPath)) {
          const lines = fs.readFileSync(skillPath, 'utf8').split('\n');
          let inFm = false;
          for (const line of lines) {
            const trimmed = line.trimEnd();
            if (trimmed === '---') { inFm = !inFm; continue; }
            if (inFm && trimmed.startsWith('description:')) {
              description = trimmed.replace(/^description:\s*/, '').replace(/^\"|\"$/g, '');
            }
          }
        }
        registry.skills.push({
          name,
          description: description || name,
          keywords: [],
          patterns: [],
          paths: [],
          minScore: 4,
        });
      }

      process.stdout.write(JSON.stringify(registry));
    } catch { process.exit(0); }
  " "$REGISTRY" "$DISABLED_SKILLS" "$LOCAL_SKILLS_JSON" 2>/dev/null || true)
fi

# Run skill-eval.js
if [[ -n "$MERGED_REGISTRY" ]]; then
  # Write temp registry and pass to node via env
  TMPFILE=$(mktemp /tmp/goodai-merged-registry-XXXXXX.json)
  echo "$MERGED_REGISTRY" > "$TMPFILE"
  RESULT=$(echo "$INPUT" | GOODAI_REGISTRY_OVERRIDE="$TMPFILE" node "$SKILL_EVAL" 2>/dev/null || echo '{}')
  rm -f "$TMPFILE"
else
  RESULT=$(echo "$INPUT" | node "$SKILL_EVAL" 2>/dev/null || echo '{}')
fi

# Inject extra_context if present
# Data is passed via environment variables — no shell interpolation into code strings
if [[ -n "$EXTRA_CONTEXT" && "$RESULT" != '{}' ]]; then
  RESULT=$(HOOK_RESULT="$RESULT" HOOK_EXTRA_CONTEXT="$EXTRA_CONTEXT" node -e "
    try {
      const data = JSON.parse(process.env.HOOK_RESULT);
      const extra = process.env.HOOK_EXTRA_CONTEXT;
      if (extra) {
        const existing = data.context || '';
        data.context = existing ? extra + '\n\n' + existing : extra;
      }
      process.stdout.write(JSON.stringify(data));
    } catch { process.stdout.write(process.env.HOOK_RESULT || '{}'); }
  " 2>/dev/null || echo "$RESULT")
fi

_log "hook executed | result_len=${#RESULT}"
echo "$RESULT"
exit 0
