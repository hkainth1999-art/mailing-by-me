import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

const rawDomains = process.env.DOMAINS || 'rizzcord.site,mail.rizzcord.site';
export const INITIAL_DOMAINS = rawDomains
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export const HTTP_PORT = parseInt(process.env.PORT || process.env.HTTP_PORT || '3000', 10);
export const SMTP_PORT = parseInt(process.env.SMTP_PORT || '25', 10);
export const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
export const MAX_MESSAGE_SIZE = parseInt(process.env.MAX_MESSAGE_SIZE || '25000000', 10); // 25 MB

// Discord OAuth & Owner Security Config
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
export const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
export const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || '';

// Comma-separated Discord User IDs granted Owner / Admin Panel access
const rawOwnerIds = process.env.OWNER_IDS || process.env.DISCORD_OWNER_IDS || '';
export const OWNER_IDS = rawOwnerIds
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

// Cryptographic Secret for signing tokens and cookies
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const secretFilePath = path.join(DATA_DIR, '.server_secret');
let secretKey = process.env.ADMIN_SECRET || '';
if (!secretKey) {
  if (fs.existsSync(secretFilePath)) {
    secretKey = fs.readFileSync(secretFilePath, 'utf8').trim();
  } else {
    secretKey = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(secretFilePath, secretKey, 'utf8');
    } catch {}
  }
}
export const ADMIN_SECRET = secretKey;
