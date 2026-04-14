#!/usr/bin/env bash
# goodai-base — one-line installer
# Usage: curl -fsSL https://raw.githubusercontent.com/MrCipherSmith/goodai-base/main/install.sh | bash
#
# Env vars:
#   GOODAI_BASE     — install directory (default: ~/goodai-base)
#   GOODAI_VERSION  — pin to a specific release tag, e.g. v1.7.0 (default: latest)
#
# What it does:
# 1. Checks prerequisites (git, bun)
# 2. Clones the repo (or updates if already exists)
# 3. Installs script dependencies (cd scripts && bun install)
# 4. Runs the interactive setup wizard

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

REPO="https://github.com/MrCipherSmith/goodai-base.git"
DEFAULT_DIR="$HOME/goodai-base"
INSTALL_DIR="${GOODAI_BASE:-$DEFAULT_DIR}"
VERSION="${GOODAI_VERSION:-}"

echo -e "\n${BOLD}goodai-base Installer${NC}\n"

# --- Check prerequisites ---

check() {
  if command -v "$1" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $1"
    return 0
  else
    echo -e "  ${RED}✗${NC} $1 not found"
    return 1
  fi
}

echo -e "${BOLD}Checking prerequisites...${NC}"
MISSING=0
check git || MISSING=1

if ! check bun; then
  MISSING=1
  echo -e "    ${DIM}Install: curl -fsSL https://bun.sh/install | bash${NC}"
fi

if ! check claude; then
  echo -e "  ${DIM}(optional) claude not found — needed for Claude Code sessions${NC}"
  echo -e "    ${DIM}Install: npm install -g @anthropic-ai/claude-code${NC}"
fi

if [ "$MISSING" -eq 1 ]; then
  echo -e "\n  ${RED}Install missing dependencies and try again.${NC}\n"
  exit 1
fi

echo ""

# --- Clone or update ---

if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "${BOLD}Updating${NC} existing installation at ${CYAN}$INSTALL_DIR${NC}"
  if [ -n "$VERSION" ]; then
    git -C "$INSTALL_DIR" fetch --depth 1 origin "refs/tags/$VERSION:refs/tags/$VERSION" 2>/dev/null && \
      git -C "$INSTALL_DIR" checkout "$VERSION" --quiet || {
        echo -e "  ${RED}✗${NC} Could not switch to $VERSION"
        exit 1
      }
  else
    if [[ -n "$(git -C "$INSTALL_DIR" status --porcelain 2>/dev/null)" ]]; then
      echo -e "  ${DIM}Local changes detected — skipping update to avoid overwriting your edits.${NC}"
      echo -e "  ${DIM}To force update: git -C $INSTALL_DIR fetch origin main && git -C $INSTALL_DIR reset --hard origin/main${NC}"
    else
      git -C "$INSTALL_DIR" fetch --depth 1 origin main 2>/dev/null && \
        git -C "$INSTALL_DIR" reset --hard origin/main --quiet || {
          echo -e "  ${DIM}Update failed, skipping${NC}"
        }
    fi
  fi
else
  echo -e "${BOLD}Cloning${NC} to ${CYAN}$INSTALL_DIR${NC}"
  mkdir -p "$(dirname "$INSTALL_DIR")"
  if [ -n "$VERSION" ]; then
    git clone --depth 1 --branch "$VERSION" "$REPO" "$INSTALL_DIR"
  else
    git clone --depth 1 "$REPO" "$INSTALL_DIR"
  fi
fi

INSTALLED_VERSION=$(git -C "$INSTALL_DIR" describe --tags --abbrev=0 2>/dev/null || echo "unknown")
echo -e "  ${GREEN}✓${NC} version ${BOLD}$INSTALLED_VERSION${NC}"
echo ""

# --- Install script dependencies ---

echo -e "${BOLD}Installing dependencies...${NC}"
cd "$INSTALL_DIR/scripts"
bun install --silent 2>/dev/null || bun install
echo -e "  ${GREEN}✓${NC} done"
echo ""

# --- Run setup wizard ---

echo -e "${BOLD}Running setup wizard...${NC}\n"
exec bun "$INSTALL_DIR/setup.ts" < /dev/tty
