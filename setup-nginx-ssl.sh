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
echo -e "${CYAN}[1/5] Installing Nginx and Certbot...${RESET}"
$SUDO apt-get update -y
$SUDO apt-get install -y nginx certbot python3-certbot-nginx psmisc

# 2. Release port 80 & 443 completely so Certbot standalone can bind cleanly
echo -e "\n${CYAN}[2/5] Freeing Port 80 and Port 443 for Certbot verification...${RESET}"

# Remove any previously broken symlink from sites-enabled that causes nginx -t to fail
$SUDO rm -f /etc/nginx/sites-enabled/"$DOMAIN" 2>/dev/null || true

# Stop host web services
$SUDO systemctl stop nginx 2>/dev/null || true
$SUDO systemctl stop apache2 2>/dev/null || true
$SUDO systemctl stop caddy 2>/dev/null || true
$SUDO systemctl stop lighttpd 2>/dev/null || true

# Stop Docker containers temporarily so port 80 is 100% free
if command -v docker &> /dev/null; then
  echo "Temporarily stopping Docker containers..."
  $SUDO docker compose down 2>/dev/null || $SUDO docker compose stop 2>/dev/null || true
  $SUDO docker stop forsaken_mail 2>/dev/null || true
fi

# Force kill any remaining process holding port 80 or 443
if command -v fuser &> /dev/null; then
  $SUDO fuser -k 80/tcp 2>/dev/null || true
  $SUDO fuser -k 443/tcp 2>/dev/null || true
fi

# Wait for kernel sockets to close
sleep 2

# 3. Obtain SSL Certificate from Let's Encrypt
echo -e "\n${CYAN}[3/5] Requesting SSL certificate from Let's Encrypt for ${DOMAIN}...${RESET}"
$SUDO certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --preferred-challenges http || true

# Check if the SSL certificate was successfully generated
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo -e "\n${RED}[ERROR] Let's Encrypt certificate was NOT generated!${RESET}"
  echo -e "${YELLOW}Reason: Port 80 verification failed or DNS A record is not pointing directly to this VPS IP.${RESET}"
  echo -e "${YELLOW}Please verify in Cloudflare DNS for rizzcord.site:${RESET}"
  echo -e "  1. A record: Name=${BOLD}tempmail${RESET}, Value=${BOLD}<Your VPS IP>${RESET}"
  echo -e "  2. Proxy status is set to ${BOLD}DNS ONLY (Grey Cloud)${RESET} while generating Let's Encrypt SSL."
  echo -e "  3. Once DNS is verified, re-run: ${BOLD}bash setup-nginx-ssl.sh${RESET}\n"
  
  # Restart docker so the user still has service running
  $SUDO docker compose up -d 2>/dev/null || true
  exit 1
fi

# 4. Install and enable Nginx Site Configuration
echo -e "\n${CYAN}[4/5] Installing Nginx reverse proxy configuration...${RESET}"
$SUDO cp nginx.conf /etc/nginx/sites-available/"$DOMAIN"
$SUDO ln -sf /etc/nginx/sites-available/"$DOMAIN" /etc/nginx/sites-enabled/
$SUDO rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test configuration
$SUDO nginx -t

# Start Nginx
$SUDO systemctl restart nginx
$SUDO systemctl enable nginx

# 5. Launch Docker Container (running on port 3000 behind Nginx, and port 25 for SMTP)
echo -e "\n${CYAN}[5/5] Starting Crown Mail Vault Docker container...${RESET}"
if command -v docker &> /dev/null; then
  $SUDO docker compose up -d --build
fi

echo -e "\n${GREEN}${BOLD}================================================================${RESET}"
echo -e "${GREEN}${BOLD}  ✓ NGINX SSL SETUP COMPLETE!${RESET}"
echo -e "${GREEN}${BOLD}================================================================${RESET}\n"
echo -e "🌐 Web Dashboard is now LIVE & SECURE at: ${CYAN}https://${DOMAIN}${RESET}"
echo -e "📬 SMTP Port 25 remains direct for:       ${CYAN}mail.rizzcord.site${RESET}\n"
