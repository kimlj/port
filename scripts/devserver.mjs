// Local harness: serves the real site and runs the real API handlers, with the
// Anthropic call stubbed. Proves ticket -> chat -> render without a key or spend.
//
//   node scripts/devserver.mjs                stubbed upstream, no key needed
//   $env:REAL=1; node scripts/devserver.mjs    live, needs ANTHROPIC_API_KEY
//
// It exists because a plain static server cannot run the API routes: Python's
// http.server answers every POST with 501, which looks exactly like a broken
// endpoint. `vercel dev` also works and is closer to production; this is the
// version that needs no linked project and no key.

import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'noop.js'));

// Deliberately not shaped like a real key — the handlers only check that the
// variable is set, and a realistic-looking placeholder trips secret scanners.
process.env.ANTHROPIC_API_KEY ||= 'local-stub-no-key-needed';
process.env.NODE_ENV = 'development';

// --- stub the upstream ------------------------------------------------------
const realFetch = globalThis.fetch;
let calls = 0;

if (!process.env.REAL) {
  globalThis.fetch = async (url, opts) => {
    if (!String(url).includes('api.anthropic.com')) return realFetch(url, opts);
    calls++;
    const body = JSON.parse(opts.body);
    const q = body.messages[body.messages.length - 1].content;

    // Echo back enough to inspect what the endpoint actually sent upstream.
    const sys = body.system[0];
    console.log(
      `  [upstream #${calls}] model=${body.model} max_tokens=${body.max_tokens} ` +
        `msgs=${body.messages.length} system=${sys.text.length}ch ` +
        `cache=${sys.cache_control ? sys.cache_control.type : 'none'}`
    );

    return {
      ok: true,
      status: 200,
      json: async () => ({
        stop_reason: 'end_turn',
        content: [
          {
            type: 'text',
            text:
              `(stubbed reply) You asked: "${q}". ` +
              `The system prompt carried ${sys.text.length} characters of knowledge.`
          }
        ],
        usage: {
          input_tokens: 12,
          output_tokens: 40,
          cache_read_input_tokens: calls > 1 ? 4700 : 0,
          cache_creation_input_tokens: calls === 1 ? 4700 : 0
        }
      })
    };
  };
}

const chat = require(join(ROOT, 'api/chat.js'));
const ticket = require(join(ROOT, 'api/chat-ticket.js'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf'
};

// Minimal Vercel-shaped req/res over node's own.
function shim(req, res, raw) {
  req.body = raw;
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (o) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(o));
    return res;
  };
  return [req, res];
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = decodeURIComponent(url.pathname);

    if (path === '/api/chat' || path === '/api/chat-ticket') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const handler = path === '/api/chat' ? chat : ticket;
        const [q, s] = shim(req, res, raw);
        Promise.resolve(handler(q, s)).catch((e) => {
          console.error('handler threw', e);
          if (!res.writableEnded) res.status(500).json({ error: 'threw' });
        });
      });
      return;
    }

    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (existsSync(file) && statSync(file).isFile()) {
      res.setHeader('content-type', MIME[extname(file)] || 'application/octet-stream');
      res.end(readFileSync(file));
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  })
  .listen(8137, () => console.log('http://localhost:8137  (upstream: ' + (process.env.REAL ? 'LIVE' : 'stubbed') + ')'));
