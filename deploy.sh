#!/usr/bin/env bash
# ==============================================================================
# ⚡ CyberTemp (Modified Forsaken Mail) — One-Command VPS Deployment
# ==============================================================================
set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
PURPLE="\033[0;35m"
RESET="\033[0m"

echo -e "${CYAN}${BOLD}"
echo "   ______      __             ______                    "
echo "  / ____/_  __/ /_  ___  _____/_  __/__  ____ ___  ____ "
echo " / /   / / / / __ \/ _ \/ ___/ / / / _ \/ __ \`__ \/ __ \\"
echo "/ /___/ /_/ / /_/ /  __/ /    / / /  __/ / / / / / /_/ /"
echo "\____/\__, /_.___/\___/_/    /_/  \___/_/ /_/ /_/ .___/ "
echo "     /____/                                    /_/      "
echo -e "${RESET}"
echo -e "${BOLD}CyberTemp — Minimalist Neomorphic SMTP Mail Server (Port 25)${RESET}\n"

# Sudo check
SUDO=""
if [ "$EUID" -ne 0 ]; then
  if command -v sudo &> /dev/null; then
    SUDO="sudo"
  else
    echo -e "${RED}[ERROR] Please run this script as root or with sudo.${RESET}"
    exit 1
  fi
fi

# 1. Stop any old containers
echo -e "${CYAN}[1/5] Stopping old containers to release ports...${RESET}"
if command -v docker &> /dev/null; then
  $SUDO docker rm -f rizz_backend rizz_frontend rizz_postgres rizz_redis rizz_worker forsaken_mail 2>/dev/null || true
  $SUDO docker compose down 2>/dev/null || true
fi

# 2. Release host port 25 if Ubuntu postfix / sendmail is occupying it
echo -e "\n${CYAN}[2/5] Ensuring Port 25 (SMTP) is free on host...${RESET}"
if command -v systemctl &> /dev/null; then
  $SUDO systemctl stop postfix 2>/dev/null || true
  $SUDO systemctl disable postfix 2>/dev/null || true
  $SUDO systemctl stop sendmail 2>/dev/null || true
  $SUDO systemctl stop exim4 2>/dev/null || true
fi

# 3. Detect Public IP
echo -e "\n${CYAN}[3/5] Detecting server IP address...${RESET}"
SERVER_IP=$(curl -s -m 5 https://api.ipify.org || curl -s -m 5 https://ifconfig.me || echo "127.0.0.1")
echo -e "${GREEN}✓ Public IP: ${SERVER_IP}${RESET}"

# 4. Prepare Environment
echo -e "\n${CYAN}[4/5] Preparing configuration...${RESET}"
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${GREEN}✓ Created .env file.${RESET}"
fi

mkdir -p data

# 5. Build and launch container
echo -e "\n${CYAN}[5/5] Building and launching CyberTemp container...${RESET}"
$SUDO docker compose up -d --build

sleep 3

echo -e "\n${GREEN}${BOLD}================================================================${RESET}"
echo -e "${GREEN}${BOLD}  🚀 CYBERTEMP IS RUNNING ON YOUR VPS!${RESET}"
echo -e "${GREEN}${BOLD}================================================================${RESET}\n"

echo -e "${BOLD}🌐 Web Dashboard:${RESET}         ${CYAN}http://${SERVER_IP}${RESET} (or http://${SERVER_IP}:3000)"
echo -e "${BOLD}📬 SMTP Server:${RESET}           ${CYAN}Port 25 (Direct Inbound Receiving!)${RESET}"
echo -e "${BOLD}🔒 10-Day Vault:${RESET}          ${GREEN}Conserved for 10 Days (240 Hours) in SQLite${RESET}"
echo -e "${BOLD}🛡️ Admin Default Pwd:${RESET}     ${PURPLE}cyberadmin2026${RESET} (for generating API keys)\n"

echo -e "${BOLD}📋 REQUIRED DNS RECORDS IN CLOUDFLARE FOR YOUR DOMAIN:${RESET}"
echo -e "   1. ${YELLOW}A Record:${RESET}   Name: ${BOLD}mail${RESET}   Value: ${BOLD}${SERVER_IP}${RESET}   Proxy: ${RED}DNS Only (Grey Cloud!)${RESET}"
echo -e "   2. ${YELLOW}MX Record:${RESET}  Name: ${BOLD}@${RESET}      Value: ${BOLD}mail.rizzcord.site${RESET}   Priority: ${BOLD}10${RESET}\n"

echo -e "${YELLOW}NOTE:${RESET} Cloudflare Proxy MUST be ${BOLD}OFF (Grey Cloud)${RESET} for ${BOLD}mail.rizzcord.site${RESET} so Port 25 SMTP traffic reaches your server directly!\n"

echo -e "${BOLD}Management commands:${RESET}"
echo "   View live logs:         docker compose logs -f"
echo "   Restart container:      docker compose restart"
echo "   Stop service:           docker compose down"
echo -e "\n${GREEN}Enjoy your ultra-fast 10-day CyberTemp mail server!${RESET}\n"
