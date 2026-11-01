#!/usr/bin/env bash
# ==============================================================================
# 👑 Crown Mail Vault — One-Command VPS Deployment with HTTPS
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
echo "   ______                         _    __            ____  "
echo "  / ____/________ _      ______  | |  / /___ ___  __/ / /_ "
echo " / /   / ___/ __ \ | /| / / __ \ | | / / __ \`/ / / / / __/ "
echo "/ /___/ /  / /_/ / |/ |/ / / / / | |/ / /_/ / /_/ / / /_   "
echo "\____/_/   \____/|__/|__/_/ /_/  |___/\__,_/\__,_/_/\__/   "
echo -e "${RESET}"
echo -e "${BOLD}Crown Mail Vault — Private SMTP Inbound Engine & 24h Cold Vault${RESET}\n"

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
  $SUDO docker rm -f forsaken_mail 2>/dev/null || true
  $SUDO docker compose down 2>/dev/null || true
fi

# 2. Release host port 25 if postfix/sendmail is occupying it
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

mkdir -p data/certs

# 5. Build and launch container
echo -e "\n${CYAN}[5/5] Building and launching Crown Mail Vault container...${RESET}"
$SUDO docker compose up -d --build

sleep 3

echo -e "\n${GREEN}${BOLD}================================================================${RESET}"
echo -e "${GREEN}${BOLD}  👑 CROWN MAIL VAULT IS RUNNING ON YOUR VPS!${RESET}"
echo -e "${GREEN}${BOLD}================================================================${RESET}\n"

echo -e "${BOLD}🌐 Web Dashboard (HTTPS/HTTP):${RESET} ${CYAN}https://tempmail.rizzcord.site${RESET} (or http://${SERVER_IP})"
echo -e "${BOLD}📬 SMTP Server (MX):${RESET}            ${CYAN}mail.rizzcord.site (Port 25 Direct Inbound!)${RESET}"
echo -e "${BOLD}❄️ Cold Preservation Vault:${RESET}     ${GREEN}Conserved indefinitely (Compressed after 24h, 0 deletions)${RESET}"
echo -e "${BOLD}🔒 Discord Owner ID:${RESET}            ${PURPLE}1293104653650755604${RESET}\n"

echo -e "${BOLD}📋 REQUIRED CLOUDFLARE DNS SETUP:${RESET}"
echo -e "   1. In Cloudflare -> ${BOLD}DNS${RESET}:"
echo -e "      - ${YELLOW}A Record:${RESET}   Name: ${BOLD}tempmail${RESET}  Value: ${BOLD}${SERVER_IP}${RESET}   Proxy: ${GREEN}Proxied (Orange Cloud!) -> Instant Free HTTPS${RESET}"
echo -e "      - ${YELLOW}A Record:${RESET}   Name: ${BOLD}mail${RESET}      Value: ${BOLD}${SERVER_IP}${RESET}   Proxy: ${RED}DNS Only (Grey Cloud!) -> For Port 25 SMTP${RESET}"
echo -e "      - ${YELLOW}MX Record:${RESET}  Name: ${BOLD}@${RESET}         Value: ${BOLD}mail.rizzcord.site${RESET}  Priority: ${BOLD}10${RESET}"
echo -e "   2. In Cloudflare -> ${BOLD}SSL/TLS${RESET}:"
echo -e "      - Encryption mode: ${BOLD}Flexible${RESET} (or Full if using Nginx)"
echo -e "      - Edge Certificates: Enable ${BOLD}Always Use HTTPS${RESET}\n"

echo -e "${BOLD}📋 DISCORD OAUTH2 REDIRECT URI TO ADD:${RESET}"
echo -e "   In Discord Developer Portal -> Application -> OAuth2 -> Redirects:"
echo -e "   ${CYAN}https://tempmail.rizzcord.site/api/auth/discord/callback${RESET}\n"

echo -e "${BOLD}Management commands:${RESET}"
echo "   View live logs:         docker compose logs -f"
echo "   Restart container:      docker compose restart"
echo "   Stop service:           docker compose down"
echo -e "\n${GREEN}Enjoy your ultra-fast, secure Crown Mail Vault!${RESET}\n"
