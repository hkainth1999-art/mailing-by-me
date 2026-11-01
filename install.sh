#!/usr/bin/env bash
# ==============================================================================
# 👑 CROWN MAIL VAULT — ALL-IN-ONE MANAGEMENT & INSTALLATION CLI
# Supports: Full Install (Web + SMTP Port 25 + SSL + DNS), Restart, Logs, SSL Renew, Uninstall
# ==============================================================================

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
PURPLE="\033[0;35m"
RESET="\033[0m"

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

print_banner() {
  clear
  echo -e "${CYAN}${BOLD}"
  echo "   ______                               __  ___      _ __   _    __            ____  "
  echo "  / ____/________ _      ______        /  |/  /___ _(_) /  | |  / /___ ___  __/ / /_ "
  echo " / /   / ___/ __ \ | /| / / __ \      / /|_/ / __ \`/ / /   | | / / __ \`/ / / / / __/ "
  echo "/ /___/ /  / /_/ / |/ |/ / / / /     / /  / / /_/ / / /    | |/ / /_/ / /_/ / / /_   "
  echo "\____/_/   \____/|__/|__/_/ /_/     /_/  /_/\__,_/_/_/     |___/\__,_/\__,_/_/\__/   "
  echo -e "${RESET}"
  echo -e "   ${BOLD}Zero-Middleman Private Port 25 SMTP Gateway & 24h Cold Vault${RESET}"
  echo -e "   ${PURPLE}Web Dashboard + Let's Encrypt SSL + Multi-Domain + Discord Owner Security${RESET}"
  echo -e "================================================================================"
}

print_menu() {
  print_banner
  echo -e "\n${BOLD}Select an action:${RESET}\n"
  echo -e "  ${GREEN}[1]${RESET} 🚀 ${BOLD}Full Install & Setup${RESET} (Web Server + Port 25 SMTP + SSL + DNS Setup)"
  echo -e "  ${CYAN}[2]${RESET} 🔄 ${BOLD}Restart / Reload Services${RESET} (Docker Containers & Nginx)"
  echo -e "  ${PURPLE}[3]${RESET} 📊 ${BOLD}View Status & Live Email Logs${RESET} (Inbound SMTP stream)"
  echo -e "  ${YELLOW}[4]${RESET} 🔐 ${BOLD}Renew SSL Certificate${RESET} (Let's Encrypt)"
  echo -e "  ${RED}[5]${RESET} 🗑️  ${BOLD}Uninstall Mail Server${RESET} (Remove containers & Nginx proxy)"
  echo -e "  ${RESET}[6]${RESET} ❌ ${BOLD}Exit${RESET}\n"
  echo -ne "${BOLD}Enter choice [1-6]: ${RESET}"
}

