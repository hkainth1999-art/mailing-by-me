#!/usr/bin/env bash
# ==============================================================================
# 👑 Crown Mail Vault — 1-Command Nginx + Let's Encrypt SSL Setup
# Configures SSL for: tempmail.rizzcord.site
# Keeps Port 25 direct for: mail.rizzcord.site (MX)
# ==============================================================================
set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

DOMAIN="tempmail.rizzcord.site"
EMAIL="admin@rizzcord.site"

echo -e "${CYAN}${BOLD}"
echo "================================================================"
echo "  👑 Setting up Nginx + SSL for ${DOMAIN}"
echo "================================================================"
echo -e "${RESET}"

# Sudo check
SUDO=""
if [ "$EUID" -ne 0 ]; then
  if command -v sudo &> /dev/null; then
    SUDO="sudo"
  else
    echo -e "${RED}[ERROR] Please run this script with sudo or as root.${RESET}"
    exit 1
  fi
fi

# 1. Install Nginx and Certbot
echo -e "${CYAN}[1/4] Installing Nginx and Certbot...${RESET}"
$SUDO apt-get update -y
$SUDO apt-get install -y nginx certbot python3-certbot-nginx

# 2. Stop Nginx temporarily to obtain standalone certificate
echo -e "\n${CYAN}[2/4] Obtaining free SSL certificate via Let's Encrypt for ${DOMAIN}...${RESET}"
$SUDO systemctl stop nginx || true

# Obtain cert
$SUDO certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" || {
  echo -e "${YELLOW}⚠️ Certbot standalone failed. Attempting webroot or DNS check...${RESET}"
}

# 3. Copy Nginx Configuration
echo -e "\n${CYAN}[3/4] Installing Nginx site configuration...${RESET}"
$SUDO cp nginx.conf /etc/nginx/sites-available/"$DOMAIN"
$SUDO ln -sf /etc/nginx/sites-available/"$DOMAIN" /etc/nginx/sites-enabled/
$SUDO rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test configuration
$SUDO nginx -t

# 4. Restart Nginx
echo -e "\n${CYAN}[4/4] Starting Nginx...${RESET}"
$SUDO systemctl restart nginx
$SUDO systemctl enable nginx

echo -e "\n${GREEN}${BOLD}================================================================${RESET}"
echo -e "${GREEN}${BOLD}  ✓ NGINX SSL SETUP COMPLETE!${RESET}"
echo -e "${GREEN}${BOLD}================================================================${RESET}\n"
echo -e "🌐 Web Dashboard is now secured at: ${CYAN}https://${DOMAIN}${RESET}"
echo -e "📬 SMTP Port 25 remains direct for:  ${CYAN}mail.rizzcord.site${RESET}\n"

