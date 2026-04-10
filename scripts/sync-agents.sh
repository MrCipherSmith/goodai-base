#!/usr/bin/env bash
# sync-agents.sh — regenerate only stale agent files (checksum-based)
#
# Usage:
#   scripts/sync-agents.sh [--dry-run] [--output-dir <path>]
#
# Reads skills/agents-registry.json, computes current checksums of source SKILL.md files,
# and calls generate-agents.sh only for skills whose source has changed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY_FILE="$REPO_ROOT/skills/agents-registry.json"
GENERATE_SCRIPT="$SCRIPT_DIR/generate-agents.sh"

DRY_RUN=false
OUTPUT_DIR="$HOME/.claude/agents"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)    DRY_RUN=true; shift ;;
    --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ ! -f "$REGISTRY_FILE" ]]; then
  echo "No registry found at $REGISTRY_FILE"
  echo "Run generate-agents.sh first to create the registry."
  exit 0
fi

# Compute checksum
_checksum() {
  if command -v sha256sum &>/dev/null; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

echo "Syncing agents from registry: $REGISTRY_FILE"
[[ "$DRY_RUN" == "true" ]] && echo "(DRY RUN — no files written)"
echo ""

COUNT_STALE=0
COUNT_UPTODATE=0
COUNT_MISSING=0
COUNT_STALE_AGENTS=()

# Read registry entries and check checksums
while IFS=$'\t' read -r skill_name source stored_checksum; do
  [[ -z "$skill_name" ]] && continue

  if [[ ! -f "$source" ]]; then
    echo "  WARN: Source missing for $skill_name: $source"
    ((COUNT_MISSING++)) || true
    continue
  fi

  current_checksum=$(_checksum "$source")

  if [[ "$current_checksum" != "$stored_checksum" ]]; then
    echo "  STALE: $skill_name (source changed)"
    COUNT_STALE_AGENTS+=("$skill_name")
    ((COUNT_STALE++)) || true
  else
    echo "  OK:    $skill_name"
    ((COUNT_UPTODATE++)) || true
  fi
done < <(python3 -c "
import json
try:
    data = json.load(open('$REGISTRY_FILE'))
    for entry in data.get('agents', []):
        print(entry.get('skill_name','') + '\t' + entry.get('source','') + '\t' + entry.get('source_checksum',''))
except Exception as e:
    import sys
    print(f'ERROR: {e}', file=sys.stderr)
" 2>/dev/null || true)

echo ""
echo "Status: Up-to-date: $COUNT_UPTODATE | Stale: $COUNT_STALE | Missing source: $COUNT_MISSING"

if [[ $COUNT_STALE -eq 0 ]]; then
  echo "All agents are up-to-date."
  exit 0
fi

echo ""
echo "Regenerating $COUNT_STALE stale agent(s)..."

GENERATE_ARGS="--output-dir $OUTPUT_DIR"
[[ "$DRY_RUN" == "true" ]] && GENERATE_ARGS="$GENERATE_ARGS --dry-run"

bash "$GENERATE_SCRIPT" $GENERATE_ARGS

echo ""
echo "Sync complete."
