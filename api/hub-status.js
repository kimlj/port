// GET /api/hub-status — one payload for the hub page: whether each service I run
// is answering, and the WordWarz figures.
//
// The page calls this and nothing else. That is deliberate:
//
//   - CSP on this site is `connect-src 'self'`. A page fetching api.wordwarz.io
//     directly would need that widened and would need CORS opened on the game
//     server, so two hardened things would have been loosened to save one hop.
//   - The game's stats route is token-gated. The token lives in this function's
//     environment and is never sent to a browser, which is the whole reason the
//     hop exists.
//   - A dead upstream becomes a red dot here instead of a hanging fetch there.
//
// Required env:  HUB_STATS_TOKEN    matches HUB_STATS_TOKEN on the game server
// Optional env:  HUB_OPERATOR_KEY   unlocks the live figures, see below

const { allowedOrigin, clientIp, rateLimited } = require('../lib/guards');

// Probes. A health URL answers without credentials and says nothing about
// anybody; a dashboard is probed at its document root because a static page has
// no health route and serving its HTML is the whole of its job.
const SERVICES = [
  {
    id: 'wordwarz-api',
    name: 'WordWarz API',
    group: 'WordWarz',
    url: 'https://api.wordwarz.io/health',
    note: 'game server, Socket.IO + SQLite'
  },
  {
    id: 'wordwarz-dash',
    name: 'WordWarz dashboard',
    group: 'WordWarz',
    url: 'https://dashboard.wordwarz.io/',
    note: 'analytics, admin only'
  },
  {
    id: 'mdspro-api',
    name: 'MDS Pro API',
    group: 'MDS Pro',
    url: 'https://mdspro.kimlj.dev/api/health',
    note: 'Fastify + Supabase, 15 daily users'
  },
  {
    id: 'mdspro-dash',
    name: 'MDS Pro dashboard',
    group: 'MDS Pro',
    url: 'https://dashboard.mdsprosolutions.com/',
    note: 'timekeeping, payroll, billing'
  }
];

const PROBE_TIMEOUT_MS = 4000;

// Answering, but slowly enough that a reader should be told. The droplet
// normally replies in well under 300ms from Vercel, so this is not a tight
// threshold - it is the point where something is actually wrong.
const SLOW_MS = 1500;

const CACHE_TTL_MS = 30 * 1000;

// Module scope, so it lives as long as the warm instance and no longer. Vercel
// gives every instance its own copy and may run several, so this thins out
// repeat polling from one reader rather than guaranteeing any global rate. The
// upstreams are cheap and cached themselves; this is politeness, not a limit.
let cache = { at: 0, key: '', body: null };

async function withTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

// Never returns the upstream's body or error text. A 500 page can carry a stack
// trace, a hostname or a query, and this response is served to a browser.
async function probe(service) {
  const started = Date.now();
  try {
    const res = await withTimeout(service.url, { method: 'GET' });
    const latencyMs = Date.now() - started;
    const ok = res.ok;
    return {
      id: service.id,
      name: service.name,
      group: service.group,
      note: service.note,
      state: !ok ? 'down' : latencyMs > SLOW_MS ? 'degraded' : 'up',
      httpStatus: res.status,
      latencyMs
    };
  } catch (err) {
    return {
      id: service.id,
      name: service.name,
      group: service.group,
      note: service.note,
      state: 'down',
      httpStatus: null,
      latencyMs: Date.now() - started,
      // A timeout and a refused connection are different problems and the
      // distinction survives into the UI, but neither carries message text.
      reason: err.name === 'AbortError' ? 'timeout' : 'unreachable'
    };
  }
}

async function fetchWordWarzStats() {
  const token = process.env.HUB_STATS_TOKEN;
  if (!token) return { error: 'unconfigured' };
  try {
    const res = await withTimeout('https://api.wordwarz.io/api/hub/stats', {
      headers: { 'X-Hub-Token': token }
    });
    // The game server answers a bad token with 404 rather than 401, so a
    // stranger cannot tell the route exists. Translated back here, where the
    // distinction is useful, because the two have different fixes: a rejected
    // token is a mismatched env var, a 503 is a server with none set at all.
    if (!res.ok) return { error: res.status === 404 ? 'rejected' : 'http_' + res.status };
    return await res.json();
  } catch (err) {
    return { error: err.name === 'AbortError' ? 'timeout' : 'unreachable' };
  }
}

// The droplet's own reading of itself.
//
// NOT SSH from here. A Vercel function holding a key that opens a root shell on
// a production box is a far larger thing than one holding a token that fetches
// a JSON document, and the difference shows up the day the env var leaks: one
// is a stranger reading numbers, the other is a stranger on the machine. The
// agent on the droplet runs read-only commands and serves the result; this
// fetches it. The hub stays a thing that reports and never acts, which is the
// property the whole panel is arguing for.
//
// Fails closed. With neither variable set the panel keeps its dated snapshot
// and says so, which is the honest state and not an error.
async function fetchVpsStats() {
  const url = process.env.HUB_VPS_URL;
  const token = process.env.HUB_VPS_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await withTimeout(url, { headers: { 'X-Hub-Token': token } });
    if (!res.ok) return null;
    const body = await res.json();
    // An allowlist, for the reason the game's one is: the agent's payload is
    // the thing most likely to grow, and a denylist would publish whatever was
    // added to it next. No paths, no addresses, no process lists, no log lines.
    const host = body.host || {};
    return {
      generatedAt: typeof body.generatedAt === 'string' ? body.generatedAt : new Date().toISOString(),
      host: {
        name: host.name,
        os: host.os,
        virt: host.virt,
        uptimeDays: host.uptimeDays,
        cpu: host.cpu ? { vcpu: host.cpu.vcpu, model: host.cpu.model } : undefined,
        ram: host.ram ? { usedMb: host.ram.usedMb, totalMb: host.ram.totalMb } : undefined,
        disk: host.disk ? { usedGb: host.disk.usedGb, totalGb: host.disk.totalGb } : undefined
      },
      security: body.security ? { fail2ban: body.security.fail2ban, sshKeyOnly: body.security.sshKeyOnly, blocked: body.security.blocked, banned: body.security.banned } : undefined,
      services: Array.isArray(body.services)
        ? body.services.slice(0, 20).map((s) => ({ name: s.name, port: s.port, state: s.state }))
        : undefined
    };
  } catch (err) {
    return null;
  }
}

