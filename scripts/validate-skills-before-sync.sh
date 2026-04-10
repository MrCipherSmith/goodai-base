#!/bin/bash

set -euo pipefail

# Dependency checks
for cmd in jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command '$cmd' not found. Install with: brew install $cmd"
    exit 1
  fi
done

SKILLS_DIR="${1:-$HOME/goodea/goodai-base/skills}"
SCHEMA_FILE="${2:-$HOME/goodea/goodai-base/rules/schemas/skill-workflow-result.schema.json}"

if [ ! -d "$SKILLS_DIR" ]; then
    echo "Error: skills directory not found: $SKILLS_DIR"
    exit 1
fi

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "Error: schema file not found: $SCHEMA_FILE"
    exit 1
fi

if ! jq -e '.type == "object" and .additionalProperties == false and (.required | index("status")) and (.required | index("decision")) and (.required | index("timestamp_utc")) and (.properties.workflow.enum | index("skill-create")) and (.properties.workflow.enum | index("skill-update"))' "$SCHEMA_FILE" >/dev/null; then
    echo "Error: schema sanity check failed: $SCHEMA_FILE"
    exit 1
fi

validate_skill_profile() {
    local file="$1"
    local skill_name="$2"
    local suffix="$3"

    if [ ! -f "$file" ]; then
        return 0
    fi

    if [ "$(sed -n '1p' "$file")" != "---" ]; then
        echo "FAIL: $skill_name ($suffix) - missing opening YAML frontmatter delimiter"
        return 1
    fi

    if ! awk 'NR > 1 && $0 == "---" { found=1; exit } END { exit(found ? 0 : 1) }' "$file"; then
        echo "FAIL: $skill_name ($suffix) - missing closing YAML frontmatter delimiter"
        return 1
    fi

    local frontmatter
    frontmatter="$(awk 'NR==1 && $0=="---" {inside=1; next} inside && $0=="---" {exit} inside {print}' "$file")"

    if ! printf '%s\n' "$frontmatter" | grep -Eq '^name:[[:space:]]*'; then
        echo "FAIL: $skill_name ($suffix) - missing 'name' in frontmatter"
        return 1
    fi

    if ! printf '%s\n' "$frontmatter" | grep -Eq '^description:[[:space:]]*'; then
        echo "FAIL: $skill_name ($suffix) - missing 'description' in frontmatter"
        return 1
    fi

    local name_line
    local name_value
    name_line="$(printf '%s\n' "$frontmatter" | grep -E '^name:[[:space:]]*' | head -n 1)"
    name_value="${name_line#name:}"
    name_value="$(printf '%s' "$name_value" | sed -E "s/^[[:space:]]+//; s/[[:space:]]+$//; s/^['\"]//; s/['\"]$//")"

    if [ -n "$name_value" ] && ! [[ "$name_value" =~ ^[a-z0-9-]+$ ]]; then
        echo "FAIL: $skill_name ($suffix) - invalid name '$name_value' (use lowercase letters, digits, hyphens)"
        return 1
    fi

    if [ ${#name_value} -gt 64 ]; then
        echo "FAIL: $skill_name ($suffix) - name too long (${#name_value} > 64)"
        return 1
    fi

    return 0
}

errors=0
validated=0

# Directories inside skills/ that are NOT skills (shared resources, etc.)
SKIP_DIRS="shared"

for skill_dir in "$SKILLS_DIR"/*/; do
    [ -d "$skill_dir" ] || continue

    skill_name="$(basename "$skill_dir")"

    # Skip non-skill utility directories
    if printf '%s\n' $SKIP_DIRS | grep -qx "$skill_name"; then
        continue
    fi
    cursor_file="$skill_dir/SKILL.cursor.md"
    codex_file="$skill_dir/SKILL.codex.md"

    if [ ! -f "$cursor_file" ]; then
        echo "FAIL: $skill_name - required profile missing: SKILL.cursor.md"
        errors=$((errors + 1))
    fi

    if [ ! -f "$codex_file" ]; then
        echo "FAIL: $skill_name - required profile missing: SKILL.codex.md"
        errors=$((errors + 1))
    fi

    for suffix in cursor codex zed opencode; do
        source_file="$skill_dir/SKILL.$suffix.md"
        if [ -f "$source_file" ]; then
            validated=$((validated + 1))
            if ! validate_skill_profile "$source_file" "$skill_name" "$suffix"; then
                errors=$((errors + 1))
            fi
        fi
    done
done

if [ "$errors" -gt 0 ]; then
    echo ""
    echo "Validation failed: $errors issue(s) found."
    exit 1
fi

echo "Validation passed: $validated skill profile file(s) checked."

# Run rules.json validation (non-blocking if script missing)
VALIDATE_RULES_SCRIPT="$(dirname "$0")/validate-rules-json.sh"
if [ -x "$VALIDATE_RULES_SCRIPT" ]; then
    echo ""
    echo "Running rules.json validation..."
    if ! bash "$VALIDATE_RULES_SCRIPT"; then
        echo ""
        echo "rules.json validation failed. Fix errors before syncing."
        exit 1
    fi
fi
