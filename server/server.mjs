import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8787

app.use(express.json({ limit: '1mb' }))

// Upstream Ollama base URL (use env in production; default local for dev)
// const OLLAMA_URL = 'https://f769b932c933.ngrok-free.app'

// Updated Ollama URL to use the Cloudflare tunnel
const OLLAMA_URL = 'https://bulk-solaris-terrace-type.trycloudflare.com';

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

function sanitizeErrorText(t) {
  try {
    if (!t) return 'Unknown error';
    const noHtml = String(t).replace(/<[^>]*>/g, ' ');
    return noHtml.replace(/\s+/g, ' ').trim().slice(0, 240);
  } catch {
    return 'Unknown error';
  }
}

function buildActionPrompt(selection, action) {
  if (action === 'shorten') {
    return `Rewrite the following text to be shorter while preserving meaning. Return only the revised text.\n\n${selection}`
  }
  if (action === 'lengthen') {
    return `Expand the following text with clear detail and smooth flow. Return only the revised text.\n\n${selection}`
  }
  if (action === 'table') {
    return `Convert the following into a simple Markdown table with headers when obvious. Return only the table.\n\n${selection}`
  }
  return `Improve clarity and grammar. Return only the revised text.\n\n${selection}`
}

app.post('/api/ai', async (req, res) => {
  // Always establish SSE so clients consistently stream, even on errors.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
  try {
    const { message, doc, selection, action, model } = req.body || {};
    const prompt = selection
      ? buildActionPrompt(String(selection || ''), String(action || ''))
      : `User: ${message || ''}\nDocument context (may be empty):\n${doc || ''}\n\nReply helpfully.`;

    const modelToUse = typeof model === 'string' && model.length > 0 ? model : OLLAMA_MODEL;

    const upstreamUrl = `${OLLAMA_URL}/api/generate`;

    // Build headers with optional basic auth from OLLAMA_URL credentials
    const upstreamHeaders = {
      'content-type': 'application/json',
      'accept': 'application/json',
      'user-agent': 'ollama-chat-editor/1.0',
      'ngrok-skip-browser-warning': 'true'
    };
    try {
      const u = new URL(OLLAMA_URL);
      if (u.username || u.password) {
        const token = Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString('base64');
        upstreamHeaders['authorization'] = `Basic ${token}`;
      }
    } catch {}

    const ollamaResp = await fetch(upstreamUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify({
        model: modelToUse,
        prompt,
        stream: true
      })
    });
    if (!ollamaResp.ok) {
      const t = await ollamaResp.text().catch(() => '');
      const clean = sanitizeErrorText(t);
      throw new Error(`Upstream ${ollamaResp.status} ${ollamaResp.statusText} @ ${upstreamUrl} :: ${clean}`);
    }

    const reader = ollamaResp.body.getReader();
    let decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      if (value) {
        // Ollama streams JSON objects per line
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line);
              if (chunk.response) {
                res.write(`data: ${chunk.response}\n\n`);
              }
            } catch (err) {
              // Ignore parse errors for incomplete lines
            }
          }
        }
      }
      done = readerDone;
    }
    res.end();
  } catch (e) {
    // Safe fallback so UI remains usable even if Ollama is down.
    const msg = e && e.message ? sanitizeErrorText(e.message) : 'No model available';
    console.error('[API /api/ai] Error:', e);
    try {
      res.write(`data: [Error] ${msg}\n\n`);
    } catch {}
    try { res.end(); } catch {}
  }
});

// Simple upstream connectivity check (useful on Render)
app.get('/api/ai-ping', async (req, res) => {
  try {
    const headers = {
      'accept': 'application/json',
      'user-agent': 'ollama-chat-editor/1.0',
      'ngrok-skip-browser-warning': 'true'
    };
    try {
      const u = new URL(OLLAMA_URL);
      if (u.username || u.password) {
        const token = Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString('base64');
        headers['authorization'] = `Basic ${token}`;
      }
    } catch {}
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { method: 'GET', headers });
    const text = await r.text();
    res.json({ ok: r.ok, status: r.status, length: text.length, preview: text.slice(0, 200) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// In production, serve the built client from /dist
const dist = path.resolve(__dirname, '../dist')
app.use(express.static(dist))
app.get('*', (req, res2) => {
  res2.sendFile(path.join(dist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}  (Proxy to Ollama: ${OLLAMA_URL}, model: ${OLLAMA_MODEL})`)
})
