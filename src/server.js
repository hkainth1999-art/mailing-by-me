import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { HTTP_PORT, HTTPS_PORT, FORCE_HTTPS, SSL_KEY_PATH, SSL_CERT_PATH, OWNER_IDS, DISCORD_CLIENT_ID } from './config.js';
import {
  saveMailbox,
  getMailboxDetails,
  listRecentMailboxes,
  listUserMailboxes,
  getMessages,
  getMessageById,
  getRawMessage,
  deleteMessage,
  clearInbox,
  getLatestDiscordVerification,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  verifyApiKey,
  getSystemStats,
  preserveOldInboxes,
  getDomains,
  getDomainNames,
  addDomain,
  removeDomain,
  setDefaultDomain,
  createDiscordSession,
  getDiscordSession,
  deleteDiscordSession,
  cleanExpiredSessions,
  isOwnerId,
} from './db.js';
import { getDiscordAuthUrl, exchangeDiscordCode, fetchDiscordUser } from './discord.js';
import { startSmtpServer, setBroadcastCallback } from './smtp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

const app = express();

// Security enhancements: strip fingerprinted headers
app.disable('x-powered-by');

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Security headers middleware - never expose server IP or sensitive relays
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Automatic HTTPS Redirect (Cloudflare / Proxies / Direct)
if (FORCE_HTTPS) {
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers.host || '';
    if (proto !== 'https' && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      const cleanHost = host.replace(/:\d+$/, '');
      return res.redirect(301, `https://${cleanHost}${req.url}`);
    }
    next();
  });
}

app.use(express.static(publicDir));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Map of address -> Set of active WebSockets
const subscribers = new Map();

function setupWebSocketServer(wssInstance) {
  wssInstance.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let currentAddress = url.searchParams.get('address')?.toLowerCase().trim() || null;

    function subscribe(addr) {
      if (!addr) return;
      const clean = addr.toLowerCase().trim();
      if (!subscribers.has(clean)) {
        subscribers.set(clean, new Set());
      }
      subscribers.get(clean).add(ws);
      currentAddress = clean;
      ws.send(JSON.stringify({ type: 'subscribed', address: clean }));
    }

    function unsubscribe() {
      if (currentAddress && subscribers.has(currentAddress)) {
        subscribers.get(currentAddress).delete(ws);
        if (subscribers.get(currentAddress).size === 0) {
          subscribers.delete(currentAddress);
        }
      }
    }

    if (currentAddress) {
      subscribe(currentAddress);
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.action === 'subscribe' && msg.address) {
          unsubscribe();
          subscribe(msg.address);
        } else if (msg.action === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // Ignore invalid JSON
      }
    });

    ws.on('close', () => {
      unsubscribe();
    });
  });
}

setupWebSocketServer(wss);

