import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import crypto from 'crypto';
import { SMTP_PORT, MAX_MESSAGE_SIZE } from './config.js';
import { saveMessage, isDomainAllowed, getDomainNames, maskIpAddresses } from './db.js';
import { extractDiscordVerification } from './discord.js';

let broadcastCallback = null;

export function setBroadcastCallback(cb) {
  broadcastCallback = cb;
}

export function startSmtpServer() {
  const server = new SMTPServer({
    disabledCommands: ['AUTH', 'STARTTLS'],
    authOptional: true,
    size: MAX_MESSAGE_SIZE,
    banner: 'Crown Mail Vault Inbound SMTP Gateway',

    // Validate recipient domain dynamically against active domains
    onRcptTo(address, session, callback) {
      const recipient = address.address.toLowerCase().trim();
      const domain = recipient.split('@')[1];

      if (!isDomainAllowed(domain)) {
        const allowed = getDomainNames();
        console.warn(`[SMTP] Relaying rejected for ${recipient} (Domain ${domain} not in configured domains: ${allowed.join(', ')})`);
        return callback(new Error(`Relaying denied: domain ${domain} is not configured on this server.`));
      }

      return callback(); // Accept recipient
    },

    // Handle inbound email stream
    onData(stream, session, callback) {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));

      stream.on('end', async () => {
        try {
          const rawBuffer = Buffer.concat(chunks);
          const rawMime = rawBuffer.toString('utf8');
          const parsed = await simpleParser(rawBuffer);

          // Resolve recipient
          let recipient = '';
          if (session.envelope && session.envelope.rcptTo && session.envelope.rcptTo.length > 0) {
            recipient = session.envelope.rcptTo[0].address.toLowerCase().trim();
          } else if (parsed.to) {
            const toItem = Array.isArray(parsed.to) ? parsed.to[0] : parsed.to;
            recipient = (toItem.value && toItem.value[0]?.address) || toItem.text || '';
          }

          if (!recipient) {
            const domains = getDomainNames();
            recipient = `vault@${domains[0] || 'localhost'}`;
          }

          // Clean recipient
          const cleanRecipient = recipient.replace(/[<>]/g, '').toLowerCase().trim();

          // Resolve sender
          const fromItem = parsed.from?.value?.[0];
          const fromAddress = fromItem?.address || session.envelope?.mailFrom?.address || 'unknown@sender.local';
          const fromName = fromItem?.name || null;

          // Extract Discord verification code & URL
          const subject = parsed.subject || '(No Subject)';
          const textBody = parsed.text || '';
          const htmlBody = parsed.html || parsed.textAsHtml || '';
          const { discordCode, discordUrl } = extractDiscordVerification(subject, textBody, htmlBody);

          // Process attachments
          const attachments = (parsed.attachments || []).map((att) => ({
            id: crypto.randomBytes(6).toString('hex'),
            filename: att.filename || 'attachment.bin',
            contentType: att.contentType || 'application/octet-stream',
            size: att.size || att.content?.length || 0,
            contentBase64: att.content ? att.content.toString('base64') : '',
          }));

          // Prepare snippet
          const snippet = textBody.trim().replace(/\s+/g, ' ').slice(0, 150);

          const messageId = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
          const messageRecord = {
            id: messageId,
            inbox_address: cleanRecipient,
            from_address: fromAddress,
            from_name: fromName,
            to_address: cleanRecipient,
            subject,
            snippet,
            text_body: textBody,
            html_body: htmlBody,
            raw_mime: maskIpAddresses(rawMime),
            attachments,
            headers: parsed.headers ? Object.fromEntries(parsed.headers) : {},
            discord_code: discordCode,
            discord_url: discordUrl,
            received_at: Date.now(),
          };

          // Save to SQLite Vault (Conserved indefinitely, 0 deletions)
          saveMessage(messageRecord);

          console.log(`\n📬 [SMTP RECEIVED] To: ${cleanRecipient} | From: ${fromAddress} | Subject: "${subject}"`);
          if (discordCode) {
            console.log(`   ⚡ [DISCORD CODE DETECTED]: ${discordCode}`);
          }

          // Push to WebSocket clients
          if (broadcastCallback) {
            broadcastCallback(cleanRecipient, {
              type: 'new_message',
              inbox: cleanRecipient,
              message: {
                id: messageRecord.id,
                inbox_address: messageRecord.inbox_address,
                from_address: messageRecord.from_address,
                from_name: messageRecord.from_name,
                subject: messageRecord.subject,
                snippet: messageRecord.snippet,
                discord_code: messageRecord.discord_code,
                discord_url: messageRecord.discord_url,
                received_at: messageRecord.received_at,
                is_read: 0,
                has_attachments: attachments.length > 0,
              },
            });
          }

          callback(null, 'OK: Message accepted and vaulted');
        } catch (err) {
          console.error('[SMTP] Error parsing email:', err);
          callback(new Error('Internal server error parsing email'));
        }
      });
    },
  });

  server.on('error', (err) => {
    console.error('❌ [SMTP Server Error]:', err.message);
  });

  server.listen(SMTP_PORT, '0.0.0.0', () => {
    console.log(`🚀 [SMTP Server] Listening on port ${SMTP_PORT} (Domains dynamically managed via Admin Panel)`);
  });

  return server;
}
