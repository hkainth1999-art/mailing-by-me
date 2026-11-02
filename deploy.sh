#!/usr/bin/env bash
# ==============================================================================
# 👑 CROWN MAIL VAULT — 1-COMMAND QUICK DEPLOYMENT SCRIPT
# Rapid deployment script for Docker, Port 25 SMTP Gateway, and Web Dashboard
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
echo "   ______                               __  ___      _ __   _    __            ____  "
echo "  / ____/________ _      ______        /  |/  /___ _(_) /  | |  / /___ ___  __/ / /_ "
echo " / /   / ___/ __ \ | /| / / __ \      / /|_/ / __ \`/ / /   | | / / __ \`/ / / / / __/ "
echo "/ /___/ /  / /_/ / |/ |/ / / / /     / /  / / /_/ / / /    | |/ / /_/ / /_/ / / /_   "
echo "\____/_/   \____/|__/|__/_/ /_/     /_/  /_/\__,_/_/_/     |___/\__,_/\__,_/_/\__/   "
echo -e "${RESET}"
echo -e "${BOLD}Crown Mail Vault — Inbound Port 25 Direct SMTP & 24h Cold Vault${RESET}\n"

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

# Detect Public IP
detect_ip() {
  SERVER_IP=$(curl -s -m 5 https://api.ipify.org || curl -s -m 5 https://ifconfig.me || echo "127.0.0.1")
}
detect_ip

echo -e "Server Public IP: ${GREEN}${BOLD}${SERVER_IP}${RESET}\n"

# 1. Stop any old containers to release ports
echo -e "${CYAN}[1/5] Stopping old containers to release ports...${RESET}"
if command -v docker &> /dev/null; then
  $SUDO docker rm -f forsaken_mail 2>/dev/null || true
  $SUDO docker compose down 2>/dev/null || true
fi

# 2. Release host port 25 if postfix/sendmail/exim is occupying it
echo -e "\n${CYAN}[2/5] Ensuring Port 25 (SMTP) is free on host...${RESET}"
if command -v systemctl &> /dev/null; then
  $SUDO systemctl stop postfix 2>/dev/null || true
  $SUDO systemctl disable postfix 2>/dev/null || true
  $SUDO systemctl stop sendmail 2>/dev/null || true
  $SUDO systemctl stop exim4 2>/dev/null || true
fi

# 3. Create required directories
echo -e "\n${CYAN}[3/5] Setting up data volumes...${RESET}"
mkdir -p data data/certs
chmod -R 755 data

# 4. Compile frontend bundle if node & npm are installed locally
if command -v npm &> /dev/null; then
  echo -e "\n${CYAN}[4/5] Building React TSX frontend assets...${RESET}"
  npm install --silent 2>/dev/null || true
  npm run build || true
else
  echo -e "\n${CYAN}[4/5] Docker will compile frontend assets inside the container image...${RESET}"
fi

# 5. Build and launch Docker container
echo -e "\n${CYAN}[5/5] Launching Crown Mail Vault Docker container...${RESET}"
if command -v docker &> /dev/null; then
  $SUDO docker compose up -d --build
else
  echo -e "${RED}[ERROR] Docker is not installed on this host.${RESET}"
  echo -e "Run: ${BOLD}curl -fsSL https://get.docker.com | sh${RESET} to install Docker."
  exit 1
fi

sleep 2

# Status verification
echo -e "\n${GREEN}${BOLD}================================================================================${RESET}"
echo -e "${GREEN}${BOLD}  👑 CROWN MAIL VAULT DEPLOYED SUCCESSFULLY!${RESET}"
echo -e "${GREEN}${BOLD}================================================================================${RESET}\n"

# Read configured domains from .env or use defaults
WEB_DOMAIN="tempmail.rizzcord.site"
MAIL_FQDN="mail.rizzcord.site"

if [ -f ".env" ]; then
  EXTRACTED_DOMAIN=$(grep -E '^DISCORD_REDIRECT_URI=' .env | sed -e 's|^.*https\?://||' -e 's|/.*$||' || echo "")
  if [ -n "$EXTRACTED_DOMAIN" ]; then
    WEB_DOMAIN="$EXTRACTED_DOMAIN"
  fi
fi

WEB_URL="https://${WEB_DOMAIN}"

echo -e "  🌐 ${BOLD}Web Dashboard (HTTPS):${RESET}   ${CYAN}${WEB_URL}${RESET}"
echo -e "  📬 ${BOLD}Inbound Port 25 SMTP:${RESET}    ${CYAN}${MAIL_FQDN} (Listening on 0.0.0.0:25)${RESET}"
echo -e "  📤 ${BOLD}Outbound Port 587 SMTP:${RESET}   ${CYAN}${MAIL_FQDN}:587 (Auth via Crown API Key)${RESET}"
echo -e "  ❄️ ${BOLD}Preservation Vault:${RESET}      ${PURPLE}Active (24h Cold Lossless Compression)${RESET}\n"

echo -e "${BOLD}Helpful Management Commands:${RESET}"
echo -e "  • Interactive CLI:   ${BOLD}./install.sh${RESET}"
echo -e "  • View Live Logs:    ${BOLD}docker compose logs -f${RESET}"
echo -e "  • Restart Services:  ${BOLD}docker compose restart${RESET}"
echo -e "  • Stop Mail Server:  ${BOLD}docker compose down${RESET}\n"

