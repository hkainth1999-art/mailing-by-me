import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } from './config.js';

function cleanUrl(url) {
  if (!url) return null;
  return url
    .replace(/&amp;/g, '&')
    .replace(/&#3D;/gi, '=')
    .replace(/["'\s;,.)\]>]+$/, '')
    .trim();
}

/**
 * Robust extractor for verification links and OTP codes.
 * Supports Discord, SendGrid click redirects, and transactional email confirmation buttons.
 * Strictly prevents false positives like hex colors (#000000).
 */
export function extractDiscordVerification(subject, textBody, htmlBody) {
  const html = htmlBody || '';
  const text = textBody || '';
  const raw = `${text}\n${html}`;

  // 1. URL Extraction
  let discordUrl = null;

  // Priority A: SendGrid or direct Discord click tracking (e.g. click.discord.com/ls/click)
  const discordClickMatch = raw.match(/https?:\/\/(?:click\.)?discord(?:app)?\.com\/ls\/click\?[^\s"'<>]+/i);
  if (discordClickMatch) {
    discordUrl = cleanUrl(discordClickMatch[0]);
  } else {
    // Priority B: Discord direct verify token URL
    const discordVerifyMatch = raw.match(/https?:\/\/(?:www\.)?discord(?:app)?\.com\/verify[^\s"'<>]+/i);
    if (discordVerifyMatch) {
      discordUrl = cleanUrl(discordVerifyMatch[0]);
    } else {
      // Priority C: Anchor tag with "Verify", "Confirm", or "Activate" button text
      const anchorRegex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = anchorRegex.exec(html)) !== null) {
        const href = m[1];
        const linkText = m[2].replace(/<[^>]+>/g, '').trim().toLowerCase();
        if (!href.startsWith('http')) continue;
        if (/unsubscribe|preferences|privacy|terms|twitter|facebook|instagram/i.test(href)) continue;

        if (/verify|confirm|activate|validation/i.test(linkText)) {
          discordUrl = cleanUrl(href);
          break;
        }
      }

      // Priority D: General verification URL in text or HTML
      if (!discordUrl) {
        const generalMatch = raw.match(/https?:\/\/[^\s"'<>]+(?:verify|verification|confirm|activate|token=|auth\/verify)[^\s"'<>]+/i);
        if (generalMatch) {
          discordUrl = cleanUrl(generalMatch[0]);
        }
      }
    }
  }

  // 2. Code Extraction (MUST NOT MATCH HEX COLORS like #000000 or #ffffff)
  let cleanText = text;
  if (!cleanText && html) {
    cleanText = html
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
  }

  // Strip hex color codes so #000000 or #ffffff are NEVER mistaken for OTP codes
  cleanText = cleanText.replace(/#[0-9a-fA-F]{3,8}\b/g, ' ');

  const searchArea = `${subject || ''}\n${cleanText}`;
  let discordCode = null;

  const codePatterns = [
    /(?:verification|security|confirmation|login|auth|otp|access)\s*(?:code|pin|number)?\s*(?:is\s*)?[:\-#]?\s*([0-9]{4,8})\b/i,
    /(?:code|pin)\s*(?:is\s*)?[:\-#]\s*([0-9]{4,8})\b/i,
    /(?:your|enter|use)\s*(?:the\s*)?(?:code|pin)\s*(?:is\s*)?[:\-]?\s*([0-9]{4,8})\b/i,
    /\b([0-9]{6})\b/,
    /\b([0-9]{3}[\s\-][0-9]{3})\b/,
  ];

  for (const pattern of codePatterns) {
    const match = searchArea.match(pattern);
    if (match && match[1]) {
      const code = match[1].replace(/[\s\-]/g, '');
      // Exclude bogus repetitive codes like 000000, 111111 unless explicitly labeled
      if (code !== '000000' && code !== '111111' && code.length >= 4 && code.length <= 8) {
        discordCode = code;
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
