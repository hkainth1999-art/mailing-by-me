import nodemailer from 'nodemailer';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import dns from 'dns/promises';
import { verifyApiKey, maskIpAddresses } from './db.js';
import { MAX_MESSAGE_SIZE } from './config.js';

/**
 * Direct MX outbound mail sender
 * Resolves the recipient's MX record via DNS and transmits directly to the remote mail exchange.
 */
export async function sendOutboundMail({ from, to, subject, text, html, replyTo }) {
  if (!to || !to.includes('@')) {
    throw new Error('Valid recipient "to" address is required');
  }

  const recipientDomain = to.split('@')[1].toLowerCase().trim();

  // Resolve MX records for recipient domain
  let mxHost = recipientDomain;
  try {
    const mxRecords = await dns.resolveMx(recipientDomain);
    if (mxRecords && mxRecords.length > 0) {
      mxRecords.sort((a, b) => a.priority - b.priority);
      mxHost = mxRecords[0].exchange;
    }
  } catch (err) {
    // Fall back to direct domain if no MX record
    mxHost = recipientDomain;
  }

  // Create direct SMTP transport
  const transporter = nodemailer.createTransport({
    host: mxHost,
    port: 25,
    secure: false,
    tls: { rejectUnauthorized: false },
    name: 'mail.rizzcord.site',
    connectionTimeout: 15000,
  });

  const mailOptions = {
    from: from || 'support@rizzcord.site',
    to,
    subject: subject || '(No Subject)',
    text: text || (html ? html.replace(/<[^>]+>/g, '') : ''),
    html: html || undefined,
    replyTo: replyTo || from || 'support@rizzcord.site',
    headers: {
      'X-Mailer': 'Crown Mail Vault Engine v2.0',
    },
  };

  const result = await transporter.sendMail(mailOptions);
  return result;
}

/**
 * Starts Authenticated Outbound SMTP Submission Server on Port 587
 * Allows other websites (WordPress, Node.js, Python, Laravel) to send transactional emails
 * through mail.rizzcord.site:587 using their Crown API Key as password!
 */
export function startOutboundSmtpServer(port = 587) {
  const server = new SMTPServer({
    disabledCommands: ['STARTTLS'], // Simple unencrypted or TLS-wrapped submission
    authOptional: false,
    size: MAX_MESSAGE_SIZE,
    banner: 'Crown Mail Vault Outbound SMTP Gateway (Port 587)',

    // Authenticate credentials against Crown Vault API keys
    onAuth(auth, session, callback) {
      const apiKey = (auth.password || '').trim();
      const verified = verifyApiKey(apiKey);

      if (verified) {
        return callback(null, { user: verified.name });
      }

      console.warn(`[Outbound SMTP] Auth failed for user: ${auth.username}`);
      return callback(new Error('Authentication failed: Invalid Crown API Key provided as password.'));
    },

    // Accept outbound message and route to remote recipient
    onData(stream, session, callback) {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));

      stream.on('end', async () => {
        try {
          const rawBuffer = Buffer.concat(chunks);
          const parsed = await simpleParser(rawBuffer);

          let recipient = '';
          if (session.envelope && session.envelope.rcptTo && session.envelope.rcptTo.length > 0) {
            recipient = session.envelope.rcptTo[0].address.toLowerCase().trim();
          } else if (parsed.to) {
            const toItem = Array.isArray(parsed.to) ? parsed.to[0] : parsed.to;
            recipient = (toItem.value && toItem.value[0]?.address) || toItem.text || '';
          }

          if (!recipient) {
            return callback(new Error('No valid recipient found in email.'));
          }

          const fromItem = parsed.from?.value?.[0];
          const sender = fromItem?.address || session.envelope?.mailFrom?.address || 'support@rizzcord.site';

          console.log(`\n📤 [OUTBOUND SMTP RELAY] Sending to: ${recipient} | From: ${sender} | Subject: "${parsed.subject}"`);

          // Deliver directly to destination MX
          await sendOutboundMail({
            from: sender,
            to: recipient,
            subject: parsed.subject || '',
            text: parsed.text || '',
            html: parsed.html || parsed.textAsHtml || '',
            replyTo: parsed.replyTo?.value?.[0]?.address || sender,
          });

          console.log(`   ✅ [OUTBOUND DELIVERED] Email successfully transmitted to ${recipient}`);
          callback(null, 'OK: Message delivered');
        } catch (err) {
          console.error('[Outbound SMTP Error]:', err.message);
          callback(new Error(`Delivery error: ${err.message}`));
        }
      });
    },
  });

  server.on('error', (err) => {
    console.warn(`⚠️ [Outbound SMTP Port ${port}]: ${err.message}`);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 [Outbound SMTP Server] Listening on port ${port} (Authenticated via API Key)`);
  });

  return server;
}