# ==============================================================================
# ACTION 1: FULL INSTALLATION & SETUP
# ==============================================================================
action_install() {
  print_banner
  echo -e "\n${GREEN}${BOLD}=== STEP 1: DOMAIN & ACCESS CONFIGURATION ===${RESET}\n"

  detect_ip
  echo -e "Detected Server Public IP: ${GREEN}${BOLD}${SERVER_IP}${RESET}\n"

  # 1. Prompt Web FQDN
  read -rp "Enter Web Dashboard FQDN [default: tempmail.rizzcord.site]: " INPUT_WEB_FQDN
  WEB_FQDN="${INPUT_WEB_FQDN:-tempmail.rizzcord.site}"

  # 2. Prompt Mail / MX FQDN
  read -rp "Enter Inbound Mail / SMTP FQDN [default: mail.rizzcord.site]: " INPUT_MAIL_FQDN
  MAIL_FQDN="${INPUT_MAIL_FQDN:-mail.rizzcord.site}"

  # Extract base domain (e.g. rizzcord.site from tempmail.rizzcord.site)
  BASE_DOMAIN=$(echo "$WEB_FQDN" | awk -F. '{if (NF>2) {print $(NF-1)"."$NF} else {print $0}}')

  # 3. Prompt Discord Owner ID
  read -rp "Enter Discord Owner User ID [default: 1293104653650755604]: " INPUT_OWNER_ID
  OWNER_ID="${INPUT_OWNER_ID:-1293104653650755604}"

  # 4. Prompt Admin Contact Email
  read -rp "Enter Admin Email for Let's Encrypt [default: admin@${BASE_DOMAIN}]: " INPUT_EMAIL
  ADMIN_EMAIL="${INPUT_EMAIL:-admin@${BASE_DOMAIN}}"

  echo -e "\n${CYAN}Configuration Summary:${RESET}"
  echo -e "  • Web Dashboard URL:   ${BOLD}https://${WEB_FQDN}${RESET}"
  echo -e "  • Inbound Mail (MX):   ${BOLD}${MAIL_FQDN} (Port 25 Direct)${RESET}"
  echo -e "  • Discord Owner ID:    ${BOLD}${OWNER_ID}${RESET}"
  echo -e "  • SSL Contact Email:   ${BOLD}${ADMIN_EMAIL}${RESET}\n"

  read -rp "Proceed with installation? (Y/n): " CONFIRM
  if [[ "$CONFIRM" =~ ^[Nn] ]]; then
    echo "Installation cancelled."
    exit 0
  fi

  echo -e "\n${CYAN}${BOLD}=== STEP 2: INSTALLING SYSTEM DEPENDENCIES ===${RESET}"
  $SUDO apt-get update -y
  $SUDO apt-get install -y curl wget git nginx certbot python3-certbot-nginx psmisc net-tools ca-certificates gnupg lsb-release

  # Check & Install Docker if missing
  if ! command -v docker &> /dev/null; then
    echo "Installing Docker Engine..."
    curl -fsSL https://get.docker.com | $SUDO sh
    $SUDO systemctl enable docker
    $SUDO systemctl start docker
  fi

  # 3. Release Port 25 if Postfix/Sendmail is active on host
  echo -e "\n${CYAN}${BOLD}=== STEP 3: FREEING PORT 25 (SMTP) ON HOST ===${RESET}"
  if command -v systemctl &> /dev/null; then
    $SUDO systemctl stop postfix 2>/dev/null || true
    $SUDO systemctl disable postfix 2>/dev/null || true
    $SUDO systemctl stop sendmail 2>/dev/null || true
    $SUDO systemctl stop exim4 2>/dev/null || true
  fi

  # 4. Generate .env File
  echo -e "\n${CYAN}${BOLD}=== STEP 4: WRITING CONFIGURATION (.env) ===${RESET}"
  cat <<EOF | $SUDO tee .env > /dev/null
# Generated by install.sh on $(date)
DOMAINS=${BASE_DOMAIN},${MAIL_FQDN},${WEB_FQDN},crwnmail.com
PORT=3000
SMTP_PORT=25
DATA_DIR=./data
OWNER_IDS=${OWNER_ID}
DISCORD_CLIENT_ID=1563570688445386772
DISCORD_CLIENT_SECRET=zxm1MeEGPXr8GLakt2XIJiUciA2y_qx0
DISCORD_REDIRECT_URI=https://${WEB_FQDN}/api/auth/discord/callback
FORCE_HTTPS=false
EOF
  echo -e "${GREEN}✓ Updated .env file.${RESET}"

  # 5. Generate Nginx Reverse Proxy Config
  echo -e "\n${CYAN}${BOLD}=== STEP 5: PREPARING NGINX & SSL ===${RESET}"
  cat <<EOF | $SUDO tee nginx.conf > /dev/null
# ==============================================================================
# 👑 Crown Mail Vault — Nginx Configuration for ${WEB_FQDN}
# ==============================================================================

server {
    listen 80;
    listen [::]:80;
    server_name ${WEB_FQDN} ${MAIL_FQDN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://${WEB_FQDN}\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${WEB_FQDN};

    ssl_certificate /etc/letsencrypt/live/${WEB_FQDN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${WEB_FQDN}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    client_max_body_size 30M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

  # 6. Free Port 80 & 443 completely for Certbot
  echo -e "\n${CYAN}Freeing Port 80 & 443 for Let's Encrypt validation...${RESET}"
  $SUDO rm -f /etc/nginx/sites-enabled/"$WEB_FQDN" 2>/dev/null || true
  $SUDO systemctl stop nginx 2>/dev/null || true
  $SUDO systemctl stop apache2 2>/dev/null || true
  $SUDO systemctl stop caddy 2>/dev/null || true

  if command -v docker &> /dev/null; then
    $SUDO docker compose down 2>/dev/null || true
    $SUDO docker stop forsaken_mail 2>/dev/null || true
  fi

  if command -v fuser &> /dev/null; then
    $SUDO fuser -k 80/tcp 2>/dev/null || true
    $SUDO fuser -k 443/tcp 2>/dev/null || true
  fi

  sleep 2

  # 7. Request SSL Certificate
  echo -e "\n${CYAN}Requesting Let's Encrypt SSL certificate for ${WEB_FQDN}...${RESET}"
  $SUDO certbot certonly --standalone -d "$WEB_FQDN" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --preferred-challenges http || true

  if [ ! -f "/etc/letsencrypt/live/${WEB_FQDN}/fullchain.pem" ]; then
    echo -e "\n${YELLOW}[WARNING] Let's Encrypt standalone verification did not complete.${RESET}"
    echo -e "${YELLOW}This usually happens if DNS A record for ${WEB_FQDN} does not point to ${SERVER_IP} yet, or Cloudflare Proxy (Orange Cloud) is ON.${RESET}"
    echo -e "Temporary self-signed certificate will be created so Nginx can start safely.\n"
    
    $SUDO mkdir -p /etc/letsencrypt/live/"${WEB_FQDN}"
    $SUDO openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/letsencrypt/live/"${WEB_FQDN}"/privkey.pem \
      -out /etc/letsencrypt/live/"${WEB_FQDN}"/fullchain.pem \
      -subj "/CN=${WEB_FQDN}" 2>/dev/null || true
  fi

  # 8. Link & Enable Nginx Config
  echo -e "\n${CYAN}Enabling Nginx reverse proxy...${RESET}"
  $SUDO cp nginx.conf /etc/nginx/sites-available/"${WEB_FQDN}"
  $SUDO ln -sf /etc/nginx/sites-available/"${WEB_FQDN}" /etc/nginx/sites-enabled/
  $SUDO rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

  $SUDO nginx -t
  $SUDO systemctl restart nginx
  $SUDO systemctl enable nginx

  # 9. Launch Docker Container
  echo -e "\n${CYAN}${BOLD}=== STEP 6: LAUNCHING CROWN MAIL VAULT (DOCKER) ===${RESET}"
  $SUDO mkdir -p data/certs
  $SUDO docker compose up -d --build

  sleep 3

  # ============================================================================
  # STEP 7: COMPREHENSIVE DNS INSTRUCTIONS
  # ============================================================================
  print_banner
  echo -e "\n${GREEN}${BOLD}================================================================================${RESET}"
  echo -e "${GREEN}${BOLD}  👑 CROWN MAIL VAULT INSTALLED & LIVE!${RESET}"
  echo -e "${GREEN}${BOLD}================================================================================${RESET}\n"

  echo -e "  🌐 ${BOLD}Web Dashboard (HTTPS):${RESET}  ${CYAN}https://${WEB_FQDN}${RESET}"
  echo -e "  📬 ${BOLD}Inbound SMTP Gateway:${RESET}   ${CYAN}${MAIL_FQDN} (Port 25 Inbound Active)${RESET}"
  echo -e "  👑 ${BOLD}Admin / Owner ID:${RESET}       ${PURPLE}${OWNER_ID}${RESET}"
  echo -e "  💻 ${BOLD}Server Public IP:${RESET}       ${BOLD}${SERVER_IP}${RESET}\n"

  echo -e "${YELLOW}${BOLD}================================================================================${RESET}"
  echo -e "${YELLOW}${BOLD}  📋 CRITICAL: ADD THESE DNS RECORDS TO MAKE MAIL & WEB WORK!${RESET}"
  echo -e "${YELLOW}${BOLD}================================================================================${RESET}\n"

  echo -e "In your DNS Manager (Cloudflare, Namecheap, GoDaddy, Porkbun):\n"

  echo -e "${BOLD}1. WEB DASHBOARD RECORD (Web UI):${RESET}"
  echo -e "   • Type:     ${GREEN}A${RESET}"
  echo -e "   • Name:     ${CYAN}$(echo "$WEB_FQDN" | awk -F. '{print $1}')${RESET}  (or ${CYAN}${WEB_FQDN}${RESET})"
  echo -e "   • Content:  ${BOLD}${SERVER_IP}${RESET}"
  echo -e "   • Proxy:    ${YELLOW}DNS Only (Grey Cloud)${RESET} during SSL generation, or Proxied (Orange Cloud) after.\n"

  echo -e "${BOLD}2. MAIL INBOUND RECORD (Port 25 SMTP Gateway):${RESET}"
  echo -e "   • Type:     ${GREEN}A${RESET}"
  echo -e "   • Name:     ${CYAN}$(echo "$MAIL_FQDN" | awk -F. '{print $1}')${RESET}  (or ${CYAN}${MAIL_FQDN}${RESET})"
  echo -e "   • Content:  ${BOLD}${SERVER_IP}${RESET}"
  echo -e "   • Proxy:    ${RED}${BOLD}DNS ONLY (Grey Cloud) — CRITICAL! Never proxy MX through Cloudflare!${RESET}\n"

  echo -e "${BOLD}3. MX RECORD (Tells the internet where to deliver incoming emails):${RESET}"
  echo -e "   • Type:     ${GREEN}MX${RESET}"
  echo -e "   • Name:     ${CYAN}@${RESET}  (Root domain: ${BASE_DOMAIN})"
  echo -e "   • Server:   ${CYAN}${MAIL_FQDN}${RESET}"
  echo -e "   • Priority: ${BOLD}10${RESET}\n"

  echo -e "${BOLD}4. SPF / TXT RECORD (Validates mail delivery authenticity):${RESET}"
  echo -e "   • Type:     ${GREEN}TXT${RESET}"
  echo -e "   • Name:     ${CYAN}@${RESET}"
  echo -e "   • Content:  ${CYAN}v=spf1 mx ~all${RESET}\n"

  echo -e "${PURPLE}${BOLD}================================================================================${RESET}"
  echo -e "${PURPLE}${BOLD}  🔒 DISCORD DEVELOPER PORTAL SETUP${RESET}"
  echo -e "${PURPLE}${BOLD}================================================================================${RESET}\n"
  echo -e "  Go to: ${CYAN}https://discord.com/developers/applications${RESET}"
  echo -e "  Select your Application -> OAuth2 -> Redirects -> Click 'Add Redirect':"
  echo -e "  Paste exact URL: ${GREEN}https://${WEB_FQDN}/api/auth/discord/callback${RESET}"
  echo -e "  Click ${BOLD}'Save Changes'${RESET}.\n"

  echo -e "${GREEN}Installation finished successfully!${RESET}\n"
}

# ==============================================================================
# ACTION 2: RESTART SERVICES
# ==============================================================================
action_restart() {
  print_banner
  echo -e "\n${CYAN}Restarting Crown Mail Vault Docker container and Nginx...${RESET}\n"
  $SUDO docker compose restart
  $SUDO systemctl restart nginx
  echo -e "\n${GREEN}✓ All services restarted successfully.${RESET}\n"
}

# ==============================================================================
# ACTION 3: STATUS & LIVE LOGS
# ==============================================================================
action_status() {
  print_banner
  echo -e "\n${CYAN}${BOLD}=== CONTAINER & PORT STATUS ===${RESET}\n"
  $SUDO docker compose ps
  echo -e "\n${BOLD}Listening Ports Check:${RESET}"
  if command -v ss &> /dev/null; then
    $SUDO ss -tulpn | grep -E ':25|:80|:443|:3000' || echo "Checking with netstat..."
  fi

  echo -e "\n${CYAN}${BOLD}=== STREAMING INBOUND SMTP & WEB LOGS (Ctrl+C to stop) ===${RESET}\n"
  $SUDO docker compose logs -f
}

# ==============================================================================
# ACTION 4: RENEW SSL CERTIFICATE
# ==============================================================================
action_renew_ssl() {
  print_banner
  echo -e "\n${CYAN}${BOLD}=== RENEWING LET'S ENCRYPT CERTIFICATE ===${RESET}\n"
  $SUDO systemctl stop nginx
  $SUDO certbot renew --standalone
  $SUDO systemctl start nginx
  echo -e "\n${GREEN}✓ SSL Renewal complete! Nginx reloaded.${RESET}\n"
}

# ==============================================================================
# ACTION 5: UNINSTALL
# ==============================================================================
action_uninstall() {
  print_banner
  echo -e "\n${RED}${BOLD}================================================================${RESET}"
  echo -e "${RED}${BOLD}  ⚠️  UNINSTALL CROWN MAIL VAULT${RESET}"
  echo -e "${RED}${BOLD}================================================================${RESET}\n"
  echo "This will stop and remove Docker containers and Nginx proxy configs."
  read -rp "Are you sure you want to proceed? (y/N): " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy] ]]; then
    echo "Uninstall aborted."
    return
  fi

  echo -e "\nStopping and removing Docker containers..."
  $SUDO docker compose down -v 2>/dev/null || true
  $SUDO docker stop forsaken_mail 2>/dev/null || true
  $SUDO docker rm -f forsaken_mail 2>/dev/null || true

  echo "Removing Nginx site configs..."
  $SUDO rm -f /etc/nginx/sites-enabled/tempmail* 2>/dev/null || true
  $SUDO rm -f /etc/nginx/sites-available/tempmail* 2>/dev/null || true
  $SUDO nginx -t 2>/dev/null && $SUDO systemctl restart nginx 2>/dev/null || true

  read -rp "Do you also want to permanently delete all saved email vault data (./data)? (y/N): " PURGE_DATA
  if [[ "$PURGE_DATA" =~ ^[Yy] ]]; then
    $SUDO rm -rf data
    echo -e "${YELLOW}✓ Email database and storage deleted.${RESET}"
  fi

  echo -e "\n${GREEN}✓ Crown Mail Vault has been uninstalled.${RESET}\n"
}

# ==============================================================================
# MAIN ROUTINE
# ==============================================================================
if [ -n "$1" ]; then
  case "$1" in
    install|setup) action_install ;;
    restart)       action_restart ;;
    status|logs)   action_status ;;
    renew|ssl)     action_renew_ssl ;;
    uninstall)     action_uninstall ;;
    *) echo "Usage: $0 {install|restart|status|renew|uninstall}" ;;
  esac
  exit 0
fi

while true; do
  print_menu
  read -r CHOICE
  case "$CHOICE" in
    1) action_install; break ;;
    2) action_restart; break ;;
    3) action_status; break ;;
    4) action_renew_ssl; break ;;
    5) action_uninstall; break ;;
    6|q|Q) echo -e "\nGoodbye!\n"; exit 0 ;;
    *) echo -e "${RED}Invalid choice. Please choose 1-6.${RESET}"; sleep 1 ;;
  esac
done