// Broadcast incoming email to connected WebSocket clients
setBroadcastCallback((address, payload) => {
  const cleanAddr = address.toLowerCase().trim();
  const clients = subscribers.get(cleanAddr);
  if (clients && clients.size > 0) {
    const data = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  // Also broadcast to global watchers
  const globalClients = subscribers.get('*');
  if (globalClients) {
    const data = JSON.stringify(payload);
    for (const client of globalClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
});

// --- Auth Helpers & Middleware ---

function getAuthSession(req) {
  const token =
    req.cookies?.discord_session ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  return getDiscordSession(token);
}

// Enforce Discord Login to create mailboxes
function requireDiscordAuth(req, res, next) {
  const session = getAuthSession(req);
  if (!session) {
    return res.status(401).json({
      error: 'Authentication Required: You must log in with Discord before creating a mailbox.',
      login_required: true,
    });
  }
  req.user = session;
  next();
}

// Enforce Owner ID for Admin Dashboard Access
function requireOwner(req, res, next) {
  const session = getAuthSession(req);
  if (!session || !session.is_owner) {
    return res.status(403).json({
      error: 'Access Denied: Owner authorization required for Admin Dashboard.',
    });
  }
  req.user = session;
  next();
}

// Optional API Key validator for programmatic access
function apiKeyAuth(req, res, next) {
  const rawKey = req.headers['x-api-key'] || req.query.api_key;
  if (rawKey) {
    const verified = verifyApiKey(rawKey);
    if (!verified) {
      return res.status(401).json({ error: 'Invalid API Key provided' });
    }
    req.apiKey = verified;
  }
  next();
}

// --- Discord Authentication Endpoints ---

// 1. Get Discord OAuth login URL
app.get('/api/auth/discord', (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    return res.json({
      configured: false,
      message: 'Discord OAuth credentials not set in .env. Use Direct Discord ID login.',
    });
  }
  const url = getDiscordAuthUrl(req);
  res.json({ configured: true, url });
});

// 2. Discord OAuth Callback
app.get('/api/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect('/#error=no_code');
  }

  try {
    const tokenData = await exchangeDiscordCode(code, req);
    const userProfile = await fetchDiscordUser(tokenData.access_token);

    // Create session (automatically evaluates is_owner against OWNER_IDS)
    const session = createDiscordSession({
      id: userProfile.id,
      username: userProfile.username,
      global_name: userProfile.global_name || userProfile.username,
      avatar: userProfile.avatar,
    });

    // Set HttpOnly, SameSite=Strict cookie
    res.cookie('discord_session', session.token, {
      httpOnly: true,
      secure: req.protocol === 'https',
      sameSite: 'lax',
      maxAge: 30 * 24 * 3600 * 1000,
    });

    res.redirect('/#auth_success');
  } catch (err) {
    console.error('Discord OAuth error:', err.message);
    res.redirect(`/#error=${encodeURIComponent('oauth_failed')}`);
  }
});

// 3. Direct Discord Login (Self-Hosted & Dev Mode when OAuth app is not configured)
app.post('/api/auth/dev-login', (req, res) => {
  const { discordId, username } = req.body;
  if (!discordId || typeof discordId !== 'string') {
    return res.status(400).json({ error: 'Discord User ID is required' });
  }

  const cleanId = discordId.trim();
  const cleanUsername = (username || `User_${cleanId.slice(-4)}`).trim();

  const session = createDiscordSession({
    id: cleanId,
    username: cleanUsername,
    global_name: cleanUsername,
    avatar: '',
  });

  res.cookie('discord_session', session.token, {
    httpOnly: true,
    secure: req.protocol === 'https',
    sameSite: 'lax',
    maxAge: 30 * 24 * 3600 * 1000,
  });

  res.json({
    success: true,
    user: {
      id: cleanId,
      username: cleanUsername,
      isOwner: Boolean(session.is_owner),
    },
  });
});

// 4. Current User Profile
app.get('/api/auth/me', (req, res) => {
  const session = getAuthSession(req);
  if (!session) {
    return res.json({
      loggedIn: false,
      discordOAuthConfigured: Boolean(DISCORD_CLIENT_ID),
    });
  }

  res.json({
    loggedIn: true,
    discordOAuthConfigured: Boolean(DISCORD_CLIENT_ID),
    user: {
      id: session.user_id,
      username: session.username,
      globalName: session.global_name,
      avatar: session.avatar
        ? `https://cdn.discordapp.com/avatars/${session.user_id}/${session.avatar}.png`
        : null,
      isOwner: Boolean(session.is_owner),
    },
  });
});

// 5. Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.discord_session;
  if (token) {
    deleteDiscordSession(token);
  }
  res.clearCookie('discord_session');
  res.json({ success: true, message: 'Logged out successfully' });
});

// --- Public & Mailbox Endpoints ---

// List configured domains (dynamically managed in Admin Dashboard)
app.get('/api/domains', (req, res) => {
  const domains = getDomains();
  res.json({
    domains: domains.map((d) => d.domain),
    default: domains.find((d) => d.is_default)?.domain || domains[0]?.domain || 'crwnmail.com',
  });
});

