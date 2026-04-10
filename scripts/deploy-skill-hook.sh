#!/usr/bin/env bash
# deploy-skill-hook.sh — deploy the skill evaluator hook into a target project repo
#
# Usage:
#   scripts/deploy-skill-hook.sh <target-project-path>
#   scripts/deploy-skill-hook.sh --uninstall <target-project-path>
#
# What it does:
#   1. Creates .claude/ directory in the target project if absent
#   2. Copies the hook template into .claude/hooks/skill-evaluator.sh
#   3. Merges a UserPromptSubmit hook entry into .claude/settings.json
#   4. Creates .claude/skill-overrides.json if not present
#
# Requirements: bash, python3, jq (optional — falls back to python3 for JSON)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GOODAI_BASE="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_TEMPLATE="$GOODAI_BASE/scripts/templates/skill-evaluator.sh"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

UNINSTALL=false
TARGET_PROJECT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --uninstall)
      UNINSTALL=true
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--uninstall] <target-project-path>" >&2
      exit 1
      ;;
    *)
      TARGET_PROJECT="$1"
      shift
      ;;
  esac
done

if [[ -z "$TARGET_PROJECT" ]]; then
  echo "Usage: $0 [--uninstall] <target-project-path>" >&2
  exit 1
fi

TARGET_PROJECT="$(cd "$TARGET_PROJECT" 2>/dev/null && pwd)" || {
  echo "ERROR: Target project path does not exist: $1" >&2
  exit 1
}

# Guard: don't deploy into goodai-base itself
if [[ "$TARGET_PROJECT" == "$GOODAI_BASE" ]]; then
  echo "ERROR: Cannot deploy hook into goodai-base itself (circular reference)." >&2
  exit 1
fi

CLAUDE_DIR="$TARGET_PROJECT/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
HOOK_FILE="$HOOKS_DIR/skill-evaluator.sh"
OVERRIDES_FILE="$CLAUDE_DIR/skill-overrides.json"

HOOK_ID="goodai-skill-evaluator"
HOOK_COMMAND="\"\$CLAUDE_PROJECT_DIR\"/.claude/hooks/skill-evaluator.sh"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Merge/update UserPromptSubmit hook entry in settings.json via python3
_merge_hook() {
  python3 - "$SETTINGS_FILE" "$HOOK_COMMAND" <<'PYEOF'
import json, sys, os

settings_path = sys.argv[1]
hook_command = sys.argv[2]
hook_id = "goodai-skill-evaluator"

# Load or create settings
if os.path.exists(settings_path):
    with open(settings_path) as f:
        try:
            settings = json.load(f)
        except json.JSONDecodeError:
            settings = {}
else:
    settings = {}

hooks = settings.setdefault("hooks", {})
ups_list = hooks.setdefault("UserPromptSubmit", [])

# Build our hook entry
our_entry = {
    "hooks": [
        {
            "id": hook_id,
            "type": "command",
            "command": hook_command,
            "timeout": 10
        }
    ]
}

# Check if already present — find by id, replace in-place
found = False
for group in ups_list:
    inner = group.get("hooks", [])
    for i, h in enumerate(inner):
        if h.get("id") == hook_id:
            inner[i] = our_entry["hooks"][0]
            found = True
            break
    if found:
        break

if not found:
    ups_list.append(our_entry)

with open(settings_path, "w") as f:
    json.dump(settings, f, indent=2)
    f.write("\n")

print("merged")
PYEOF
}

# Remove hook entry from settings.json
_remove_hook() {
  python3 - "$SETTINGS_FILE" <<'PYEOF'
import json, sys, os

settings_path = sys.argv[1]
hook_id = "goodai-skill-evaluator"

if not os.path.exists(settings_path):
    print("not-found")
    sys.exit(0)

with open(settings_path) as f:
    try:
        settings = json.load(f)
    except json.JSONDecodeError:
        print("invalid-json")
        sys.exit(0)

hooks = settings.get("hooks", {})
ups_list = hooks.get("UserPromptSubmit", [])

new_ups = []
removed = False
for group in ups_list:
    inner = group.get("hooks", [])
    new_inner = [h for h in inner if h.get("id") != hook_id]
    if len(new_inner) < len(inner):
        removed = True
    if new_inner:
        group = dict(group)
        group["hooks"] = new_inner
        new_ups.append(group)
    # else: drop empty group
    elif not removed:
        new_ups.append(group)

hooks["UserPromptSubmit"] = new_ups
settings["hooks"] = hooks

with open(settings_path, "w") as f:
    json.dump(settings, f, indent=2)
    f.write("\n")

print("removed" if removed else "not-found")
PYEOF
}

