import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DATA_DIR, RETENTION_HOURS, ADMIN_PASSWORD } from './config.js';

let db = null;
let memoryStore = {
  mailboxes: new Map(), // address -> { address, created_at }
  messages: [],
  apiKeys: new Map(), // id -> keyObj
  adminSessions: new Set(),
};

try {
  const { DatabaseSync } = await import('node:sqlite');
  const dbPath = path.join(DATA_DIR, 'forsaken.db');
  db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS mailboxes (
      address TEXT PRIMARY KEY,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      inbox_address TEXT,
      from_address TEXT,
      from_name TEXT,
      to_address TEXT,
      subject TEXT,
      snippet TEXT,
      text_body TEXT,
      html_body TEXT,
      raw_mime TEXT,
      attachments_json TEXT,
      headers_json TEXT,
      discord_code TEXT,
      discord_url TEXT,
      received_at INTEGER,
      is_read INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key_hash TEXT UNIQUE,
      prefix TEXT,
      name TEXT,
      permissions TEXT,
      created_at INTEGER,
      last_used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      created_at INTEGER,
      expires_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_inbox_received ON messages(inbox_address, received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mailboxes_created ON mailboxes(created_at DESC);
  `);
  console.log('✅ SQLite Cyber Vault initialized at:', dbPath);
} catch (err) {
  console.warn('⚠️ node:sqlite not available, using in-memory store:', err.message);
  db = null;
}

// --- Mailbox Operations ---

export function saveMailbox(address) {
  const cleanAddr = address.toLowerCase().trim();
  const now = Date.now();
  if (db) {
    const stmt = db.prepare('INSERT OR IGNORE INTO mailboxes (address, created_at) VALUES (?, ?)');
    stmt.run(cleanAddr, now);
  } else {
    if (!memoryStore.mailboxes.has(cleanAddr)) {
      memoryStore.mailboxes.set(cleanAddr, { address: cleanAddr, created_at: now });
    }
  }
  return { address: cleanAddr, created_at: now };
}

export function listRecentMailboxes(limit = 15) {
  if (db) {
    const stmt = db.prepare(`
      SELECT m.address, m.created_at,
             (SELECT COUNT(*) FROM messages msg WHERE msg.inbox_address = m.address) as count,
             (SELECT MAX(received_at) FROM messages msg WHERE msg.inbox_address = m.address) as last_active
      FROM mailboxes m
      ORDER BY COALESCE(last_active, m.created_at) DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }
  return Array.from(memoryStore.mailboxes.values())
    .map((m) => {
      const count = memoryStore.messages.filter((msg) => msg.inbox_address === m.address).length;
      return { address: m.address, created_at: m.created_at, count };
    })
    .slice(0, limit);
}

// --- Message Operations ---

export function saveMessage(msg) {
  const cleanInbox = msg.inbox_address.toLowerCase().trim();
  saveMailbox(cleanInbox);

  if (db) {
    const stmt = db.prepare(`
      INSERT INTO messages (
        id, inbox_address, from_address, from_name, to_address,
        subject, snippet, text_body, html_body, raw_mime,
        attachments_json, headers_json, discord_code, discord_url,
        received_at, is_read
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `);

    stmt.run(
      msg.id,
      cleanInbox,
      msg.from_address || '',
      msg.from_name || '',
      msg.to_address || cleanInbox,
      msg.subject || '(No Subject)',
      msg.snippet || '',
      msg.text_body || '',
      msg.html_body || '',
      msg.raw_mime || '',
      JSON.stringify(msg.attachments || []),
      JSON.stringify(msg.headers || {}),
      msg.discord_code || null,
      msg.discord_url || null,
      msg.received_at || Date.now(),
      0
    );
  } else {
    memoryStore.messages.unshift(msg);
  }
}

export function getMessages(inboxAddress) {
  const cleanInbox = inboxAddress.toLowerCase().trim();
  if (db) {
    const stmt = db.prepare(`
      SELECT id, inbox_address, from_address, from_name, to_address,
             subject, snippet, discord_code, discord_url, received_at, is_read,
             LENGTH(attachments_json) > 2 as has_attachments
      FROM messages
      WHERE inbox_address = ?
      ORDER BY received_at DESC
      LIMIT 100
    `);
    return stmt.all(cleanInbox);
  }
  return memoryStore.messages.filter((m) => m.inbox_address === cleanInbox);
}

export function getMessageById(inboxAddress, msgId) {
  const cleanInbox = inboxAddress.toLowerCase().trim();
  if (db) {
    db.prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND inbox_address = ?').run(msgId, cleanInbox);

    const stmt = db.prepare('SELECT * FROM messages WHERE id = ? AND inbox_address = ?');
    const row = stmt.get(msgId, cleanInbox);
    if (!row) return null;

    return {
      ...row,
      attachments: JSON.parse(row.attachments_json || '[]'),
      headers: JSON.parse(row.headers_json || '{}'),
    };
  }

  const found = memoryStore.messages.find((m) => m.id === msgId && m.inbox_address === cleanInbox);
  if (found) found.is_read = 1;
  return found || null;
}

export function getRawMessage(inboxAddress, msgId) {
  const cleanInbox = inboxAddress.toLowerCase().trim();
  if (db) {
    const stmt = db.prepare('SELECT raw_mime FROM messages WHERE id = ? AND inbox_address = ?');
    const row = stmt.get(msgId, cleanInbox);
    return row ? row.raw_mime : null;
  }
  const found = memoryStore.messages.find((m) => m.id === msgId && m.inbox_address === cleanInbox);
  return found ? found.raw_mime : null;
}

export function deleteMessage(inboxAddress, msgId) {
  const cleanInbox = inboxAddress.toLowerCase().trim();
  if (db) {
    const stmt = db.prepare('DELETE FROM messages WHERE id = ? AND inbox_address = ?');
    stmt.run(msgId, cleanInbox);
  } else {
    memoryStore.messages = memoryStore.messages.filter((m) => !(m.id === msgId && m.inbox_address === cleanInbox));
  }
}

export function clearInbox(inboxAddress) {
  const cleanInbox = inboxAddress.toLowerCase().trim();
  if (db) {
    db.prepare('DELETE FROM messages WHERE inbox_address = ?').run(cleanInbox);
  } else {
    memoryStore.messages = memoryStore.messages.filter((m) => m.inbox_address !== cleanInbox);
  }
}

export function getLatestDiscordVerification(inboxAddress) {
  const cleanInbox = inboxAddress.toLowerCase().trim();
  if (db) {
    const stmt = db.prepare(`
      SELECT id, subject, from_address, discord_code, discord_url, received_at
      FROM messages
      WHERE inbox_address = ? AND (discord_code IS NOT NULL OR discord_url IS NOT NULL)
      ORDER BY received_at DESC
      LIMIT 1
    `);
    return stmt.get(cleanInbox);
  }
  return memoryStore.messages.find(
    (m) => m.inbox_address === cleanInbox && (m.discord_code || m.discord_url)
  );
}

// --- API Keys Management ---

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function createApiKey({ name = 'Default Key', permissions = 'full' }) {
  const id = crypto.randomUUID();
  const rawKey = `ct_live_${crypto.randomBytes(24).toString('hex')}`;
  const key_hash = hashKey(rawKey);
  const prefix = rawKey.substring(0, 15) + '...';
  const now = Date.now();

  if (db) {
    const stmt = db.prepare(`
      INSERT INTO api_keys (id, key_hash, prefix, name, permissions, created_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, key_hash, prefix, name, permissions, now, null);
  } else {
    memoryStore.apiKeys.set(id, { id, key_hash, prefix, name, permissions, created_at: now, last_used_at: null });
  }

  return { id, key: rawKey, prefix, name, permissions, created_at: now };
}

export function listApiKeys() {
  if (db) {
    const stmt = db.prepare(`
      SELECT id, prefix, name, permissions, created_at, last_used_at
      FROM api_keys
      ORDER BY created_at DESC
    `);
    return stmt.all();
  }
  return Array.from(memoryStore.apiKeys.values()).map(({ key_hash, ...rest }) => rest);
}

export function revokeApiKey(id) {
  if (db) {
    const res = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    return res.changes > 0;
  }
  return memoryStore.apiKeys.delete(id);
}

export function verifyApiKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return null;
  const key_hash = hashKey(rawKey.trim());
  const now = Date.now();

  if (db) {
    const stmt = db.prepare('SELECT id, prefix, name, permissions, created_at, last_used_at FROM api_keys WHERE key_hash = ?');
    const keyRecord = stmt.get(key_hash);
    if (!keyRecord) return null;

    db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now, keyRecord.id);
    return keyRecord;
  }

  for (const k of memoryStore.apiKeys.values()) {
    if (k.key_hash === key_hash) {
      k.last_used_at = now;
      return k;
    }
  }
  return null;
}

// --- Admin Session Management ---

export function verifyAdminPassword(pwd) {
  if (!pwd) return false;
  return pwd === ADMIN_PASSWORD;
}

export function createAdminSession() {
  const token = `admin_sess_${crypto.randomBytes(32).toString('hex')}`;
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 3600 * 1000; // 7 days session

  if (db) {
    db.prepare('INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?, ?, ?)').run(token, now, expiresAt);
  } else {
    memoryStore.adminSessions.add(token);
  }
  return { token, expires_at: expiresAt };
}

export function isValidAdminSession(token) {
  if (!token) return false;
  if (db) {
    const stmt = db.prepare('SELECT * FROM admin_sessions WHERE token = ? AND expires_at > ?');
    const found = stmt.get(token, Date.now());
    return Boolean(found);
  }
  return memoryStore.adminSessions.has(token);
}

export function invalidateAdminSession(token) {
  if (db) {
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
  } else {
    memoryStore.adminSessions.delete(token);
  }
}

// --- System Stats & 10-Day Retention Cleanup ---

export function getSystemStats() {
  if (db) {
    const mailboxesCount = db.prepare('SELECT COUNT(*) as count FROM mailboxes').get()?.count || 0;
    const messagesCount = db.prepare('SELECT COUNT(*) as count FROM messages').get()?.count || 0;
    const keysCount = db.prepare('SELECT COUNT(*) as count FROM api_keys').get()?.count || 0;
    return {
      mailboxes: mailboxesCount,
      messages: messagesCount,
      api_keys: keysCount,
      retention_days: Math.round(RETENTION_HOURS / 24),
      retention_hours: RETENTION_HOURS,
    };
  }
  return {
    mailboxes: memoryStore.mailboxes.size,
    messages: memoryStore.messages.length,
    api_keys: memoryStore.apiKeys.size,
    retention_days: Math.round(RETENTION_HOURS / 24),
    retention_hours: RETENTION_HOURS,
  };
}

// Background cleanup of expired messages (default 10 days / 240 hours)
export function cleanOldMessages() {
  const cutoff = Date.now() - RETENTION_HOURS * 3600 * 1000;
  if (db) {
    const res = db.prepare('DELETE FROM messages WHERE received_at < ?').run(cutoff);
    if (res.changes > 0) {
      console.log(`🧹 Conserved database clean: Purged ${res.changes} messages older than ${RETENTION_HOURS}h.`);
    }
    // Clean expired admin sessions
    db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(Date.now());
  }
}
