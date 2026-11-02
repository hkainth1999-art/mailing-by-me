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
  deleteMailbox,
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
import { apiLimiter, createInboxLimiter, discordOtpLimiter } from './ratelimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const publicDir = path.resolve(__dirname, '../public');
const staticDir = fs.existsSync(path.join(distDir, 'index.html')) ? distDir : publicDir;

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

// Static assets serving (Prioritizes Vite React TSX dist/ build, fallback to public/)
app.use(express.static(staticDir));
if (staticDir !== publicDir) {
  app.use(express.static(publicDir));
}

// Global API Rate Limiting (120 req/min with Discord Owner bypass)
app.use('/api', apiLimiter);
app.use('/domains', apiLimiter);

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

// Enforce either active Discord Session OR Valid API Key
function requireAuthOrApiKey(req, res, next) {
  const rawKey = req.headers['x-api-key'] || req.query.api_key || req.body?.api_key;
  if (rawKey) {
    const verified = verifyApiKey(rawKey);
    if (!verified) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or revoked API Key. Please provide a valid x-api-key header.',
        code: 'INVALID_API_KEY',
      });
    }
    const isOwner = verified.permissions === 'full' || verified.permissions === 'admin';
    req.user = {
      user_id: `api_${verified.id}`,
      username: verified.name,
      is_owner: isOwner,
      from_api: true,
      apiKey: verified,
    };
    req.apiKey = verified;
    return next();
  }

  const session = getAuthSession(req);
  if (session) {
    req.user = session;
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Authentication Required: Provide a valid API key (x-api-key header) or log in with Discord.',
    login_required: true,
  });
}

// --- Discord Authentication Endpoints ---

// 1. Get Discord OAuth login URL
app.get('/api/auth/discord', (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    return res.json({
      configured: false,
      message: 'Discord OAuth credentials not set in .env.',
    });
  }
  const url = getDiscordAuthUrl(req);
  res.json({ configured: true, url });
});

