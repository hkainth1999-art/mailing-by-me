import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { DATA_DIR, INITIAL_DOMAINS, OWNER_IDS } from './config.js';

let db = null;
let memoryStore = {
  domains: new Map(), // domain -> { domain, is_default, created_at }
  mailboxes: new Map(), // address -> { address, discord_user_id, discord_username, created_at, last_accessed_at, is_preserved, preserved_at }
  messages: [],
  apiKeys: new Map(),
  discordSessions: new Map(),
};

// In-memory domain cache for sub-microsecond SMTP check
let cachedDomains = [];

function refreshDomainCache() {
  if (db) {
    try {
      const rows = db.prepare('SELECT domain FROM domains ORDER BY is_default DESC, domain ASC').all();
      cachedDomains = rows.map((r) => r.domain.toLowerCase().trim());
    } catch {
      cachedDomains = Array.from(memoryStore.domains.keys());
    }
  } else {
    cachedDomains = Array.from(memoryStore.domains.keys());
  }
}

try {
  const { DatabaseSync } = await import('node:sqlite');
  const dbPath = path.join(DATA_DIR, 'forsaken.db');
  db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS domains (
      domain TEXT PRIMARY KEY,
      is_default INTEGER DEFAULT 0,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS mailboxes (
      address TEXT PRIMARY KEY,
      discord_user_id TEXT,
      discord_username TEXT,
      created_at INTEGER,
      last_accessed_at INTEGER,
      is_preserved INTEGER DEFAULT 0,
      preserved_at INTEGER
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
      is_read INTEGER DEFAULT 0,
      is_compressed INTEGER DEFAULT 0
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

    CREATE TABLE IF NOT EXISTS discord_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      global_name TEXT,
      avatar TEXT,
      is_owner INTEGER DEFAULT 0,
      created_at INTEGER,
      expires_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_inbox_received ON messages(inbox_address, received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mailboxes_created ON mailboxes(created_at DESC);
  `);

  // Safe schema migrations for existing databases
  const runMigration = (sql) => {
    try {
      db.exec(sql);
    } catch (e) {
      // Column may already exist
    }
  };

  runMigration('ALTER TABLE mailboxes ADD COLUMN discord_user_id TEXT;');
  runMigration('ALTER TABLE mailboxes ADD COLUMN discord_username TEXT;');
  runMigration('ALTER TABLE mailboxes ADD COLUMN last_accessed_at INTEGER;');
  runMigration('ALTER TABLE mailboxes ADD COLUMN is_preserved INTEGER DEFAULT 0;');
  runMigration('ALTER TABLE mailboxes ADD COLUMN preserved_at INTEGER;');
  runMigration('ALTER TABLE mailboxes ADD COLUMN is_hidden INTEGER DEFAULT 0;');
  runMigration('ALTER TABLE mailboxes ADD COLUMN created_by_api INTEGER DEFAULT 0;');
  runMigration('ALTER TABLE messages ADD COLUMN is_compressed INTEGER DEFAULT 0;');
  runMigration('ALTER TABLE api_keys ADD COLUMN raw_key TEXT;');
  runMigration('CREATE INDEX IF NOT EXISTS idx_mailboxes_discord ON mailboxes(discord_user_id);');

  // Auto-populate raw_key for any legacy API keys so owners can copy them immediately
  try {
    const unpopulated = db.prepare('SELECT id FROM api_keys WHERE raw_key IS NULL OR raw_key = ""').all();
    for (const row of unpopulated) {
      const newRawKey = `crwn_${crypto.randomBytes(24).toString('hex')}`;
      const newHash = crypto.createHash('sha256').update(newRawKey).digest('hex');
      const newPrefix = newRawKey.substring(0, 15) + '...';
      db.prepare('UPDATE api_keys SET raw_key = ?, key_hash = ?, prefix = ? WHERE id = ?').run(newRawKey, newHash, newPrefix, row.id);
    }
  } catch {}

  // Seed initial domains from config if domains table is empty
  const count = db.prepare('SELECT COUNT(*) as count FROM domains').get()?.count || 0;
  if (count === 0) {
    const insertDomain = db.prepare('INSERT OR IGNORE INTO domains (domain, is_default, created_at) VALUES (?, ?, ?)');
    INITIAL_DOMAINS.forEach((domain, idx) => {
      insertDomain.run(domain.toLowerCase().trim(), idx === 0 ? 1 : 0, Date.now());
    });
  }

  refreshDomainCache();
  console.log('✅ SQLite Cyber Vault initialized at:', dbPath);
} catch (err) {
  console.warn('⚠️ node:sqlite not available or error, falling back to memory store:', err.message);
  db = null;
  INITIAL_DOMAINS.forEach((domain, idx) => {
    const clean = domain.toLowerCase().trim();
    memoryStore.domains.set(clean, { domain: clean, is_default: idx === 0 ? 1 : 0, created_at: Date.now() });
  });
  refreshDomainCache();
}

// --- IP & Header Masking Helper ---
// Masks internal or external IP addresses from being exposed in headers, inspectors or logs
export function maskIpAddresses(str) {
  if (!str || typeof str !== 'string') return str;
  // Match IPv4
  const ipv4Regex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  // Match IPv6
  const ipv6Regex = /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|:(?::[0-9a-fA-F]{1,4}){1,7}/g;
  return str.replace(ipv4Regex, 'shielded-relay.vault').replace(ipv6Regex, 'shielded-ipv6.vault');
}

export function sanitizeHeaders(headersObj) {
  if (!headersObj || typeof headersObj !== 'object') return {};
  const sanitized = {};
  for (const [key, value] of Object.entries(headersObj)) {
    if (typeof value === 'string') {
      sanitized[key] = maskIpAddresses(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => (typeof item === 'string' ? maskIpAddresses(item) : item));
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// --- Domain Operations ---

export function getDomains() {
  if (db) {
    const rows = db.prepare('SELECT domain, is_default, created_at FROM domains ORDER BY is_default DESC, domain ASC').all();
    return rows;
  }
  return Array.from(memoryStore.domains.values()).sort((a, b) => b.is_default - a.is_default);
}

export function getDomainNames() {
  return cachedDomains.length > 0 ? cachedDomains : INITIAL_DOMAINS;
}

export function addDomain(domainName, isDefault = false) {
  const clean = domainName.toLowerCase().trim().replace(/^@/, '');
  if (!clean || !clean.includes('.')) {
    throw new Error('Invalid domain format. Example: crwnmail.com');
  }

  const now = Date.now();
  if (db) {
    if (isDefault) {
      db.prepare('UPDATE domains SET is_default = 0').run();
    }
    const stmt = db.prepare('INSERT OR REPLACE INTO domains (domain, is_default, created_at) VALUES (?, ?, ?)');
    stmt.run(clean, isDefault ? 1 : 0, now);
  } else {
    if (isDefault) {
      for (const d of memoryStore.domains.values()) d.is_default = 0;
    }
    memoryStore.domains.set(clean, { domain: clean, is_default: isDefault ? 1 : 0, created_at: now });
  }

  refreshDomainCache();
  return { domain: clean, is_default: isDefault ? 1 : 0, created_at: now };
}

export function removeDomain(domainName) {
  const clean = domainName.toLowerCase().trim();
  const all = getDomains();
  if (all.length <= 1) {
    throw new Error('Cannot delete the last remaining domain.');
  }

  if (db) {
    db.prepare('DELETE FROM domains WHERE domain = ?').run(clean);
    // If deleted domain was default, set another domain as default
    const hasDefault = db.prepare('SELECT domain FROM domains WHERE is_default = 1 LIMIT 1').get();
    if (!hasDefault) {
      db.prepare('UPDATE domains SET is_default = 1 WHERE domain = (SELECT domain FROM domains LIMIT 1)').run();
    }
  } else {
    memoryStore.domains.delete(clean);
    let hasDef = false;
    for (const d of memoryStore.domains.values()) {
      if (d.is_default) hasDef = true;
    }
    if (!hasDef && memoryStore.domains.size > 0) {
      memoryStore.domains.values().next().value.is_default = 1;
    }
  }

  refreshDomainCache();
  return { success: true, domain: clean };
}

export function setDefaultDomain(domainName) {
  const clean = domainName.toLowerCase().trim();
  if (db) {
    db.prepare('UPDATE domains SET is_default = 0').run();
    db.prepare('UPDATE domains SET is_default = 1 WHERE domain = ?').run(clean);
  } else {
    for (const d of memoryStore.domains.values()) {
      d.is_default = d.domain === clean ? 1 : 0;
    }
  }
  refreshDomainCache();
  return { success: true, default_domain: clean };
}

export function isDomainAllowed(domainName) {
  if (!domainName) return false;
  const clean = domainName.toLowerCase().trim();
  return cachedDomains.includes(clean) || cachedDomains.includes('*');
}

// --- Mailbox Operations ---

export function saveMailbox(address, discordUserId = null, discordUsername = null, isHidden = false, createdByApi = false) {
  const cleanAddr = address.toLowerCase().trim();
  const now = Date.now();

  if (db) {
    const existing = db.prepare('SELECT address, discord_user_id, discord_username, created_at, is_preserved, preserved_at, is_hidden, created_by_api FROM mailboxes WHERE address = ?').get(cleanAddr);
    if (!existing) {
      const stmt = db.prepare(`
        INSERT INTO mailboxes (address, discord_user_id, discord_username, created_at, last_accessed_at, is_preserved, preserved_at, is_hidden, created_by_api)
        VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)
      `);
      stmt.run(cleanAddr, discordUserId, discordUsername, now, now, isHidden ? 1 : 0, createdByApi ? 1 : 0);
      return { address: cleanAddr, discord_user_id: discordUserId, discord_username: discordUsername, created_at: now, is_preserved: 0, is_hidden: isHidden ? 1 : 0, created_by_api: createdByApi ? 1 : 0 };
    } else {
      // Update access and Discord user if linking
      if (discordUserId && !existing.discord_user_id) {
        db.prepare('UPDATE mailboxes SET last_accessed_at = ?, discord_user_id = ?, discord_username = ? WHERE address = ?').run(now, discordUserId, discordUsername, cleanAddr);
      } else {
        db.prepare('UPDATE mailboxes SET last_accessed_at = ? WHERE address = ?').run(now, cleanAddr);
      }
      return existing;
    }
  } else {
    if (!memoryStore.mailboxes.has(cleanAddr)) {
      const mb = { address: cleanAddr, discord_user_id: discordUserId, discord_username: discordUsername, created_at: now, last_accessed_at: now, is_preserved: 0, preserved_at: null, is_hidden: isHidden ? 1 : 0, created_by_api: createdByApi ? 1 : 0 };
      memoryStore.mailboxes.set(cleanAddr, mb);
      return mb;
    }
    const mb = memoryStore.mailboxes.get(cleanAddr);
    mb.last_accessed_at = now;
    if (discordUserId && !mb.discord_user_id) {
      mb.discord_user_id = discordUserId;
      mb.discord_username = discordUsername;
    }
    return mb;
  }
}

export function getMailboxDetails(address) {
  const cleanAddr = address.toLowerCase().trim();
  if (db) {
    return db.prepare('SELECT * FROM mailboxes WHERE address = ?').get(cleanAddr) || null;
  }
  return memoryStore.mailboxes.get(cleanAddr) || null;
}

export function listRecentMailboxes(limit = 15) {
  if (db) {
    const stmt = db.prepare(`
      SELECT m.address, m.created_at, m.last_accessed_at, m.is_preserved, m.discord_username,
             (SELECT COUNT(*) FROM messages msg WHERE msg.inbox_address = m.address) as count,
             (SELECT MAX(received_at) FROM messages msg WHERE msg.inbox_address = m.address) as last_active
      FROM mailboxes m
      WHERE m.is_preserved = 0 AND (m.is_hidden = 0 OR m.is_hidden IS NULL)
      ORDER BY COALESCE(last_active, m.created_at) DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }
  return Array.from(memoryStore.mailboxes.values())
    .filter((m) => !m.is_preserved && !m.is_hidden)
    .map((m) => {
      const count = memoryStore.messages.filter((msg) => msg.inbox_address === m.address).length;
      return { address: m.address, created_at: m.created_at, count, is_preserved: m.is_preserved };
    })
    .slice(0, limit);
}

export function listUserMailboxes(discordUserId) {
  if (!discordUserId) return [];
  if (db) {
    const stmt = db.prepare(`
      SELECT m.address, m.created_at, m.last_accessed_at, m.is_preserved,
             (SELECT COUNT(*) FROM messages msg WHERE msg.inbox_address = m.address) as count
      FROM mailboxes m
      WHERE m.discord_user_id = ?
      ORDER BY m.created_at DESC
    `);
    return stmt.all(discordUserId);
  }
  return Array.from(memoryStore.mailboxes.values())
    .filter((m) => m.discord_user_id === discordUserId)
    .map((m) => ({
      address: m.address,
      created_at: m.created_at,
      count: memoryStore.messages.filter((msg) => msg.inbox_address === m.address).length,
      is_preserved: m.is_preserved,
    }));
}

export function deleteMailbox(address, discordUserId = null, isOwner = false) {
  const cleanAddr = address.toLowerCase().trim();
  if (db) {
    if (discordUserId && !isOwner) {
      const mb = db.prepare('SELECT discord_user_id FROM mailboxes WHERE address = ?').get(cleanAddr);
      if (mb && mb.discord_user_id && mb.discord_user_id !== discordUserId) {
        throw new Error('Unauthorized: You can only delete your own mailboxes');
      }
    }
    // Delete all messages belonging to this mailbox
    db.prepare('DELETE FROM messages WHERE inbox_address = ?').run(cleanAddr);
    // Delete the mailbox record
    const res = db.prepare('DELETE FROM mailboxes WHERE address = ?').run(cleanAddr);
    return res.changes > 0;
  } else {
    memoryStore.messages = memoryStore.messages.filter((m) => m.inbox_address !== cleanAddr);
    return memoryStore.mailboxes.delete(cleanAddr);
  }
}

// --- Message Compression & Preservation Logic ---
// Conserves space after 24 hours: compresses text/html/mime into gzip/deflate blobs.
// ZERO messages are ever deleted! When opened, messages are decompressed on-the-fly.

function compressText(str) {
  if (!str) return '';
  try {
    return zlib.deflateSync(Buffer.from(str, 'utf8')).toString('base64');
  } catch {
    return str;
  }
}

function decompressText(str) {
  if (!str) return '';
  try {
    return zlib.inflateSync(Buffer.from(str, 'base64')).toString('utf8');
  } catch {
    return str;
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
        received_at, is_read, is_compressed
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, 0
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
      JSON.stringify(sanitizeHeaders(msg.headers || {})),
      msg.discord_code || null,
      msg.discord_url || null,
      msg.received_at || Date.now(),
      0
    );
  } else {
    memoryStore.messages.unshift({
      ...msg,
      headers: sanitizeHeaders(msg.headers || {}),
      is_compressed: 0,
    });
  }
}

