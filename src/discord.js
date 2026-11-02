import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } from './config.js';

export function extractDiscordVerification(subject, textBody, htmlBody) {
  const combined = `${subject || ''}\n${textBody || ''}\n${htmlBody || ''}`;

  // 1. Extract 6-digit verification code
  let discordCode = null;
  const codePatterns = [
    /verification\s+code\s+is\s*:?\s*(\d{6})/i,
    /security\s+code\s*[:\-]?\s*(\d{6})/i,
    /your\s+code\s*[:\-]?\s*(\d{6})/i,
    /\bcode\s*[:\-]\s*(\d{6})\b/i,
    /\b(\d{6})\b/,
  ];

  for (const pattern of codePatterns) {
    const match = combined.match(pattern);
    if (match && match[1]) {
      discordCode = match[1];
      break;
    }
  }

  // 2. Extract Discord verification URL (clicks, token links, verify redirects)
  let discordUrl = null;
  const urlPatterns = [
    /https?:\/\/(?:click\.)?discord(?:app)?\.com\/ls\/click\?[^\s"'<>]+/gi,
    /https?:\/\/discord(?:app)?\.com\/verify[^\s"'<>]+/gi,
    /https?:\/\/(?:click\.)?discord(?:app)?\.com\/[^\s"'<>]+/gi,
    /https?:\/\/dis\.gd\/[^\s"'<>]+/gi,
    /href=["'](https?:\/\/[^"']*(?:discord|dis\.gd)[^"']*)["']/i,
  ];

  for (const pattern of urlPatterns) {
    const match = combined.match(pattern);
    if (match) {
      const raw = match[1] || match[0];
      if (raw) {
        discordUrl = raw
          .replace(/&amp;/g, '&')
          .replace(/[.,;:)\]>]+$/, '')
          .trim();
        break;
      }
    }
  }

  return { discordCode, discordUrl };
}

// Build Discord OAuth2 Authorization URL
export function getDiscordAuthUrl(req) {
  if (!DISCORD_CLIENT_ID) return null;

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = DISCORD_REDIRECT_URI || `${protocol}://${host}/api/auth/discord/callback`;

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email',
    prompt: 'consent',
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

// Exchange authorization code for Discord access token
export async function exchangeDiscordCode(code, req) {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    throw new Error('Discord Client ID or Secret is not configured in .env');
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = DISCORD_REDIRECT_URI || `${protocol}://${host}/api/auth/discord/callback`;

  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Discord token exchange failed (${res.status}): ${errText}`);
  }

  return res.json();
}

// Fetch authenticated user profile from Discord API
export async function fetchDiscordUser(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Discord user profile (${res.status})`);
  }

  return res.json();
}