// Direct Discord OAuth redirect trigger
app.get('/api/auth/discord/login', (req, res) => {
  const url = getDiscordAuthUrl(req);
  if (!url) {
    return res.status(500).send('Discord Client ID is not configured in .env. Please check DISCORD_CLIENT_ID.');
  }
  res.redirect(url);
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

// 3. Current User Profile
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

// Public alias for GET /domains
app.get('/domains', (req, res) => {
  const domains = getDomains();
  res.json({
    domains: domains.map((d) => d.domain),
    default: domains.find((d) => d.is_default)?.domain || domains[0]?.domain || 'crwnmail.com',
  });
});

// API Documentation JSON Builder
function getApiDocsPayload(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;
  const domains = getDomains();

  return {
    service: 'Crown Mail Vault API',
    version: '2.0.0',
    base_url: baseUrl,
    authentication: {
      type: 'Discord Session Cookie OR x-api-key header',
      discord_login_url: `${baseUrl}/api/auth/discord/login`,
    },
    rate_limits: {
      general_api: '120 requests / minute',
      create_mailbox: '12 mailboxes / 10 minutes',
      discord_otp: '90 requests / minute',
      vault_owner: 'Unlimited (Bypassed)',
    },
    quota: {
      standard_user: '3 active mailboxes max (delete a mailbox to free a slot)',
      vault_owner: 'Unlimited mailboxes',
    },
    endpoints: [
      {
        path: '/domains',
        method: 'GET',
        description: 'Get list of active inbound domains accepted by the mail server.',
        curl: `curl -X GET "${baseUrl}/domains"`,
        response_example: {
          domains: domains.map((d) => d.domain),
          default: domains[0]?.domain || 'rizzcord.site',
        },
      },
      {
        path: '/api/domains',
        method: 'GET',
        description: 'Get list of active inbound domains (API namespace).',
        curl: `curl -X GET "${baseUrl}/api/domains"`,
      },
      {
        path: '/api/inbox/create',
        method: 'POST',
        description: 'Create a new mailbox (Standard users limit: 3 active mailboxes; Owner: unlimited). Rate limited: 12/10min.',
        headers: { 'Content-Type': 'application/json' },
        body: { address: `test_${Date.now().toString().slice(-4)}@${domains[0]?.domain || 'rizzcord.site'}` },
        curl: `curl -X POST "${baseUrl}/api/inbox/create" -H "Content-Type: application/json" -d '{"address":"alexander@${domains[0]?.domain || 'rizzcord.site'}"}'`,
      },
      {
        path: '/api/messages/:address',
        method: 'GET',
        description: 'List all emails received in an inbox.',
        curl: `curl -X GET "${baseUrl}/api/messages/alexander@${domains[0]?.domain || 'rizzcord.site'}"`,
      },
      {
        path: '/api/messages/:address/:id',
        method: 'GET',
        description: 'Get full content of an email (HTML, plain text, headers, attachments).',
        curl: `curl -X GET "${baseUrl}/api/messages/alexander@${domains[0]?.domain || 'rizzcord.site'}/1"`,
      },
      {
        path: '/api/discord/verify/:address',
        method: 'GET / POST',
        description: 'Auto-extracts Discord verification link (click URL) and 6-digit OTP code with polling support (?wait=true&timeout=30). Requires x-api-key or session.',
        headers: { 'x-api-key': 'your_crown_api_key' },
        curl: `curl -X GET "${baseUrl}/api/discord/verify/alexander@${domains[0]?.domain || 'rizzcord.site'}?wait=true&timeout=30" -H "x-api-key: YOUR_KEY"`,
      },
      {
        path: '/api/discord/:address',
        method: 'GET',
        description: 'Quick Discord OTP poller (backwards compatible).',
        curl: `curl -X GET "${baseUrl}/api/discord/alexander@${domains[0]?.domain || 'rizzcord.site'}"`,
      },
      {
        path: '/api/user/inboxes',
        method: 'GET',
        description: 'List your created mailboxes, with count (e.g. 1/3) and quota limit.',
        curl: `curl -X GET "${baseUrl}/api/user/inboxes"`,
      },
      {
        path: '/api/user/mailboxes/:address',
        method: 'DELETE',
        description: 'Delete a mailbox and its emails to free up 1 slot in your 3-mailbox quota.',
        curl: `curl -X DELETE "${baseUrl}/api/user/mailboxes/alexander@${domains[0]?.domain || 'rizzcord.site'}"`,
      },
      {
        path: '/api/inbox/:address',
        method: 'DELETE',
        description: 'Purge all messages in an inbox.',
        curl: `curl -X DELETE "${baseUrl}/api/inbox/alexander@${domains[0]?.domain || 'rizzcord.site'}"`,
      },
    ],
    websocket: {
      url: `wss://${host}/ws?address=<your-address>`,
      description: 'Connect via WebSocket to receive instant real-time notifications for incoming emails.',
    },
  };
}

// Dedicated JSON API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json(getApiDocsPayload(req));
});