export function getMessages(inboxAddress) {
  const cleanInbox = inboxAddress.toLowerCase().trim();
  const now = Date.now();

  // Mark mailbox as accessed
  if (db) {
    db.prepare('UPDATE mailboxes SET last_accessed_at = ? WHERE address = ?').run(now, cleanInbox);

    const stmt = db.prepare(`
      SELECT id, inbox_address, from_address, from_name, to_address,
             subject, snippet, discord_code, discord_url, received_at, is_read, is_compressed,
             LENGTH(attachments_json) > 2 as has_attachments
      FROM messages
      WHERE inbox_address = ?
      ORDER BY received_at DESC
      LIMIT 150
    `);
    const rows = stmt.all(cleanInbox);
    return rows;
  }

  const mb = memoryStore.mailboxes.get(cleanInbox);
  if (mb) mb.last_accessed_at = now;
  return memoryStore.messages.filter((m) => m.inbox_address === cleanInbox);
}

export function getMessageById(inboxAddress, msgId) {
  const cleanInbox = inboxAddress.toLowerCase().trim();
  if (db) {
    db.prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND inbox_address = ?').run(msgId, cleanInbox);

    const stmt = db.prepare('SELECT * FROM messages WHERE id = ? AND inbox_address = ?');
    const row = stmt.get(msgId, cleanInbox);
    if (!row) return null;

    let textBody = row.text_body || '';
    let htmlBody = row.html_body || '';
    let rawMime = row.raw_mime || '';

    // Decompress if compressed
    if (row.is_compressed === 1) {
      textBody = decompressText(textBody);
      htmlBody = decompressText(htmlBody);
      rawMime = decompressText(rawMime);
    }

    return {
      ...row,
      text_body: textBody,
      html_body: htmlBody,
      raw_mime: maskIpAddresses(rawMime),
      attachments: JSON.parse(row.attachments_json || '[]'),
      headers: sanitizeHeaders(JSON.parse(row.headers_json || '{}')),
    };
  }

  const found = memoryStore.messages.find((m) => m.id === msgId && m.inbox_address === cleanInbox);
  if (found) {
    found.is_read = 1;
    let textBody = found.text_body || '';
    let htmlBody = found.html_body || '';
    let rawMime = found.raw_mime || '';
    if (found.is_compressed) {
      textBody = decompressText(textBody);
      htmlBody = decompressText(htmlBody);
      rawMime = decompressText(rawMime);
    }
    return {
      ...found,
      text_body: textBody,
      html_body: htmlBody,
      raw_mime: maskIpAddresses(rawMime),
      headers: sanitizeHeaders(found.headers || {}),
    };
  }
  return null;
}

