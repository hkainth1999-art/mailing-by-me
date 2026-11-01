# ⚡ Forsaken Mail (Modified) — Direct Port 25 Inbound Mail Server

A modernized, high-performance, self-hosted disposable temporary email server inspired by **Forsaken Mail**, completely upgraded for modern Node.js, multi-domain support, embedded SQLite persistence, and built-in Discord OTP verification extraction.

Unlike Cloudflare Email Workers or webhooks that introduce queue delays or drops, this runs a **direct inbound SMTP server on Port 25**. Incoming emails from Gmail, Discord, Outlook, etc. arrive directly on your server in **under 1 second**!

---

## 🌟 Key Features & Improvements

- **⚡ Instant Sub-Second Delivery:** Receives raw email directly on SMTP Port 25. No webhooks, no third-party queues, no dropped emails.
- **🛡️ Modern Node.js Engine:** Built on modern Node.js & `smtp-server` (resolves the legacy Forsaken Mail `TypeError: Cannot set property closed of #<Writable>` stream crash).
- **🎮 Dedicated Discord OTP Extractor:** Automatically parses incoming Discord verification emails, detects 6-digit codes and verification links, and displays a 1-click **"Copy Code"** banner in the UI and via API.
- **🌐 Multi-Domain Support:** Accept emails on multiple domains (`DOMAINS=rizzcord.site,mail.rizzcord.site`).
- **💾 Embedded SQLite Storage:** Zero-config persistent database (`node:sqlite`). Emails survive server restarts and browser refreshes.
- **🔄 Real-Time WebSockets:** Instantly pushes new messages to the browser without page reloads.
- **📦 Single Lightweight Container:** Entire service runs in one container consuming under 50 MB of RAM.

---

## 📋 Required DNS Configuration (Cloudflare)

To receive real emails from external senders on your domain (`rizzcord.site`), configure these 2 records in your Cloudflare DNS:

| Type | Name | Content / Target | Priority | Proxy Status |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `mail` | `20.216.3.41` | — | **DNS Only (Grey Cloud)** ⚠️ |
| **MX** | `@` | `mail.rizzcord.site` | `10` | — |

> ⚠️ **CRITICAL NOTE ON CLOUDFLARE PROXY:**  
> Cloudflare's Orange Cloud (Proxy) only works for HTTP/HTTPS web traffic. It **blocks port 25 SMTP**. Therefore, your `mail.rizzcord.site` A record **MUST be Grey Cloud (DNS Only)** so that mail servers (like Gmail) can connect to Port 25 directly!  
> Also, if you enabled **Cloudflare Email Routing**, disable it or set the MX records to point to your `mail.rizzcord.site` instead of Cloudflare.

---

## 🚀 One-Command VPS Deployment

In your VPS terminal:

```bash
git clone https://github.com/obsidian-ontop/temp-mail-own.git
cd temp-mail-own
bash deploy.sh
```

*(Or if already cloned, just run `git pull && bash deploy.sh`)*

### What `deploy.sh` does:
1. Stops any conflicting containers.
2. Stops host `postfix` or `sendmail` if Ubuntu installed them, ensuring Port 25 is 100% free.
3. Configures `.env` with your domain.
4. Builds and starts the container in the background.
5. Prints your Web Dashboard URL (`http://20.216.3.41`).

---

## 🤖 REST API for Bots & Automation

### 1. Fetch Inbound Emails
```bash
GET /api/messages/:address
```
**Example:**
```bash
curl http://20.216.3.41/api/messages/cfjf7byh@rizzcord.site
```

### 2. Discord Verification Code Extractor (with long-poll wait)
```bash
GET /api/discord/:address?wait=true&timeout=30
```
**Example Response:**
```json
{
  "found": true,
  "discord_code": "489201",
  "discord_url": "https://click.discord.com/ls/click?upn=...",
  "subject": "Your Discord verification code is 489201",
  "from_address": "noreply@discord.com",
  "received_at": 1793512345000
}
```

### 3. Clear Mailbox
```bash
DELETE /api/inbox/:address
```

---

## 🛑 Uninstallation

```bash
bash uninstall.sh
```
To also purge stored messages:
```bash
bash uninstall.sh --purge-data
```
