import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { HTTP_PORT, DOMAINS, RETENTION_HOURS } from './config.js';
import {
  saveMailbox,
  listRecentMailboxes,
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
  verifyAdminPassword,
  createAdminSession,
  isValidAdminSession,
  invalidateAdminSession,
  getSystemStats,
  cleanOldMessages,
} from './db.js';
import { startSmtpServer, setBroadcastCallback } from './smtp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Map of address -> Set of active WebSockets
const subscribers = new Map();

wss.on('connection', (ws, req) => {
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

// Broadcast incoming email from Port 25 SMTP to connected WebSocket clients
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

// Admin Auth Middleware
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || req.query.token;
  if (!isValidAdminSession(token)) {
    return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
  }
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

// --- Public & Mailbox REST API Routes ---

// List configured domains
app.get('/api/domains', (req, res) => {
  res.json({ domains: DOMAINS });
});

// System Stats
app.get('/api/stats', (req, res) => {
  res.json({
    service: 'CyberTemp Private Mail',
    ...getSystemStats(),
    domains: DOMAINS,
  });
});

// List recent mailboxes
app.get('/api/inbox/recent', (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit || '15', 10));
  const recent = listRecentMailboxes(limit);
  res.json({ recent });
});

// Create or register a custom mailbox
app.post('/api/inbox/create', (req, res) => {
  const { address, username, domain } = req.body;
  let fullAddress = '';

  if (address && address.includes('@')) {
    fullAddress = address.trim().toLowerCase();
  } else if (username && domain) {
    fullAddress = `${username.trim().toLowerCase()}@${domain.trim().toLowerCase()}`;
  } else if (address) {
    fullAddress = `${address.trim().toLowerCase()}@${DOMAINS[0]}`;
  } else {
    return res.status(400).json({ error: 'Please provide a valid mailbox address or username + domain' });
  }

  const record = saveMailbox(fullAddress);
  res.json({
    success: true,
    address: record.address,
    created_at: record.created_at,
    retention_days: Math.round(RETENTION_HOURS / 24),
  });
});

// List messages in an inbox (Conserved for 10 days!)
app.get('/api/messages/:address', apiKeyAuth, (req, res) => {
  const { address } = req.params;
  const cleanAddr = address.toLowerCase().trim();
  saveMailbox(cleanAddr); // Ensure registered
  const messages = getMessages(cleanAddr);
  res.json({
    address: cleanAddr,
    count: messages.length,
    retention_days: Math.round(RETENTION_HOURS / 24),
    messages,
  });
});

// Get a single message details (with HTML, attachments, headers)
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

// Delete a message
app.delete('/api/messages/:address/:id', apiKeyAuth, (req, res) => {
  const { address, id } = req.params;
  deleteMessage(address, id);
  res.json({ status: 'deleted', id });
});

// Clear all messages in an inbox
app.delete('/api/inbox/:address', apiKeyAuth, (req, res) => {
  const { address } = req.params;
  clearInbox(address);
  res.json({ status: 'cleared', address });
});

// Dedicated Discord Verification Code & URL Endpoint (supports ?wait=true&timeout=30)
app.get('/api/discord/:address', apiKeyAuth, async (req, res) => {
  const { address } = req.params;
  const shouldWait = req.query.wait === 'true';
  const timeoutSec = Math.min(60, Math.max(5, parseInt(req.query.timeout || '30', 10)));
  const cleanAddr = address.toLowerCase().trim();

  // 1. Check if already received
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

  // 2. Long-poll wait
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

// --- Admin Authentication & API Key Management ---

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!verifyAdminPassword(password)) {
    return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
  }

  const session = createAdminSession();
  res.json({
    success: true,
    token: session.token,
    expires_at: session.expires_at,
    message: 'Admin authorization granted',
  });
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    invalidateAdminSession(token);
  }
  res.json({ success: true, message: 'Logged out' });
});

// Verify Admin Token
app.get('/api/admin/verify', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const valid = isValidAdminSession(token);
  res.json({ valid });
});

// List API Keys (Admin only)
app.get('/api/admin/keys', requireAdmin, (req, res) => {
  const keys = listApiKeys();
  res.json({ keys });
});

// Create new API Key (Admin only)
app.post('/api/admin/keys', requireAdmin, (req, res) => {
  const { name, permissions } = req.body;
  const newKey = createApiKey({
    name: name || 'API Token',
    permissions: permissions || 'full',
  });
  res.json({
    success: true,
    key: newKey, // Note: raw key is only returned once here
    message: 'Store this API Key securely. It cannot be retrieved again.',
  });
});

// Revoke API Key (Admin only)
app.delete('/api/admin/keys/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const ok = revokeApiKey(id);
  res.json({ success: ok, id });
});

// Interactive API Key Checker (Tests an API key validity, scope & metadata)
app.post('/api/admin/check-key', (req, res) => {
  const rawKey = req.body.apiKey || req.headers['x-api-key'];
  if (!rawKey) {
    return res.status(400).json({ valid: false, error: 'No API key provided in body or x-api-key header' });
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'cyber-temp-mail-smtp',
    domains: DOMAINS,
    retention_days: Math.round(RETENTION_HOURS / 24),
    timestamp: new Date().toISOString(),
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Periodic database cleanup every hour (preserves for 10 days / 240 hours)
setInterval(() => {
  cleanOldMessages();
}, 3600 * 1000);

// Start HTTP Server
server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`\n================================================================`);
  console.log(`⚡ CYBER TEMP MAIL (NEOMORPHIC SMTP SERVER) RUNNING!`);
  console.log(`================================================================`);
  console.log(`🌐 Web Dashboard & API: http://0.0.0.0:${HTTP_PORT}`);
  console.log(`📬 Configured Domains:   ${DOMAINS.join(', ')}`);
  console.log(`🔒 Email Conservation:  ${Math.round(RETENTION_HOURS / 24)} Days (${RETENTION_HOURS} Hours)`);
  console.log(`🛡️ Admin Default Pwd:   ${process.env.ADMIN_PASSWORD || 'cyberadmin2026'}`);
  console.log(`================================================================\n`);
});

// Start Inbound SMTP Server on Port 25
startSmtpServer();
