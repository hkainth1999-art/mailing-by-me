import fs from 'fs';
import path from 'path';
import { DATA_DIR, RETENTION_HOURS } from './config.js';

let db = null;
let memoryStore = { mailboxes: new Set(), messages: [] };

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
    CREATE INDEX IF NOT EXISTS idx_inbox_received ON messages(inbox_address, received_at DESC);
  `);
  console.log('✅ SQLite database initialized at:', dbPath);
} catch (err) {
  console.warn('⚠️ node:sqlite not available, falling back to memory/JSON store:', err.message);
  db = null;
}

export function saveMailbox(address) {
  const cleanAddr = address.toLowerCase().trim();
  if (db) {
    const stmt = db.prepare('INSERT OR IGNORE INTO mailboxes (address, created_at) VALUES (?, ?)');
    stmt.run(cleanAddr, Date.now());
  } else {
    memoryStore.mailboxes.add(cleanAddr);
  }
}

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
    // Mark as read
    db.prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND inbox_address = ?').run(msgId, cleanInbox);

    const stmt = db.prepare(`
      SELECT * FROM messages WHERE id = ? AND inbox_address = ?
    `);
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

// Background cleanup of old messages
export function cleanOldMessages() {
  const cutoff = Date.now() - RETENTION_HOURS * 3600 * 1000;
  if (db) {
    const res = db.prepare('DELETE FROM messages WHERE received_at < ?').run(cutoff);
    if (res.changes > 0) {
      console.log(`🧹 Purged ${res.changes} expired messages past ${RETENTION_HOURS}h retention.`);
    }
  }
}

