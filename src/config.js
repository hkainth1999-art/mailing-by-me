import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const rawDomains = process.env.DOMAINS || 'rizzcord.site,mail.rizzcord.site,localhost';
export const DOMAINS = rawDomains
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export const HTTP_PORT = parseInt(process.env.PORT || process.env.HTTP_PORT || '3000', 10);
export const SMTP_PORT = parseInt(process.env.SMTP_PORT || '25', 10);
export const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
export const MAX_MESSAGE_SIZE = parseInt(process.env.MAX_MESSAGE_SIZE || '25000000', 10); // 25 MB
export const RETENTION_HOURS = parseInt(process.env.RETENTION_HOURS || '48', 10);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

