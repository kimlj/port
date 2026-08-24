// POST /api/pitch — receives a pitch from the portfolio contact form and
// forwards it to my inbox via the Brevo transactional email API.
//
// Required env var:  BREVO_API_KEY  (the v3 API key, NOT the SMTP key —
//                                    Brevo issues two different credentials)
// Optional env vars: PITCH_TO       destination inbox
//                    PITCH_FROM     verified Brevo sender, "Name <addr>" or bare address

const TO = process.env.PITCH_TO || 'kljulongbayan@gmail.com';
const FROM = process.env.PITCH_FROM || 'Portfolio Pitch <pitch@kimlj.dev>';

const MAX_IDEA = 4000;
const MIN_IDEA = 15;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Best-effort throttle. Serverless instances are ephemeral and not shared, so
// this only slows down a burst hitting one warm instance — enough for a form
// that legitimately sees a handful of submissions a week.
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 3;
const hits = new Map();

function throttled(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) hits.clear();
  return false;
}

// Brevo wants sender as { name, email }, so split "Kim <a@b.com>" into parts.
function parseSender(value) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value);
  if (m) return { name: m[1] || undefined, email: m[2].trim() };
  return { email: value.trim() };
}

// Cloudflare Turnstile server-side check. Fails OPEN when the secret is not
// configured, so the form keeps working until TURNSTILE_SECRET_KEY is set in
// Vercel; once it is set, a missing or invalid token is rejected.
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('pitch: TURNSTILE_SECRET_KEY not set — skipping Turnstile check.');
    return true;
  }
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token || '', remoteip: ip })
    });
    const d = await r.json().catch(() => ({}));
    return !!d.success;
  } catch (err) {
    console.error('pitch: turnstile verify failed', err);
    return false;
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!process.env.BREVO_API_KEY) {
    console.error('pitch: BREVO_API_KEY is not set');
    return res.status(500).json({ error: 'The form is not configured yet.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: real people never fill a field they cannot see. Answer 200 so
  // bots get no signal that they were caught.
  if (body.company) return res.status(200).json({ ok: true });

  const idea = typeof body.idea === 'string' ? body.idea.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (idea.length < MIN_IDEA) return res.status(400).json({ error: 'Tell me a little more about the idea.' });
  if (idea.length > MAX_IDEA) return res.status(400).json({ error: `Keep it under ${MAX_IDEA} characters.` });
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'That email address is not valid.' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (throttled(ip)) return res.status(429).json({ error: 'Too many pitches in a row — give it a minute.' });

  // Turnstile: reject bots before the Brevo call (which costs a daily-quota email).
  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return res.status(403).json({ error: 'Spam check failed. Please refresh the page and try again.' });
  }

  const preview = idea.replace(/\s+/g, ' ').slice(0, 60);
  const safeIdea = escapeHtml(idea).replace(/\n/g, '<br>');
  const safeEmail = escapeHtml(email);

  try {
    const sent = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({
        sender: parseSender(FROM),
        to: [{ email: TO }],
        replyTo: { email },
        subject: `New pitch from ${email}: ${preview}${idea.length > 60 ? '…' : ''}`,
        textContent: `From: ${email}\n\n${idea}\n\n—\nSent from the pitch form on your portfolio.`,
        htmlContent: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1f">
            <p style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#8a8a95;margin:0 0 16px">New pitch</p>
            <p style="margin:0 0 20px;font-size:14px;color:#5a5a65">
              From <a href="mailto:${safeEmail}" style="color:#0891b2;text-decoration:none">${safeEmail}</a>
            </p>
            <div style="background:#f8f8f6;border:1px solid #e0e0dc;border-radius:12px;padding:20px;font-size:15px;line-height:1.7">${safeIdea}</div>
            <p style="margin:20px 0 0;font-size:12px;color:#8a8a95">Hit reply to answer them directly.</p>
          </div>`
      })
    });

    // Brevo returns 201 Created on success; res.ok covers the whole 2xx range.
    if (!sent.ok) {
      const detail = await sent.text();
      console.error('pitch: brevo responded', sent.status, detail);
      return res.status(502).json({ error: 'Could not send the message right now.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('pitch: request failed', err);
    return res.status(502).json({ error: 'Could not send the message right now.' });
  }
};