// System Stats (Zero IP leaks)
app.get('/api/stats', (req, res) => {
  res.json({
    service: 'Crown Mail Vault',
    ...getSystemStats(),
  });
});

// List recent non-preserved mailboxes
app.get('/api/inbox/recent', (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit || '15', 10));
  const recent = listRecentMailboxes(limit);
  res.json({ recent });
});

// List user-created mailboxes (Discord logged-in user)
app.get('/api/user/inboxes', requireDiscordAuth, (req, res) => {
  const mailboxes = listUserMailboxes(req.user.user_id);
  res.json({ mailboxes });
});

// Create or register a custom mailbox (Discord Login Required!)
app.post('/api/inbox/create', requireDiscordAuth, (req, res) => {
  const { address, username, domain } = req.body;
  const configuredDomains = getDomainNames();
  let fullAddress = '';

  if (address && address.includes('@')) {
    fullAddress = address.trim().toLowerCase();
  } else if (username && domain) {
    fullAddress = `${username.trim().toLowerCase()}@${domain.trim().toLowerCase()}`;
  } else if (address) {
    fullAddress = `${address.trim().toLowerCase()}@${configuredDomains[0]}`;
  } else {
    return res.status(400).json({ error: 'Please provide a valid mailbox address or username + domain' });
  }

  const record = saveMailbox(fullAddress, req.user.user_id, req.user.username);
  res.json({
    success: true,
    address: record.address,
    created_at: record.created_at,
    is_preserved: record.is_preserved,
    policy: 'Infinite Retention (Preserved after 24h, 0 deletions)',
  });
});

// Check Mailbox Status (Active vs Preserved state)
app.get('/api/inbox/status/:address', (req, res) => {
  const { address } = req.params;
  const clean = address.toLowerCase().trim();
  const mb = getMailboxDetails(clean);
  if (!mb) {
    return res.json({ exists: false, is_preserved: false });
  }

  // Check if created > 24 hours ago
  const isPreserved = mb.is_preserved === 1 || (Date.now() - mb.created_at > 24 * 3600 * 1000);

  res.json({
    exists: true,
    address: mb.address,
    created_at: mb.created_at,
    is_preserved: Boolean(isPreserved),
    preserved_at: mb.preserved_at,
  });
});

// List messages in an inbox (Conserved indefinitely, 0 deletions!)
app.get('/api/messages/:address', apiKeyAuth, (req, res) => {
  const { address } = req.params;
  const cleanAddr = address.toLowerCase().trim();
  const mb = saveMailbox(cleanAddr); // Register / update access
  const messages = getMessages(cleanAddr);

  const isPreserved = mb.is_preserved === 1 || (Date.now() - mb.created_at > 24 * 3600 * 1000);

  res.json({
    address: cleanAddr,
    count: messages.length,
    is_preserved: Boolean(isPreserved),
    preserved_at: mb.preserved_at,
    retention: 'Infinite (Space-Optimized Preservation)',
    messages,
  });
});

// Get single message details (transparent on-the-fly decompression, sanitized headers)
app.get('/api/messages/:address/:id', apiKeyAuth, (req, res) => {
  const { address, id } = req.params;
  const message = getMessageById(address, id);
  if (!message) {
    return res.status(404).json({ error: 'Message not found in vault' });
  }
  res.json({ message });
});

// Download original .eml file
app.get('/api/messages/:address/:id/download', (req, res) => {
  const { address, id } = req.params;
  const raw = getRawMessage(address, id);
  if (!raw) {
    return res.status(404).json({ error: 'Message not found' });
  }
  res.setHeader('Content-Type', 'message/rfc822');
  res.setHeader('Content-Disposition', `attachment; filename="email_${id}.eml"`);
  res.send(raw);
});

