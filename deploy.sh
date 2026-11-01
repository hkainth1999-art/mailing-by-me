#!/usr/bin/env bash
# ==============================================================================
# ⚡ Forsaken Mail (Modified) — One-Command VPS Deployment
# ==============================================================================
set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${CYAN}${BOLD}"
echo "  _____                 _              __  __       _ _ "
echo " |  ___|__  _ __ ___  _| | _____ _ __ |  \/  | __ _(_) |"
echo " | |_ / _ \| '__/ __|/ _\` |/ / _ \ '_ \| |\/| |/ _\` | | |"
echo " |  _| (_) | |  \__ \ (_|   <  __/ | | | |  | | (_| | | |"
echo " |_|  \___/|_|  |___/\__,_|\_\___|_| |_|_|  |_|\__,_|_|_|"
echo -e "${RESET}"
echo -e "${BOLD}Forsaken Mail (Modified) — Direct Port 25 SMTP Mail Server${RESET}\n"

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

# 1. Stop any old containers (including legacy rizz-mails)
echo -e "${CYAN}[1/5] Stopping any old containers to release ports...${RESET}"
if command -v docker &> /dev/null; then
  $SUDO docker rm -f rizz_backend rizz_frontend rizz_postgres rizz_redis rizz_worker forsaken_mail 2>/dev/null || true
  $SUDO docker compose down 2>/dev/null || true
fi

# 2. Release host port 25 if Ubuntu postfix / sendmail is occupying it
echo -e "\n${CYAN}[2/5] Ensuring Port 25 (SMTP) is free...${RESET}"
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
echo -e "\n${CYAN}[5/5] Building and launching Forsaken Mail container...${RESET}"
$SUDO docker compose up -d --build

sleep 3

echo -e "\n${GREEN}${BOLD}================================================================${RESET}"
echo -e "${GREEN}${BOLD}  🚀 FORSAKEN MAIL IS SUCCESSFULLY RUNNING!${RESET}"
echo -e "${GREEN}${BOLD}================================================================${RESET}\n"

echo -e "${BOLD}🌐 Web Dashboard:${RESET}         ${CYAN}http://${SERVER_IP}${RESET} (or http://${SERVER_IP}:3000)"
echo -e "${BOLD}📬 SMTP Server:${RESET}           ${CYAN}Port 25 (Accepting incoming mail instantly!)${RESET}"
echo -e "${BOLD}⚡ Discord Route:${RESET}         ${CYAN}http://${SERVER_IP}/api/discord/<address>?wait=true${RESET}\n"

echo -e "${BOLD}📋 REQUIRED DNS RECORDS ON CLOUDFLARE FOR YOUR DOMAIN:${RESET}"
echo -e "   1. ${YELLOW}A Record:${RESET}   Name: ${BOLD}mail${RESET}   Value: ${BOLD}${SERVER_IP}${RESET}   Proxy: ${RED}DNS Only (Grey Cloud!)${RESET}"
echo -e "   2. ${YELLOW}MX Record:${RESET}  Name: ${BOLD}@${RESET}      Value: ${BOLD}mail.rizzcord.site${RESET}   Priority: ${BOLD}10${RESET}\n"

echo -e "${YELLOW}IMPORTANT:${RESET} Make sure Cloudflare Proxy is ${BOLD}OFF (Grey Cloud)${RESET} for ${BOLD}mail.rizzcord.site${RESET} so Port 25 SMTP reaches your VPS directly!\n"

echo -e "${BOLD}Useful commands:${RESET}"
echo "   View live incoming mail logs:   docker compose logs -f"
echo "   Restart mail server:            docker compose restart"
echo "   Stop mail server:               docker compose down"
echo -e "\n${GREEN}Enjoy sub-second instant email delivery!${RESET}\n"
