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
  DISABLED_SKILLS=$(python3 -c "
import json, sys
try:
    data = json.load(open('$OVERRIDES_FILE'))
    disabled = data.get('disabled', [])
    print(','.join(disabled))
except:
    print('')
" 2>/dev/null || true)

  EXTRA_CONTEXT=$(python3 -c "
import json, sys
try:
    data = json.load(open('$OVERRIDES_FILE'))
    print(data.get('extra_context', ''))
except:
    print('')
" 2>/dev/null || true)

  LOCAL_SKILLS_JSON=$(python3 -c "
import json, sys
try:
    data = json.load(open('$OVERRIDES_FILE'))
    local_skills = data.get('local_skills', [])
    # Resolve relative paths relative to project root
    for s in local_skills:
        p = s.get('path', '')
        if p and not p.startswith('/'):
            s['path'] = '$PROJECT_ROOT/' + p
    print(json.dumps(local_skills))
except:
    print('[]')
" 2>/dev/null || true)
fi

# Build a registry override that respects disabled list and local skills
# We do this by creating a temporary registry that merges goodai-base registry
# with local skills, then removes disabled ones
REGISTRY="$GOODAI_BASE/hooks/skill-registry.json"
MERGED_REGISTRY=""

if [[ -n "$DISABLED_SKILLS" || "$LOCAL_SKILLS_JSON" != "[]" ]]; then
  MERGED_REGISTRY=$(python3 -c "
import json, sys, os

registry_path = '$REGISTRY'
disabled = [s.strip() for s in '$DISABLED_SKILLS'.split(',') if s.strip()]
local_skills_json = '$LOCAL_SKILLS_JSON'

try:
    with open(registry_path) as f:
        registry = json.load(f)
except Exception as e:
    sys.exit(0)

# Remove disabled skills
registry['skills'] = [s for s in registry.get('skills', []) if s.get('name') not in disabled]

# Add local skills (read their SKILL.md descriptions)
try:
    local_skills = json.loads(local_skills_json)
    for ls in local_skills:
        skill_path = ls.get('path', '')
        name = ls.get('name', '')
        if not name or not skill_path:
            continue
        if name in disabled:
            continue
        # Try to read description from SKILL.md frontmatter
        description = ''
        keywords = []
        if os.path.exists(skill_path):
            with open(skill_path) as f:
                lines = f.readlines()
            in_fm = False
            for line in lines:
                line = line.rstrip()
                if line == '---':
                    in_fm = not in_fm
                    continue
                if in_fm:
                    if line.startswith('description:'):
                        description = line.split('description:', 1)[1].strip().strip('\"')
                    if line.startswith('  keywords:') or line.startswith('keywords:'):
                        pass  # handled below with triggers
        entry = {
            'name': name,
            'description': description or name,
            'keywords': keywords,
            'patterns': [],
            'paths': [],
            'minScore': 4,
        }
        registry['skills'].append(entry)
except:
    pass

print(json.dumps(registry))
" 2>/dev/null || true)
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
if [[ -n "$EXTRA_CONTEXT" && "$RESULT" != '{}' ]]; then
  RESULT=$(python3 -c "
import json, sys
try:
    data = json.loads('$RESULT')
    existing = data.get('context', '')
    extra = '$EXTRA_CONTEXT'
    if extra:
        data['context'] = extra + '\n\n' + existing if existing else extra
    print(json.dumps(data))
except:
    print('$RESULT')
" 2>/dev/null || echo "$RESULT")
fi

_log "hook executed | result_len=${#RESULT}"
echo "$RESULT"
exit 0
