// POST /api/chat — the site assistant.
//
// THE ENDPOINT HAS NO TOOLS AND MUST NEVER BE GIVEN ANY. It answers from a fixed
// knowledge file assembled in lib/knowledge.js and reaches nothing else: no
// database, no filesystem, no network beyond the one call to Anthropic. That is
// not a limitation to be worked around later, it is the entire design. The worst
// case of a visitor talking their way past every rule in the system prompt is a
// wrong sentence on a portfolio — a copy bug. Give it a tool and the worst case
// becomes a reached system instead.
//
// Required env:  ANTHROPIC_API_KEY
// Optional env:  CHAT_TICKET_SECRET   survives an API key rotation
//                CHAT_HOURLY_USD      rolling spend ceiling, default 1.00

const { buildSystemPrompt, promptSize } = require('../lib/knowledge');
const {
  allowedOrigin,
  clientIp,
  verifyTicket,
  rateLimited,
  ticketExhausted,
  overSpendCap,
  recordSpend,
  spentThisHour,
  SPEND_CAP_USD
} = require('../lib/guards');

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 400;        // the widget is not a general chat client
const MAX_QUESTION = 800;      // characters
const MAX_TURNS = 8;           // last N messages of history the client may send
const API = 'https://api.anthropic.com/v1/messages';

const say = (res, code, error) => res.status(code).json({ error });

function readBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

// The client sends history back each turn — the endpoint is stateless. Trust
// none of its shape: cap the count, cap each entry, and keep only the two roles
// the API accepts, so a crafted history cannot smuggle in a system turn.
function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-MAX_TURNS)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({
      role: m.role,
      content: String(m.content ?? '').slice(0, MAX_QUESTION)
    }))
    .filter((m) => m.content.trim());
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return say(res, 405, 'Method not allowed.');
  }

  res.setHeader('Cache-Control', 'no-store, private');

  if (!allowedOrigin(req)) return say(res, 403, 'Not available from here.');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('chat: ANTHROPIC_API_KEY is not set');
    return say(res, 503, 'The assistant is not configured yet.');
  }

  const body = readBody(req);
  const ip = clientIp(req);

  // Ticket before anything else that costs: no page view, no answer.
  const ticket = verifyTicket(body.ticket, ip);
  if (!ticket.ok) {
    // 401 specifically, so the widget knows to fetch a fresh ticket and retry
    // once rather than showing the reader an error for an expired session.
    return say(res, 401, 'Session expired. Refreshing…');
  }

  if (ticketExhausted(ticket.id)) {
    return say(
      res,
      429,
      'That is as much as I can take in one visit. The form at the bottom of the page reaches Kim directly.'
    );
  }

  if (rateLimited(ip)) {
    return say(res, 429, 'Too many questions at once — give it a moment.');
  }

  // Checked before the call, not displayed after it. A budget that only counts
  // down while it keeps spending is not a budget.
  if (overSpendCap()) {
    console.warn(`chat: hourly spend cap reached ($${spentThisHour().toFixed(3)} / $${SPEND_CAP_USD})`);
    return say(
      res,
      429,
      'The assistant is resting for a bit. The form at the bottom of the page reaches Kim directly.'
    );
  }

  const question = typeof body.message === 'string' ? body.message.trim() : '';
  if (!question) return say(res, 400, 'Ask me something about Kim or his work.');
  if (question.length > MAX_QUESTION) {
    return say(res, 400, `Keep it under ${MAX_QUESTION} characters.`);
  }

  const messages = [...cleanHistory(body.history), { role: 'user', content: question }];

  try {
    const upstream = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // The corpus is ~4.7k tokens and identical on every request, so it is
        // cached. Anything that varies per request must stay after this
        // breakpoint — caching is a prefix match and one changing byte above it
        // would invalidate the whole thing on every single call.
        system: [
          {
            type: 'text',
            text: buildSystemPrompt(),
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages
      })
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error('chat: anthropic responded', upstream.status, detail.slice(0, 500));
      // Upstream status codes are not forwarded: a 401 from Anthropic means our
      // key is wrong, and the widget reads 401 as "my ticket expired".
      return say(res, 502, 'I could not answer that just now. Try again in a moment.');
    }

    const data = await upstream.json();
    recordSpend(data.usage);

    // Refusals arrive as HTTP 200 with no usable content, so stop_reason is
    // checked before content is read.
    if (data.stop_reason === 'refusal') {
      return res.status(200).json({
        reply: 'I am not able to answer that one. Ask me about Kim’s projects or the work on this page.'
      });
    }

    const reply = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (!reply) {
      console.error('chat: empty completion', JSON.stringify(data).slice(0, 400));
      return say(res, 502, 'I could not answer that just now. Try again in a moment.');
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('chat: request failed', err);
    return say(res, 502, 'I could not answer that just now. Try again in a moment.');
  }
};

// Exposed for a quick sanity check: `node -e "console.log(require('./api/chat').promptSize())"`
module.exports.promptSize = promptSize;
