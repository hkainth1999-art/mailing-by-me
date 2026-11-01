# ⚡ CyberTemp — Minimalist Port 25 Disposable Email Platform

> High-speed, self-hosted disposable mail platform built with **Direct Port 25 SMTP**, **Dark Neomorphic UI**, **10-Day SQLite Vault Conservation**, **Admin-only API Key Vault**, and **Interactive API Checker**.

---

## ✨ Features

- ⚡ **Direct Port 25 Inbound SMTP:** Sub-second external email delivery (from Gmail, Discord, Twitter, Outlook) directly to your VPS. No Cloudflare worker delays or dropped webhooks.
- 📋 **Paste & Open Any Inbox:** Paste any existing email or username to instantly open that mailbox and view its messages.
- 🔒 **10-Day Conservation Vault:** Emails are stored in high-performance embedded SQLite in WAL mode and preserved for **10 days (240 hours)**.
- 🛡️ **Admin Portal & API Key Vault:** Only authenticated admins (with password `cyberadmin2026`) can generate and revoke programmatic API keys (`ct_live_...`).
- 🔌 **Interactive API Checker:** Test API keys, fetch inbox messages, test Discord OTP extraction, and copy generated cURL commands right in your browser.
- 🎮 **Instant Discord OTP Extraction:** Auto-extracts 6-digit verification codes and activation links with a 1-click "Copy Code" button.
- 🎨 **Minimalist Cyber Neomorphism:** Modern dark UI with extruded tactile plates, soft inset inputs, real-time WebSocket connection, and audio alerts.

---

## 🚀 Quick Setup on VPS

```bash
git clone https://github.com/obsidian-ontop/temp-mail-own.git
cd temp-mail-own
bash deploy.sh
```

---

## 🌐 Required DNS Records (Cloudflare)

Under your domain (e.g. `rizzcord.site`) in Cloudflare:

| Type | Name | Content / Target | Proxy Status | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `mail` | `YOUR_VPS_IP` | **DNS Only (Grey Cloud)** ⚠️ | - |
| **MX** | `@` | `mail.rizzcord.site` | - | `10` |

> [!WARNING]
> Ensure the `mail` A Record is **DNS Only (Grey Cloud)**. Cloudflare's orange cloud blocks incoming Port 25 SMTP traffic.

---

## 📖 REST API Reference

### 1. Inboxes & Messages

- **Get Messages in Inbox:**
  ```bash
  curl "http://YOUR_VPS_IP/api/messages/cfjf7byh@rizzcord.site"
  ```

- **Get Discord Verification Code (Wait up to 30s):**
  ```bash
  curl "http://YOUR_VPS_IP/api/discord/cfjf7byh@rizzcord.site?wait=true&timeout=30"
  ```

- **Download Email as `.eml`:**
  ```bash
  curl -O "http://YOUR_VPS_IP/api/messages/cfjf7byh@rizzcord.site/<MSG_ID>/download"
  ```

- **Register / Create Mailbox:**
  ```bash
  curl -X POST "http://YOUR_VPS_IP/api/inbox/create" \
    -H "Content-Type: application/json" \
    -d '{"address": "myinbox@rizzcord.site"}'
  ```

### 2. Admin & API Keys

- **Admin Login:**
  ```bash
  curl -X POST "http://YOUR_VPS_IP/api/admin/login" \
    -H "Content-Type: application/json" \
    -d '{"password": "cyberadmin2026"}'
  ```

- **Generate API Key (Admin Only):**
  ```bash
  curl -X POST "http://YOUR_VPS_IP/api/admin/keys" \
    -H "Authorization: Bearer <ADMIN_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"name": "Discord Bot Runner", "permissions": "full"}'
  ```

- **Verify API Key (API Checker):**
  ```bash
  curl -X POST "http://YOUR_VPS_IP/api/admin/check-key" \
    -H "Content-Type: application/json" \
    -d '{"apiKey": "ct_live_..."}'
  ```

---

## 🛠️ Management Commands

```bash
# View live email stream
docker compose logs -f

# Restart container
docker compose restart

# Stop service
docker compose down
```
