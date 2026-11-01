#!/usr/bin/env bash
# ==============================================================================
# 🛑 Forsaken Mail — Clean Uninstallation Script
# ==============================================================================
set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RESET="\033[0m"

echo -e "${BOLD}Forsaken Mail — Clean Uninstallation${RESET}\n"

SUDO=""
if [ "$EUID" -ne 0 ]; then
  if command -v sudo &> /dev/null; then
    SUDO="sudo"
  fi
fi

echo "Stopping containers and releasing ports..."
if command -v docker &> /dev/null; then
  $SUDO docker compose down -v --remove-orphans 2>/dev/null || true
  $SUDO docker rm -f forsaken_mail 2>/dev/null || true
fi

if [ "$1" == "--purge-data" ]; then
  echo "Purging all data in ./data..."
  rm -rf ./data
fi

echo -e "${GREEN}✓ Forsaken Mail stopped and ports released.${RESET}"
