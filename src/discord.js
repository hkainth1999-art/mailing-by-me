export function extractDiscordVerification(subject, textBody, htmlBody) {
  const combined = `${subject || ''}\n${textBody || ''}\n${htmlBody || ''}`;

  // 1. Extract 6-digit verification code
  let discordCode = null;

  // Pattern: "verification code is 123456" or "code: 123456" or "Security code: 123456"
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

  // 2. Extract Discord verification URL
  let discordUrl = null;
  const urlPatterns = [
    /https?:\/\/(?:click\.)?discord(?:app)?\.com\/[^\s"'<>]+/gi,
    /https?:\/\/discord\.com\/verify[^\s"'<>]+/gi,
    /https?:\/\/dis\.gd\/[^\s"'<>]+/gi,
  ];

  for (const pattern of urlPatterns) {
    const match = combined.match(pattern);
    if (match && match[0]) {
      discordUrl = match[0].replace(/&amp;/g, '&');
      break;
    }
  }

  return { discordCode, discordUrl };
}

