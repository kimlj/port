// Abuse and spend guards for the chat endpoint, and the signed ticket that
// binds a conversation to a page view.
//
// Layered cheapest-first, so an abusive request is refused before it costs
// anything:
//
//   origin allowlist      requests not from our own pages
//   signed ticket         curl-ing the endpoint with no page view
//   per-ticket cap        one page view becoming a thousand questions
//   per-IP rate limit     one client in a loop
//   rolling spend cap     everything above having leaked
//   max_tokens            the widget used as free ChatGPT
//
// WHAT THIS DOES NOT SURVIVE. All state below is in-memory, and a serverless
// instance is ephemeral and not shared. A cold start resets every counter, and a
// flood spread across instances defeats all of it. That makes these real
// protection against one impatient visitor and weak protection against a
// determined one. The two guards that actually close it are not application
// code: a WAF rate limit at the edge (blocked traffic costs nothing at all) and
// a billing alert on the Anthropic account, which is the only guard that
// survives a cold start. Set both.

const crypto = require('crypto');

/* ---------------------------------------------------------------- secrets */

// A ticket secret is required for tickets to survive across instances. Rather
// than fail the whole widget when it is unset, derive a stable one from the API
// key: it is already secret, already present, and identical on every instance,
// so tickets verify everywhere. Setting CHAT_TICKET_SECRET explicitly is still
// better — it lets the key rotate without invalidating live sessions.
function ticketSecret() {
  const explicit = process.env.CHAT_TICKET_SECRET;
  if (explicit) return explicit;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return crypto.createHash('sha256').update(`chat-ticket:${key}`).digest('hex');
}

/* ----------------------------------------------------------------- origin */

// Vercel preview deployments get generated hostnames, so the check is on shape
// rather than an exact list.
const ALLOWED_HOSTS = [/^kimlj\.dev$/, /^www\.kimlj\.dev$/, /^[a-z0-9-]+\.vercel\.app$/];

function allowedOrigin(req) {
  const raw = req.headers.origin || req.headers.referer || '';
  if (!raw) return false;

  let host;
  try {
    host = new URL(raw).hostname;
  } catch {
    return false;
  }

  if (process.env.NODE_ENV !== 'production' && (host === 'localhost' || host === '127.0.0.1')) {
    return true;
  }
  return ALLOWED_HOSTS.some((re) => re.test(host));
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

/* ---------------------------------------------------------------- tickets */

const TICKET_TTL_MS = 2 * 60 * 60 * 1000; // a long read of the page, not a whole day
const TICKET_MAX_MESSAGES = 25;

const b64 = (buf) => Buffer.from(buf).toString('base64url');

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

// The IP is hashed rather than stored: the ticket travels through the browser,
// and a ticket that carries a readable IP is a ticket that leaks one.
function ipTag(ip, secret) {
  return crypto.createHmac('sha256', secret).update(`ip:${ip}`).digest('base64url').slice(0, 16);
}

function issueTicket(ip) {
  const secret = ticketSecret();
  if (!secret) return null;

  const body = b64(
    JSON.stringify({
      v: 1,
      exp: Date.now() + TICKET_TTL_MS,
      ip: ipTag(ip, secret),
      n: crypto.randomBytes(9).toString('base64url')
    })
  );
  return `${body}.${sign(body, secret)}`;
}

function verifyTicket(ticket, ip) {
  const secret = ticketSecret();
  if (!secret) return { ok: false, reason: 'unconfigured' };
  if (typeof ticket !== 'string' || ticket.length > 512) return { ok: false, reason: 'malformed' };

  const dot = ticket.lastIndexOf('.');
  if (dot < 1) return { ok: false, reason: 'malformed' };

  const body = ticket.slice(0, dot);
  const got = ticket.slice(dot + 1);
  const want = sign(body, secret);

  // Constant-time compare. timingSafeEqual throws on a length mismatch, so the
  // lengths are checked first rather than letting it throw.
  if (got.length !== want.length) return { ok: false, reason: 'bad-signature' };
  if (!crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return { ok: false, reason: 'bad-signature' };
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (claims.v !== 1) return { ok: false, reason: 'version' };
  if (!claims.exp || Date.now() > claims.exp) return { ok: false, reason: 'expired' };
  if (claims.ip !== ipTag(ip, secret)) return { ok: false, reason: 'wrong-ip' };

  return { ok: true, id: claims.n, exp: claims.exp };
}

/* ------------------------------------------------------------ rate limits */

// Every counter lives in this one object so that moving to Redis is a change to
// this file and nothing else.
const state = {
  perTicket: new Map(), // ticket id  -> message count
  perIp: new Map(),     // ip         -> timestamps
  spend: []             // [{ at, usd }]
};

const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX_IN_WINDOW = 30;

// A per-IP limit whose false positives are readers and whose true positives are
// already caught by the spend cap behind it would be in the wrong place. This is
// set loose enough that a real conversation never reaches it — it exists to stop
// a script, not to ration a visitor.
function rateLimited(ip) {
  const now = Date.now();
  const recent = (state.perIp.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  if (recent.length >= IP_MAX_IN_WINDOW) return true;

  recent.push(now);
  state.perIp.set(ip, recent);

  if (state.perIp.size > 2000) state.perIp.clear();
  return false;
}

function ticketExhausted(id) {
  const n = (state.perTicket.get(id) || 0) + 1;
  state.perTicket.set(id, n);
  if (state.perTicket.size > 5000) state.perTicket.clear();
  return n > TICKET_MAX_MESSAGES;
}

/* -------------------------------------------------------------- spend cap */

// Claude Haiku 4.5, USD per million tokens. Cache reads are a tenth of the
// input rate, which is most of why the corpus is worth caching.
const PRICE = { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 };

const SPEND_WINDOW_MS = 60 * 60 * 1000;
const SPEND_CAP_USD = Number(process.env.CHAT_HOURLY_USD || 1.0);

function costOf(usage) {
  if (!usage) return 0;
  const m = (n, rate) => ((n || 0) / 1e6) * rate;
  return (
    m(usage.input_tokens, PRICE.input) +
    m(usage.output_tokens, PRICE.output) +
    m(usage.cache_creation_input_tokens, PRICE.cacheWrite) +
    m(usage.cache_read_input_tokens, PRICE.cacheRead)
  );
}

function spentThisHour() {
  const cutoff = Date.now() - SPEND_WINDOW_MS;
  state.spend = state.spend.filter((s) => s.at > cutoff);
  return state.spend.reduce((n, s) => n + s.usd, 0);
}

// A budget that is only displayed is not a budget. This is checked before the
// request goes out, and the endpoint returns 429 rather than spending past it.
function overSpendCap() {
  return spentThisHour() >= SPEND_CAP_USD;
}

function recordSpend(usage) {
  state.spend.push({ at: Date.now(), usd: costOf(usage) });
}

module.exports = {
  allowedOrigin,
  clientIp,
  issueTicket,
  verifyTicket,
  rateLimited,
  ticketExhausted,
  overSpendCap,
  recordSpend,
  spentThisHour,
  costOf,
  TICKET_MAX_MESSAGES,
  SPEND_CAP_USD
};