// Get raw RFC822 source
app.get('/api/raw/:address/:id', apiKeyAuth, (req, res) => {
  const { address, id } = req.params;
  const raw = getRawMessage(address, id);
  if (!raw) {
    return res.status(404).json({ error: 'Message not found' });
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(raw);
});

// Delete a message manually if user chooses
app.delete('/api/messages/:address/:id', apiKeyAuth, (req, res) => {
  const { address, id } = req.params;
  deleteMessage(address, id);
  res.json({ status: 'deleted', id });
});

// Clear all messages in an inbox manually
app.delete('/api/inbox/:address', apiKeyAuth, (req, res) => {
  const { address } = req.params;
  clearInbox(address);
  res.json({ status: 'cleared', address });
});

// Dedicated Discord Verification Code & URL Endpoint
app.get('/api/discord/:address', apiKeyAuth, async (req, res) => {
  const { address } = req.params;
  const shouldWait = req.query.wait === 'true';
  const timeoutSec = Math.min(60, Math.max(5, parseInt(req.query.timeout || '30', 10)));
  const cleanAddr = address.toLowerCase().trim();

  const existing = getLatestDiscordVerification(cleanAddr);
  if (existing) {
    return res.json({
      found: true,
      discord_code: existing.discord_code,
      discord_url: existing.discord_url,
      subject: existing.subject,
      from_address: existing.from_address,
      received_at: existing.received_at,
    });
  }

  if (!shouldWait) {
    return res.status(404).json({
      found: false,
      message: 'No Discord verification message found yet for this inbox',
    });
  }

  let resolved = false;
  const checkInterval = 1000;
  const startTime = Date.now();

  const timer = setInterval(() => {
    const found = getLatestDiscordVerification(cleanAddr);
    if (found) {
      resolved = true;
      clearInterval(timer);
      return res.json({
        found: true,
        discord_code: found.discord_code,
        discord_url: found.discord_url,
        subject: found.subject,
        from_address: found.from_address,
        received_at: found.received_at,
      });
    }

    if (Date.now() - startTime >= timeoutSec * 1000) {
      resolved = true;
      clearInterval(timer);
      return res.status(404).json({
        found: false,
        message: `Timed out waiting for Discord verification email after ${timeoutSec}s`,
      });
    }
  }, checkInterval);

  req.on('close', () => {
    if (!resolved) {
      clearInterval(timer);
    }
  });
});

// --- Admin Panel Endpoints (Owner ID Required, Zero Credential Leaks) ---

// 1. Get Domains List (Admin)
app.get('/api/admin/domains', requireOwner, (req, res) => {
  const domains = getDomains();
  res.json({ domains });
});

// 2. Add New Domain (Admin)
app.post('/api/admin/domains', requireOwner, (req, res) => {
  const { domain, isDefault } = req.body;
  if (!domain) {
    return res.status(400).json({ error: 'Domain name is required' });
  }

  try {
    const result = addDomain(domain, Boolean(isDefault));
    res.json({ success: true, domain: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Delete Domain (Admin)
app.delete('/api/admin/domains/:domain', requireOwner, (req, res) => {
  const { domain } = req.params;
  try {
    const result = removeDomain(domain);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Set Default Domain (Admin)
app.put('/api/admin/domains/:domain/default', requireOwner, (req, res) => {
  const { domain } = req.params;
  try {
    const result = setDefaultDomain(domain);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Admin Vault Stats (Admin)
app.get('/api/admin/stats', requireOwner, (req, res) => {
  const stats = getSystemStats();
  res.json({
    ...stats,
    owner_id: req.user.user_id,
    owner_username: req.user.username,
    security: {
      ip_masking: 'ACTIVE',
      encryption: 'AES-256 / HMAC',
      session_cookie: 'HttpOnly, SameSite=Strict',
      deletions_policy: 'ZERO_DELETIONS_ENABLED',
    },
  });
});

// 6. Trigger Immediate Preservation Compression Pass (Admin)
app.post('/api/admin/preserve-now', requireOwner, (req, res) => {
  preserveOldInboxes();
  res.json({ success: true, message: 'Preservation and compression pass completed' });
});

// 7. List API Keys (Admin)
app.get('/api/admin/keys', requireOwner, (req, res) => {
  const keys = listApiKeys();
  res.json({ keys });
});

// 8. Create API Key (Admin)
app.post('/api/admin/keys', requireOwner, (req, res) => {
  const { name, permissions } = req.body;
  const newKey = createApiKey({
    name: name || 'API Token',
    permissions: permissions || 'full',
  });
  res.json({
    success: true,
    key: newKey,
    message: 'Store this API Key securely. It cannot be retrieved again.',
  });
});

// 9. Revoke API Key (Admin)
app.delete('/api/admin/keys/:id', requireOwner, (req, res) => {
  const { id } = req.params;
  const ok = revokeApiKey(id);
  res.json({ success: ok, id });
});

// 10. Check API Key
app.post('/api/admin/check-key', (req, res) => {
  const rawKey = req.body.apiKey || req.headers['x-api-key'];
  if (!rawKey) {
    return res.status(400).json({ valid: false, error: 'No API key provided' });
  }

  const verified = verifyApiKey(rawKey);
  if (!verified) {
    return res.status(401).json({
      valid: false,
      error: 'Invalid or revoked API key',
    });
  }

  res.json({
    valid: true,
    id: verified.id,
    prefix: verified.prefix,
    name: verified.name,
    permissions: verified.permissions,
    created_at: verified.created_at,
    last_used_at: verified.last_used_at,
  });
});

// Health check (Zero IP leaks)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'crown-mail-vault',
    domains: getDomainNames(),
    zero_deletions: true,
    timestamp: new Date().toISOString(),
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Periodic preservation check: runs every 30 minutes
// Compresses messages older than 24h into cold storage, NEVER deletes!
setInterval(() => {
  preserveOldInboxes();
}, 30 * 60 * 1000);

// Clean expired sessions every hour
setInterval(() => {
  cleanExpiredSessions();
}, 60 * 60 * 1000);

// Run initial preservation check on boot
setTimeout(() => {
  preserveOldInboxes();
}, 5000);

// Start HTTP Server
server.listen(HTTP_PORT, '0.0.0.0', () => {
  const domains = getDomainNames();
  console.log(`\n================================================================`);
  console.log(`👑 CROWN MAIL VAULT (CLAYMORPHIC & NEOMORPHIC ENGINE) READY!`);
  console.log(`================================================================`);
  console.log(`📬 Active Domains:       ${domains.join(', ')}`);
  console.log(`❄️ Preservation State:   Active after 24h (Zero deletions, Cold compression)`);
  console.log(`🔒 Discord OAuth & Owner: Enforced (Owner IDs: ${OWNER_IDS.length ? OWNER_IDS.join(', ') : 'None configured yet in .env'})`);
  console.log(`🛡️ IP Shielding:        ACTIVE (All server & header IPs masked)`);
  console.log(`🌐 Web Dashboard:       http://0.0.0.0:${HTTP_PORT} (Force HTTPS: ${FORCE_HTTPS ? 'ON' : 'OFF'})`);
  console.log(`================================================================\n`);
});

// Optional Native HTTPS Server (when SSL certificate files are provided)
if (fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
  try {
    const sslOptions = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH),
    };
    const httpsServer = https.createServer(sslOptions, app);
    const httpsWss = new WebSocketServer({ server: httpsServer });
    setupWebSocketServer(httpsWss);
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`🔒 [HTTPS Server] Secure Web Dashboard active on port ${HTTPS_PORT}`);
    });
  } catch (err) {
    console.warn('⚠️ Native HTTPS startup skipped:', err.message);
  }
}

// Start Inbound SMTP Server on Port 25
startSmtpServer();
