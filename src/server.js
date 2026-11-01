import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { HTTP_PORT, DOMAINS } from './config.js';
import {
  getMessages,
  getMessageById,
  getRawMessage,
  deleteMessage,
  clearInbox,
  getLatestDiscordVerification,
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

// Broadcast incoming email from SMTP server to connected WebSocket clients
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

  // Also broadcast to any wildcard global subscribers
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

// --- REST API Routes ---

// List configured domains
app.get('/api/domains', (req, res) => {
  res.json({ domains: DOMAINS });
});

// List messages in an inbox
app.get('/api/messages/:address', (req, res) => {
  const { address } = req.params;
  const messages = getMessages(address);
  res.json({ address: address.toLowerCase(), count: messages.length, messages });
});

// Get a single message details (with HTML, attachments, etc.)
app.get('/api/messages/:address/:id', (req, res) => {
  const { address, id } = req.params;
  const message = getMessageById(address, id);
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  res.json({ message });
});

// Get raw RFC822 source
app.get('/api/raw/:address/:id', (req, res) => {
  const { address, id } = req.params;
  const raw = getRawMessage(address, id);
  if (!raw) {
    return res.status(404).json({ error: 'Message not found' });
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(raw);
});

// Delete a message
app.delete('/api/messages/:address/:id', (req, res) => {
  const { address, id } = req.params;
  deleteMessage(address, id);
  res.json({ status: 'deleted', id });
});

// Clear all messages in an inbox
app.delete('/api/inbox/:address', (req, res) => {
  const { address } = req.params;
  clearInbox(address);
  res.json({ status: 'cleared', address });
});

// Dedicated Discord Verification Code & URL Endpoint (supports ?wait=true&timeout=30)
app.get('/api/discord/:address', async (req, res) => {
  const { address } = req.params;
  const shouldWait = req.query.wait === 'true';
  const timeoutSec = Math.min(60, Math.max(5, parseInt(req.query.timeout || '30', 10)));

  const cleanAddr = address.toLowerCase().trim();

  // First check if already received
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

  // Long-poll waiting
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'forsaken-mail-modified',
    domains: DOMAINS,
    smtp_port: HTTP_PORT,
    timestamp: new Date().toISOString(),
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Periodic database cleanup every hour
setInterval(() => {
  cleanOldMessages();
}, 3600 * 1000);

// Start HTTP Server
server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`\n================================================================`);
  console.log(`⚡ FORSAKEN MAIL (MODIFIED) RUNNING!`);
  console.log(`================================================================`);
  console.log(`🌐 Web Dashboard & API: http://0.0.0.0:${HTTP_PORT}`);
  console.log(`📬 Configured Domains:   ${DOMAINS.join(', ')}`);
  console.log(`================================================================\n`);
});

// Start Inbound SMTP Server on Port 25
startSmtpServer();