# ---------------------------------------------------------------------------
# Uninstall mode
# ---------------------------------------------------------------------------

if [[ "$UNINSTALL" == "true" ]]; then
  echo "Uninstalling skill evaluator hook from: $TARGET_PROJECT"
  echo ""

  removed_files=()
  skipped_files=()

  # Remove hook file
  if [[ -f "$HOOK_FILE" ]]; then
    rm "$HOOK_FILE"
    removed_files+=(".claude/hooks/skill-evaluator.sh")
  else
    skipped_files+=(".claude/hooks/skill-evaluator.sh (not found)")
  fi

  # Remove from settings.json
  if [[ -f "$SETTINGS_FILE" ]]; then
    result=$(_remove_hook)
    if [[ "$result" == "removed" ]]; then
      removed_files+=(".claude/settings.json (hook entry removed)")
    else
      skipped_files+=(".claude/settings.json (hook entry not found)")
    fi
  else
    skipped_files+=(".claude/settings.json (not found)")
  fi

  echo "Removed:"
  for f in "${removed_files[@]:-}"; do
    echo "  - $f"
  done
  if [[ ${#removed_files[@]} -eq 0 ]]; then
    echo "  (nothing)"
  fi

  echo ""
  echo "Skipped:"
  for f in "${skipped_files[@]:-}"; do
    echo "  - $f"
  done
  if [[ ${#skipped_files[@]} -eq 0 ]]; then
    echo "  (nothing)"
  fi

  echo ""
  echo "Note: .claude/skill-overrides.json preserved (manual cleanup if needed)."
  exit 0
fi

# ---------------------------------------------------------------------------
# Install mode
# ---------------------------------------------------------------------------

echo "Deploying skill evaluator hook to: $TARGET_PROJECT"
echo ""

if [[ ! -f "$HOOK_TEMPLATE" ]]; then
  echo "ERROR: Hook template not found: $HOOK_TEMPLATE" >&2
  echo "Run this script from within the goodai-base repository." >&2
  exit 1
fi

created_files=()
updated_files=()

# 1. Create .claude/ directory
if [[ ! -d "$CLAUDE_DIR" ]]; then
  mkdir -p "$CLAUDE_DIR"
fi

# 2. Create .claude/hooks/ directory
if [[ ! -d "$HOOKS_DIR" ]]; then
  mkdir -p "$HOOKS_DIR"
fi

# 3. Copy hook template
if [[ -f "$HOOK_FILE" ]]; then
  # Check if content differs
  if ! diff -q "$HOOK_TEMPLATE" "$HOOK_FILE" > /dev/null 2>&1; then
    cp "$HOOK_TEMPLATE" "$HOOK_FILE"
    chmod +x "$HOOK_FILE"
    updated_files+=(".claude/hooks/skill-evaluator.sh")
  fi
else
  cp "$HOOK_TEMPLATE" "$HOOK_FILE"
  chmod +x "$HOOK_FILE"
  created_files+=(".claude/hooks/skill-evaluator.sh")
fi

# 4. Merge hook into settings.json
if [[ -f "$SETTINGS_FILE" ]]; then
  _merge_hook
  updated_files+=(".claude/settings.json (hook entry merged)")
else
  # Create minimal settings.json then merge
  echo '{}' > "$SETTINGS_FILE"
  _merge_hook
  created_files+=(".claude/settings.json")
fi

# 5. Create skill-overrides.json if not present
if [[ ! -f "$OVERRIDES_FILE" ]]; then
  python3 -c "
import json
data = {
    'disabled': [],
    'local_skills': [],
    'extra_context': ''
}
with open('$OVERRIDES_FILE', 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
"
  created_files+=(".claude/skill-overrides.json")
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo "Created:"
for f in "${created_files[@]:-}"; do
  echo "  + $f"
done
if [[ ${#created_files[@]} -eq 0 ]]; then
  echo "  (nothing new)"
fi

echo ""
echo "Updated:"
for f in "${updated_files[@]:-}"; do
  echo "  ~ $f"
done
if [[ ${#updated_files[@]} -eq 0 ]]; then
  echo "  (nothing changed)"
fi

echo ""
echo "Done. The hook will activate on next Claude Code session in:"
echo "  $TARGET_PROJECT"
echo ""
echo "Customize behavior in: .claude/skill-overrides.json"
echo "  - disabled:     list of skill names to suppress"
echo "  - local_skills: project-specific skills to add"
echo "  - extra_context: text prepended to every skill suggestion"
echo ""
echo "goodai-base path: $GOODAI_BASE"
echo "Set GOODAI_BASE env var to override if goodai-base is elsewhere."