// What a stranger may read.
//
// An ALLOWLIST, like the query upstream and for the same reason: the game
// server's payload is the thing most likely to grow, and a denylist here would
// publish whatever was added to it next. A field the owner has not decided
// about does not reach a browser.
//
// The line is drawn around what the work looks like from outside rather than
// around what is sensitive - none of this is sensitive, it is a word game. The
// audience, conversion and platform figures are the argument the page is making
// (people came back, 39% of installs reached a game, 8% attached an identity),
// and they are the half worth showing to somebody deciding whether to read
// further. What stays behind the unlock is the half that only means anything if
// you are running it: the solve rate, the guess distribution, the openers, the
// lobby-size curve, how long a solve takes. Those are operational, they invite
// questions about game balance rather than about engineering, and on a screen
// share they are where a walkthrough loses its thread.
//
// `maintenance` is operator-only for a different reason: it announces a window
// in which the service can be expected to misbehave, and that is a thing to say
// deliberately rather than to publish on a 30-second poll.
const PUBLIC_FIELDS = [
  // Headline.
  'playersLifetime', 'playersToday', 'games', 'rounds',
  // Audience and conversion. Each rate travels with its numerator and
  // denominator, because a rate on its own hides which of the two moved.
  'playersSignedIn', 'playersWeek', 'playersMonth', 'playersReturning',
  'devicesTotal', 'displayNames', 'playRate', 'signInRate',
  // Shape of the audience, not of the game.
  'gamesByMode', 'elo', 'platforms',
  // Live and time series.
  'live', 'ccu', 'ccuSince', 'ccuSamplerStart', 'peak24h',
  'gamesPerDay', 'dailyPlayers', 'recentGames',
  'generatedAt'
];

function publicProjection(stats) {
  if (!stats || stats.error) return { error: (stats && stats.error) || 'unavailable' };
  const out = {};
  for (const field of PUBLIC_FIELDS) {
    if (stats[field] !== undefined) out[field] = stats[field];
  }
  return out;
}

function constantTimeEquals(given, expected) {
  if (typeof given !== 'string' || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// An unguessable URL would not do here: this page gets shown on a screen
// recording, so its address is public the moment it is used for what it is for.
// A key in a cookie survives that - the address bar shows /hub and nothing else.
function isOperator(req) {
  const key = process.env.HUB_OPERATOR_KEY;
  if (!key) return false;
  const cookie = req.headers.cookie || '';
  const match = /(?:^|;\s*)hub_op=([^;]+)/.exec(cookie);
  if (!match) return false;
  let given;
  try {
    given = decodeURIComponent(match[1]);
  } catch {
    return false;
  }
  return constantTimeEquals(given, key);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // The same origin gate the assistant uses. It stops a page on another site
  // from reading this; it does not stop curl, and is not asked to - everything
  // in the public projection is already on the portfolio in prose.
  if (!allowedOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  const ip = clientIp(req);
  if (rateLimited(ip)) return res.status(429).json({ error: 'Slow down' });

  // Unlock: /hub?key=... once, before recording. The key is stored HttpOnly so
  // the page's own scripts cannot read it back out, and no reply ever echoes it.
  const operatorKey = process.env.HUB_OPERATOR_KEY;
  const offered = typeof (req.query && req.query.key) === 'string' ? req.query.key : null;
  const offeredValid = Boolean(offered && operatorKey && constantTimeEquals(offered, operatorKey));

  if (offeredValid) {
    res.setHeader(
      'Set-Cookie',
      'hub_op=' + encodeURIComponent(operatorKey) +
        '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + 60 * 60 * 24 * 30
    );
  }

  const operator = offeredValid || isOperator(req);

  const now = Date.now();
  const cacheKey = operator ? 'operator' : 'public';
  if (cache.body && cache.key === cacheKey && now - cache.at < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'private, max-age=15');
    return res.status(200).json(cache.body);
  }

  // All probes at once. Four sequential 4s timeouts is a 16 second page load on
  // the day everything is down, which is the day it most needs to render.
  const [services, stats, vps] = await Promise.all([
    Promise.all(SERVICES.map(probe)),
    fetchWordWarzStats(),
    fetchVpsStats()
  ]);

  const body = {
    generatedAt: new Date(now).toISOString(),
    operator: Boolean(operator),
    services,
    wordwarz: operator
      ? (stats.error ? { error: stats.error } : stats)
      : publicProjection(stats),
    // Absent rather than null when the agent is not configured or did not
    // answer, so the panel falls back to its dated snapshot instead of
    // painting a live-looking row of em dashes.
    ...(vps ? { vps } : {})
  };

  cache = { at: now, key: cacheKey, body };
  res.setHeader('Cache-Control', 'private, max-age=15');
  return res.status(200).json(body);
};
