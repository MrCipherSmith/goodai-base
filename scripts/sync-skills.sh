#!/bin/bash

# Sync skills from ~/goodea/goodai-base/skills to all agent directories.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_AI_DIR="$(dirname "$SCRIPT_DIR")"

SKILLS_DIR="$BASE_AI_DIR/skills"
VALIDATOR="$BASE_AI_DIR/scripts/validate-skills-before-sync.sh"
SCHEMA_FILE="$BASE_AI_DIR/rules/schemas/skill-workflow-result.schema.json"

echo "Syncing skills from ~/goodea/goodai-base/skills"
echo ""

if [ ! -d "$SKILLS_DIR" ]; then
    echo "Error: source folder $SKILLS_DIR not found"
    exit 1
fi

if [ ! -x "$VALIDATOR" ]; then
    echo "Error: validator script not found or not executable: $VALIDATOR"
    echo "Copy it from: $BASE_AI_DIR/scripts/validate-skills-before-sync.sh"
    exit 1
fi

echo "Running pre-sync validation..."
if ! "$VALIDATOR" "$SKILLS_DIR" "$SCHEMA_FILE"; then
    echo ""
    echo "Sync aborted due to validation errors."
    exit 1
fi

echo ""

# Target mappings
declare -a TARGETS=(
    "$HOME/.cursor/skills:cursor"
    "$HOME/.codex/skills:codex"
    "$HOME/.antigravity/skills:antigravity"
    "$HOME/.config/zed/skills:zed"
    "$HOME/.config/opencode/skills:opencode"
)

echo "Found $(find "$SKILLS_DIR" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ') skills"
echo ""

sync_errors=0

for target_mapping in "${TARGETS[@]}"; do
    target_dir="${target_mapping%%:*}"
    suffix="${target_mapping##*:}"

    echo "-> Syncing to $target_dir"
    mkdir -p "$target_dir"

    for skill_dir in "$SKILLS_DIR"/*/; do
        [ -d "$skill_dir" ] || continue
        skill_name=$(basename "$skill_dir")
        # Prefer platform-specific variant if it exists, fall back to canonical SKILL.md
        source_file_variant="$skill_dir/SKILL.$suffix.md"
        source_file_canonical="$skill_dir/SKILL.md"
        target_skill_dir="$target_dir/$skill_name"
        target_file="$target_skill_dir/SKILL.md"

        if [ -f "$source_file_variant" ]; then
            source_file="$source_file_variant"
        elif [ -f "$source_file_canonical" ]; then
            source_file="$source_file_canonical"
            echo "  NOTE $skill_name: using canonical SKILL.md (no SKILL.$suffix.md)"
        else
            echo "  SKIP $skill_name: neither SKILL.$suffix.md nor SKILL.md found"
            continue
        fi

        mkdir -p "$target_skill_dir"

        if ! cp "$source_file" "$target_file"; then
            echo "  FAIL $skill_name: cannot copy $source_file -> $target_file"
            sync_errors=$((sync_errors + 1))
            continue
        fi

        # Copy scripts if exist
        if [ -d "$skill_dir/scripts" ]; then
            if ! cp -R "$skill_dir/scripts" "$target_skill_dir/" 2>/dev/null; then
                echo "  FAIL $skill_name: cannot copy scripts directory"
                sync_errors=$((sync_errors + 1))
                continue
            fi
        fi

        echo "  OK   $skill_name"
    done
    echo ""
done

if [ "$sync_errors" -gt 0 ]; then
    echo "Skills sync finished with errors: $sync_errors"
    exit 1
fi

# Sync AGENTS.md to all tool targets
AGENTS_SOURCE="$BASE_AI_DIR/AGENTS.md"

declare -a AGENTS_TARGETS=(
    "$HOME/.cursor/rules/AGENTS.md:Cursor"
    "$HOME/.codex/AGENTS.md:Codex"
    "$HOME/.config/zed/AGENTS.md:Zed"
    "$HOME/.config/opencode/AGENTS.md:OpenCode"
)

if [ -f "$AGENTS_SOURCE" ]; then
    echo -e "\n-> Syncing AGENTS.md to all tool targets"
    for target_mapping in "${AGENTS_TARGETS[@]}"; do
        target_file="${target_mapping%%:*}"
        label="${target_mapping##*:}"
        target_dir="$(dirname "$target_file")"
        mkdir -p "$target_dir"
        if cp "$AGENTS_SOURCE" "$target_file"; then
            echo "  OK   $label: $target_file"
        else
            echo "  FAIL $label: cannot copy to $target_file"
        fi
    done
else
    echo -e "\nWarning: AGENTS.md source not found: $AGENTS_SOURCE"
fi

echo ""
echo "Skills sync completed"
