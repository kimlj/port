// POST /api/chat-ticket — hands the page a short-lived signed ticket.
//
// The chat endpoint answers a ticket, not a URL. Someone who finds /api/chat and
// posts to it directly has no ticket and gets a 401; someone who loaded the page
// has one, bound to their IP and good for a couple of hours. It is not
// authentication — there is nobody to authenticate — it is the difference
// between spending money on this page's readers and spending it on anyone who
// read the network tab.
//
// Nothing here calls the model, so this route is free to serve.

const { allowedOrigin, clientIp, issueTicket, TICKET_MAX_MESSAGES } = require('../lib/guards');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!allowedOrigin(req)) {
    return res.status(403).json({ error: 'Not available from here.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('chat-ticket: ANTHROPIC_API_KEY is not set');
    return res.status(503).json({ error: 'The assistant is not configured yet.' });
  }

  const ticket = issueTicket(clientIp(req));
  if (!ticket) {
    console.error('chat-ticket: no ticket secret available');
    return res.status(503).json({ error: 'The assistant is not configured yet.' });
  }

  // A ticket is per-visitor and short-lived, so it must not be cached by the CDN
  // and handed to somebody else.
  res.setHeader('Cache-Control', 'no-store, private');

  return res.status(200).json({ ticket, messageLimit: TICKET_MAX_MESSAGES });
};