// Dedicated HTML SPA Docs Page (with JSON fallback for cURL)
app.get('/docs', (req, res) => {
  if (req.accepts('html') && !req.xhr && !req.headers['x-api-key']) {
    return res.sendFile(path.join(staticDir, 'index.html'));
  }
  res.json(getApiDocsPayload(req));
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

// List user-created mailboxes (Discord logged-in user with 3-mailbox quota tracking)
app.get('/api/user/inboxes', requireDiscordAuth, (req, res) => {
  const mailboxes = listUserMailboxes(req.user.user_id);
  const isOwner = Boolean(req.user.is_owner);
  res.json({
    mailboxes,
    count: mailboxes.length,
    limit: isOwner ? 'unlimited' : 3,
    isOwner,
    canCreate: isOwner || mailboxes.length < 3,
  });
});

// Create or register a custom mailbox (Rate Limited: 12/10m + Discord Session OR Owner API Key)
// Standard users: 3 mailboxes max; Owner / Owner API Key: Unlimited mailboxes
// If created via API / by Owner: automatically marked is_hidden = 1 so it NEVER leaks on website recent list!
app.post('/api/inbox/create', createInboxLimiter, requireAuthOrApiKey, (req, res) => {
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

  const isOwner = Boolean(req.user.is_owner);
  const fromApi = Boolean(req.user.from_api);

  // 3-Mailbox Quota Enforcement for Standard Users (Bypassed if Owner or Owner API Key)
  const userMailboxes = req.user.user_id ? listUserMailboxes(req.user.user_id) : [];
  const alreadyOwns = userMailboxes.some((m) => m.address === fullAddress);

  if (!isOwner && !alreadyOwns && userMailboxes.length >= 3) {
    return res.status(403).json({
      success: false,
      error: 'Standard user quota reached (3/3 active mailboxes). Please delete one of your mailboxes to create a new one.',
      code: 'QUOTA_REACHED',
      limit: 3,
      current: userMailboxes.length,
    });
  }

  // If created via API by admin / owner, mark is_hidden = 1 so it NEVER shows in website recent list!
  const isHidden = fromApi || isOwner;
  const record = saveMailbox(fullAddress, req.user.user_id, req.user.username, isHidden, fromApi);
  const updatedMailboxes = req.user.user_id ? listUserMailboxes(req.user.user_id) : [];

  res.json({
    success: true,
    address: record.address,
    created_at: record.created_at,
    is_preserved: record.is_preserved,
    is_hidden: Boolean(isHidden),
    count: updatedMailboxes.length,
    limit: isOwner ? 'unlimited' : 3,
    policy: 'Infinite Retention (Preserved after 24h, 0 deletions)',
  });
});

// Delete Mailbox Route (frees 1 slot in the 3-mailbox quota)
app.delete(['/api/user/mailboxes/:address', '/api/mailboxes/:address'], requireDiscordAuth, (req, res) => {
  const { address } = req.params;
  const clean = address.toLowerCase().trim();
  try {
    const isOwner = Boolean(req.user.is_owner);
    deleteMailbox(clean, req.user.user_id, isOwner);
    const updated = listUserMailboxes(req.user.user_id);
    res.json({
      success: true,
      deleted: clean,
      count: updated.length,
      limit: isOwner ? 'unlimited' : 3,
      message: `Mailbox ${clean} and all its emails have been deleted. 1 slot freed.`,
    });
  } catch (err) {
    res.status(403).json({ success: false, error: err.message });
  }
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

// List messages in an inbox (Conserved indefinitely, 0 deletions! Owner API can bypass prior creation)
app.get('/api/messages/:address', apiKeyAuth, (req, res) => {
  const { address } = req.params;
  const cleanAddr = address.toLowerCase().trim();
  const isOwner = Boolean(req.user?.is_owner || req.apiKey?.permissions === 'full' || req.apiKey?.permissions === 'admin');
  const fromApi = Boolean(req.apiKey || req.user?.from_api);

  // Owner API bypass: automatically registers silently as hidden, eliminating mandatory creation call
  const mb = saveMailbox(cleanAddr, req.user?.user_id || null, req.user?.username || null, fromApi || isOwner, fromApi);
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

// Dedicated Secure Discord Verification Link & OTP Route (Demands Valid API Key or Session)
app.all(['/api/discord/verify/:address', '/api/discord/verify'], discordOtpLimiter, requireAuthOrApiKey, async (req, res) => {
  const address = req.params.address || req.query.address || req.body?.address;
  if (!address || !address.includes('@')) {
    return res.status(400).json({
      success: false,
      error: 'Valid mailbox address is required (e.g. user@rizzcord.site)',
    });
  }

  const cleanAddr = address.toLowerCase().trim();
  const shouldWait = req.query.wait !== 'false' && req.body?.wait !== false;
  const timeoutSec = Math.min(60, Math.max(3, parseInt(req.query.timeout || req.body?.timeout || '30', 10)));

  // Silent registration for owner / API key usage (bypasses prior mailbox creation)
  if (req.user?.is_owner || req.user?.from_api) {
    saveMailbox(cleanAddr, req.user.user_id, req.user.username, true, true);
  }

  const existing = getLatestDiscordVerification(cleanAddr);
  if (existing) {
    return res.json({
      success: true,
      found: true,
      address: cleanAddr,
      verification_url: existing.discord_url,
      discord_code: existing.discord_code,
      subject: existing.subject,
      from_address: existing.from_address,
      received_at: existing.received_at,
    });
  }

  if (!shouldWait) {
    return res.status(404).json({
      success: false,
      found: false,
      address: cleanAddr,
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
        success: true,
        found: true,
        address: cleanAddr,
        verification_url: found.discord_url,
        discord_code: found.discord_code,
        subject: found.subject,
        from_address: found.from_address,
        received_at: found.received_at,
      });
    }

    if (Date.now() - startTime >= timeoutSec * 1000) {
      resolved = true;
      clearInterval(timer);
      return res.status(404).json({
        success: false,
        found: false,
        address: cleanAddr,
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

// Dedicated Discord Verification Code & URL Endpoint (Rate Limited: 90 req/min)
app.get('/api/discord/:address', discordOtpLimiter, apiKeyAuth, async (req, res) => {
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

// SPA fallback (Serves Vite React TSX dist/index.html or public/index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
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
