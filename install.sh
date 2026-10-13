#!/usr/bin/env bash
# One-click installer: turn OpenCode into a super-app (macOS / Linux / WSL).
# Usage:
#   ./install.sh                          # interactive: superapp first, then stacks
#   ./install.sh --superapp               # ⭐ zero-API-key essentials (recommended start)
#   ./install.sh --stack web-dev          # install a whole stack into ./opencode.json
#   ./install.sh --add github sentry      # install individual servers
#   ./install.sh --add github --global    # install into ~/.config/opencode/opencode.json
#   ./install.sh --list                   # list all 50 servers
#   ./install.sh --search postgres        # searchable index
set -euo pipefail
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

need_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "error: node >=18 required (https://nodejs.org). Then re-run." >&2
    exit 1
  fi
}
need_node

if [[ $# -eq 0 ]]; then
  echo "OpenCode super-app installer — pick one:"
  echo "  0) superapp ⭐     (8 zero-key essentials — start here)"
  echo "  1) web-dev       (files, git, browser, hosting, UI)"
  echo "  2) data-analysis (SQL/NoSQL + reasoning memory)"
  echo "  3) devops        (containers, IaC, clouds, observability)"
  echo "  4) ai-search     (web search, scrape, docs grounding)"
  echo "  5) productivity  (tickets, docs, chat)"
  echo "  6) testing       (browsers, perf, reference harness)"
  read -rp "Choice [0-6]: " c
  case "$c" in
    0|"") S=superapp;; 1) S=web-dev;; 2) S=data-analysis;; 3) S=devops;;
    4) S=ai-search;; 5) S=productivity;; 6) S=testing;;
    *) echo "cancelled"; exit 0;;
  esac
  node "$KIT_DIR/scripts/mcp-manager.mjs" stack "$S"
  exit 0
fi

case "${1:-}" in
  --superapp) node "$KIT_DIR/scripts/mcp-manager.mjs" stack superapp "${@:2}" ;;
  --list) shift; node "$KIT_DIR/scripts/mcp-manager.mjs" list "$@" ;;
  --search) shift; node "$KIT_DIR/scripts/mcp-manager.mjs" search "$@" ;;
  --stack) shift; node "$KIT_DIR/scripts/mcp-manager.mjs" stack "$@" ;;
  --add) shift; node "$KIT_DIR/scripts/mcp-manager.mjs" add "$@" ;;
  --validate) node "$KIT_DIR/scripts/validate.mjs" ;;
  *) echo "Usage: ./install.sh [--superapp|--list|--search Q|--stack NAME|--add ID...] [--global]"; exit 1 ;;
esac