export function getRawMessage(inboxAddress, msgId) {
  const msg = getMessageById(inboxAddress, msgId);
  return msg ? msg.raw_mime : null;
}

export function deleteMessage(inboxAddress, msgId) {
  const cleanInbox = inboxAddress.toLowerCase().trim();
  if (db) {
    db.prepare('DELETE FROM messages WHERE id = ? AND inbox_address = ?').run(msgId, cleanInbox);
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

// Background Preservation Pass (Runs periodically)
// Checks mailboxes older than 24 hours. Marks them as preserved and compresses their email bodies to minimize disk space.
// NEVER deletes any email!
export function preserveOldInboxes() {
  const TWENTY_FOUR_HOURS = 24 * 3600 * 1000;
  const cutoff = Date.now() - TWENTY_FOUR_HOURS;

  if (db) {
    // 1. Mark mailboxes older than 24 hours as preserved
    const updateMailboxStmt = db.prepare(`
      UPDATE mailboxes
      SET is_preserved = 1, preserved_at = COALESCE(preserved_at, ?)
      WHERE created_at < ? AND is_preserved = 0
    `);
    const mbRes = updateMailboxStmt.run(Date.now(), cutoff);

    // 2. Compress messages in preserved or older inboxes that aren't compressed yet
    const uncompressed = db.prepare(`
      SELECT id, text_body, html_body, raw_mime
      FROM messages
      WHERE received_at < ? AND is_compressed = 0
      LIMIT 200
    `).all(cutoff);

    if (uncompressed.length > 0) {
      const updateMsg = db.prepare(`
        UPDATE messages
        SET text_body = ?, html_body = ?, raw_mime = ?, is_compressed = 1
        WHERE id = ?
      `);

      for (const m of uncompressed) {
        updateMsg.run(
          compressText(m.text_body),
          compressText(m.html_body),
          compressText(m.raw_mime),
          m.id
        );
      }
      console.log(`❄️ [Preservation Vault] Compressed ${uncompressed.length} emails into cold space-saving storage (0 deleted).`);
    }

    if (mbRes.changes > 0) {
      console.log(`❄️ [Preservation Vault] Marked ${mbRes.changes} inboxes (>24h) into preserved state.`);
    }
  } else {
    for (const mb of memoryStore.mailboxes.values()) {
      if (mb.created_at < cutoff && !mb.is_preserved) {
        mb.is_preserved = 1;
        mb.preserved_at = Date.now();
      }
    }
    for (const m of memoryStore.messages) {
      if (m.received_at < cutoff && !m.is_compressed) {
        m.text_body = compressText(m.text_body);
        m.html_body = compressText(m.html_body);
        m.raw_mime = compressText(m.raw_mime);
        m.is_compressed = 1;
      }
    }
  }
}

// --- Discord Sessions & Owner Management ---

export function isOwnerId(discordId) {
  if (!discordId) return false;
  return OWNER_IDS.includes(String(discordId).trim());
}

export function createDiscordSession({ id, username, global_name, avatar }) {
  const token = `d_sess_${crypto.randomBytes(32).toString('hex')}`;
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 3600 * 1000; // 30-day session
  const isOwner = isOwnerId(id) ? 1 : 0;

  if (db) {
    db.prepare(`
      INSERT INTO discord_sessions (token, user_id, username, global_name, avatar, is_owner, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(token, id, username, global_name || username, avatar || '', isOwner, now, expiresAt);
  } else {
    memoryStore.discordSessions.set(token, {
      token,
      user_id: id,
      username,
      global_name: global_name || username,
      avatar: avatar || '',
      is_owner: isOwner,
      created_at: now,
      expires_at: expiresAt,
    });
  }

  return { token, is_owner: isOwner, expires_at: expiresAt };
}

export function getDiscordSession(token) {
  if (!token) return null;
  const now = Date.now();

  if (db) {
    const stmt = db.prepare(`
      SELECT token, user_id, username, global_name, avatar, is_owner, created_at, expires_at
      FROM discord_sessions
      WHERE token = ? AND expires_at > ?
    `);
    const session = stmt.get(token, now);
    if (!session) return null;
    return {
      ...session,
      is_owner: isOwnerId(session.user_id) ? 1 : session.is_owner,
    };
  }

  const s = memoryStore.discordSessions.get(token);
  if (s && s.expires_at > now) {
    return { ...s, is_owner: isOwnerId(s.user_id) ? 1 : s.is_owner };
  }
  return null;
}

export function deleteDiscordSession(token) {
  if (!token) return;
  if (db) {
    db.prepare('DELETE FROM discord_sessions WHERE token = ?').run(token);
  } else {
    memoryStore.discordSessions.delete(token);
  }
}

// Clean expired discord sessions
export function cleanExpiredSessions() {
  const now = Date.now();
  if (db) {
    db.prepare('DELETE FROM discord_sessions WHERE expires_at < ?').run(now);
  } else {
    for (const [k, v] of memoryStore.discordSessions.entries()) {
      if (v.expires_at < now) memoryStore.discordSessions.delete(k);
    }
  }
}

// --- API Keys Management ---

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function createApiKey({ name = 'Default Key', permissions = 'full' }) {
  const id = crypto.randomUUID();
  const rawKey = `crwn_${crypto.randomBytes(24).toString('hex')}`;
  const key_hash = hashKey(rawKey);
  const prefix = rawKey.substring(0, 15) + '...';
  const now = Date.now();

  if (db) {
    const stmt = db.prepare(`
      INSERT INTO api_keys (id, key_hash, prefix, name, permissions, created_at, last_used_at, raw_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, key_hash, prefix, name, permissions, now, null, rawKey);
  } else {
    memoryStore.apiKeys.set(id, { id, key_hash, prefix, name, permissions, created_at: now, last_used_at: null, raw_key: rawKey });
  }

  return { id, key: rawKey, raw_key: rawKey, prefix, name, permissions, created_at: now };
}

export function listApiKeys() {
  if (db) {
    const stmt = db.prepare(`
      SELECT id, prefix, name, permissions, created_at, last_used_at, raw_key
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

// --- System Metrics (Masks all IPs) ---

export function getSystemStats() {
  const domains = getDomains();
  if (db) {
    const mailboxesCount = db.prepare('SELECT COUNT(*) as count FROM mailboxes').get()?.count || 0;
    const preservedCount = db.prepare('SELECT COUNT(*) as count FROM mailboxes WHERE is_preserved = 1').get()?.count || 0;
    const messagesCount = db.prepare('SELECT COUNT(*) as count FROM messages').get()?.count || 0;
    const compressedMessagesCount = db.prepare('SELECT COUNT(*) as count FROM messages WHERE is_compressed = 1').get()?.count || 0;
    const keysCount = db.prepare('SELECT COUNT(*) as count FROM api_keys').get()?.count || 0;

    return {
      mailboxes: mailboxesCount,
      preserved_mailboxes: preservedCount,
      messages: messagesCount,
      compressed_messages: compressedMessagesCount,
      domains_count: domains.length,
      domains: domains.map((d) => d.domain),
      api_keys: keysCount,
      policy: 'Preserved Infinite Vault (Zero Deletions)',
    };
  }

  const preserved = Array.from(memoryStore.mailboxes.values()).filter((m) => m.is_preserved).length;
  const compressed = memoryStore.messages.filter((m) => m.is_compressed).length;

  return {
    mailboxes: memoryStore.mailboxes.size,
    preserved_mailboxes: preserved,
    messages: memoryStore.messages.length,
    compressed_messages: compressed,
    domains_count: domains.length,
    domains: domains.map((d) => d.domain),
    api_keys: memoryStore.apiKeys.size,
    policy: 'Preserved Infinite Vault (Zero Deletions)',
  };
}
