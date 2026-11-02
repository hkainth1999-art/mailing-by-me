// ==============================================================================
// 🛡️ Crown Mail Vault — High Performance In-Memory Rate Limiter
// ==============================================================================

const stores = new Map();

/**
 * Creates an Express rate-limiting middleware.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (e.g. 60000 = 1 min)
 * @param {number} options.max - Maximum requests allowed per window
 * @param {string} options.message - Error message returned on 429
 * @param {string} options.prefix - Unique bucket name
 */
export function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 60;
  const message = options.message || 'Too many requests. Please slow down and try again.';
  const prefix = options.prefix || 'global';

  if (!stores.has(prefix)) {
    stores.set(prefix, new Map());
  }
  const store = stores.get(prefix);

  // Periodic cleanup of expired IP buckets
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(ip);
      }
    }
  }, 2 * 60 * 1000).unref();

  return function rateLimiterMiddleware(req, res, next) {
    // Bypass rate limit for verified Discord Owners
    if (req.user && req.user.is_owner) {
      return next();
    }

    const rawIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let entry = store.get(rawIp);
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      store.set(rawIp, entry);
    } else {
      entry.count += 1;
    }

    const remaining = Math.max(0, max - entry.count);
    const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > max) {
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        limit: max,
        retryAfter: retryAfterSec,
      });
    }

    next();
  };
}

// Pre-configured rate limiters:
// 1. General API: 120 req/min
export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  prefix: 'api',
  message: 'API rate limit exceeded (120 req/min). Please slow down.',
});

// 2. Mailbox Creation: 12 mailbox creations / 10 mins (anti-spam)
export const createInboxLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
  prefix: 'create-inbox',
  message: 'Mailbox creation rate limit reached (12 per 10 mins). Please wait before generating another mailbox.',
});

// 3. Discord OTP extraction poller: 90 req/min
export const discordOtpLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 90,
  prefix: 'discord-otp',
  message: 'Discord OTP polling rate limit reached (90 req/min).',
});
