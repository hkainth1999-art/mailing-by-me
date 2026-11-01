# 👑 Crown Mail Vault — Private Port 25 Disposable Email & Cold Preservation Platform

> High-speed, self-hosted disposable mail platform built with **Direct Port 25 SMTP**, **Dark Neomorphism & Claymorphism UI with Custom Icons**, **Zero-Deletion 24h Cold Preservation Vault**, **Discord Authentication System**, **Owner ID Restricted Admin Dashboard**, **Dynamic Multi-Domain Manager**, and **Anti-Leak IP Shielding**.

---

## ✨ Upgraded Features

- ⚡ **Direct Port 25 Inbound SMTP:** Sub-second external email delivery (from Gmail, Discord, Twitter/X, Outlook, Steam, etc.) directly to your server.
- 🎨 **Dark Neomorphism & Claymorphism:** Tactile 3D pillowy clay cards, sunken concave insets, extruded buttons with smooth micro-squish tactile states, and cohesive custom hand-crafted SVG icons.
- ❄️ **Zero Deletions & 24h Cold Preservation:**
  - **No emails are ever deleted!** No expiration.
  - After 24 hours, inboxes transition to a **Preserved (Cold Storage)** state where text, HTML, and raw MIME are compressed using `zlib` to save disk space.
  - When any user pastes or searches that mailbox, all emails are decompressed and restored immediately with a **"Preserved Cold Vault Active"** badge!
- 🔒 **Discord Authentication Required to Create Mail:**
  - Users must authenticate with Discord before generating mailboxes.
  - Protects server resources from bot abuse while enabling users to view their saved mailboxes.
  - Anyone can still paste an existing address into the omnibar to check their emails.
- 🛡️ **Fully Secured Owner ID Admin Dashboard:**
  - Admin access is restricted to Discord User IDs matching `OWNER_IDS` in `.env`.
  - **Zero Credential Leaks:** No passwords or secrets are stored in Chrome Web Data (LocalStorage) or exposed in HTML/DOM.
  - Authenticated via cryptographically signed `HttpOnly, SameSite=Strict` cookies.
- 🌐 **Dynamic Multi-Domain Support:**
  - Add, remove, and set default domains directly inside the Admin Dashboard.
  - Newly added domains are instantly accepted by the Port 25 SMTP engine and available in the frontend selector without server restart!
- 🛡️ **Anti-Leak & IP Shielding:**
  - All internal server and relay IP addresses in email headers and logs are masked (`[shielded-relay.vault]`).
  - No server or client IP is exposed in Chrome web data, API responses, or health checks.
- 🔤 **Proper Alphabet Mailbox Names (No "Cyber" Prefix):**
  - Generates sleek, natural phonetic names inspired by `crwnmail`, `vortex`, `phantom`, `zenith`, `kronos`, `apex`, `crown`, etc.
  - NO ugly `cyber-` prefix added to generated email usernames!
- 🎮 **Instant Discord OTP Extraction:**
  - Automatically extracts 6-digit verification codes and activation links with 1-click copy.

---

## ⚙️ Environment Configuration (`.env`)

```ini
# Initial comma-separated list of inbound domains (manage more in Admin Dashboard)
DOMAINS=crwnmail.com,mail.crwnmail.com,rizzcord.site

# Web UI & REST API Port
PORT=3000

# Inbound SMTP Server Port (Port 25)
SMTP_PORT=25

# Data directory for SQLite persistent storage
DATA_DIR=./data

# ==============================================================================
# 🔒 Discord Authentication & Owner Access Control
# ==============================================================================

# Comma-separated Discord User IDs granted Owner / Admin Panel access
# (Enable Developer Mode in Discord, right-click profile -> "Copy User ID")
OWNER_IDS=123456789012345678,987654321098765432

# Discord OAuth2 Application Credentials (https://discord.com/developers/applications)
# Set redirect URI to: http://your-domain.com/api/auth/discord/callback
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=

# Server cryptographic secret for signing sessions (auto-generated if left blank)
ADMIN_SECRET=
```

---

## 🌐 Required DNS Records (Cloudflare or DNS Provider)

Under your domain (e.g. `crwnmail.com`):

| Type | Name | Content / Target | Proxy Status | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `mail` | `YOUR_VPS_IP` | **DNS Only (Grey Cloud)** ⚠️ | - |
| **MX** | `@` | `mail.crwnmail.com` | - | `10` |

> [!WARNING]
> The `mail` A Record MUST be **DNS Only (Grey Cloud)**. Cloudflare proxying blocks incoming Port 25 SMTP traffic.

---

## 📖 REST API Reference

### 1. Inboxes & Messages

- **Get Messages in Inbox (Decompresses preserved mail on-the-fly):**
  ```bash
  curl "http://YOUR_SERVER/api/messages/crwnmail24@crwnmail.com"
  ```

- **Get Discord OTP Verification Code (supports ?wait=true):**
  ```bash
  curl "http://YOUR_SERVER/api/discord/crwnmail24@crwnmail.com?wait=true&timeout=30"
  ```

- **Download Email as `.eml`:**
  ```bash
  curl -O "http://YOUR_SERVER/api/messages/crwnmail24@crwnmail.com/<MSG_ID>/download"
  ```

### 2. Admin & Domain Management (Owner Restricted)

- **List All Domains:**
  ```bash
  curl "http://YOUR_SERVER/api/admin/domains"
  ```

- **Add New Inbound Domain:**
  ```bash
  curl -X POST "http://YOUR_SERVER/api/admin/domains" \
    -H "Content-Type: application/json" \
    -d '{"domain": "anotherdomain.com", "isDefault": false}'
  ```

- **Delete Domain:**
  ```bash
  curl -X DELETE "http://YOUR_SERVER/api/admin/domains/anotherdomain.com"
  ```

- **Trigger Immediate Cold Preservation Pass:**
  ```bash
  curl -X POST "http://YOUR_SERVER/api/admin/preserve-now"
  ```
