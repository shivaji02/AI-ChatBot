import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8787

app.use(express.json({ limit: '1mb' }))

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

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
  try {
    const { message, doc, selection, action, model } = req.body || {};
    const prompt = selection
      ? buildActionPrompt(String(selection || ''), String(action || ''))
      : `User: ${message || ''}\nDocument context (may be empty):\n${doc || ''}\n\nReply helpfully.`;

    const modelToUse = typeof model === 'string' && model.length > 0 ? model : OLLAMA_MODEL;

    const ollamaResp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: modelToUse,
        prompt,
        stream: true
      })
    });
    if (!ollamaResp.ok) {
      const t = await ollamaResp.text();
      throw new Error('Ollama error: ' + t);
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

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
    res.write(`data: [Mock AI] ${e.message || 'No model available'}\n\n`);
    res.end();
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
