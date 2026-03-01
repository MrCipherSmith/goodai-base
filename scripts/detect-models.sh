#!/bin/bash

# Detect available models across different AI agent environments

detect_codex() {
    local cache_file="$HOME/.codex/models_cache.json"
    if [ -f "$cache_file" ]; then
        echo "=== Codex Models ==="
        jq -r '.models[] | select(.visibility == "list") | "\(.display_name) - \(.description)"' "$cache_file" 2>/dev/null || echo "  (error reading models)"
    fi
}

detect_cursor() {
    local config_dir="$HOME/.cursor"
    if [ -d "$config_dir" ]; then
        echo "=== Cursor Models ==="
        # Check for model configurations
        if [ -f "$config_dir/settings.json" ]; then
            jq -r '.model // "default"' "$config_dir/settings.json" 2>/dev/null || echo "  default"
        fi
        echo "  Note: Cursor uses OpenAI models by default"
    fi
}

detect_antigravity() {
    local config_dir="$HOME/.antigravity"
    if [ -d "$config_dir" ]; then
        echo "=== Antigravity Models ==="
        if [ -f "$config_dir/config.json" ]; then
            jq -r '.model // "default"' "$config_dir/config.json" 2>/dev/null || echo "  default"
        else
            echo "  (no config found)"
        fi
    fi
}

detect_opencode() {
    local config_dir="$HOME/.config/opencode"
    if [ -d "$config_dir" ]; then
        echo "=== OpenCode Models ==="
        if [ -f "$config_dir/settings.json" ]; then
            jq -r '.model // .provider // "default"' "$config_dir/settings.json" 2>/dev/null || echo "  default"
        else
            echo "  (check OpenCode documentation)"
        fi
    fi
}

detect_zed() {
    local config_dir="$HOME/.config/zed"
    if [ -d "$config_dir" ]; then
        echo "=== Zed Models ==="
        if [ -f "$config_dir/settings.json" ]; then
            jq -r '.model // "default"' "$config_dir/settings.json" 2>/dev/null || echo "  default"
        else
            echo "  (check Zed settings)"
        fi
    fi
}

echo "Detecting available models across environments..."
echo ""

detect_codex
echo ""

detect_cursor
echo ""

detect_antigravity
echo ""

detect_opencode
echo ""

detect_zed
