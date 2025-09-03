import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8787

app.use(express.json({ limit: '1mb' }))

// CORS headers for cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  next()
})

const OLLAMA_URL = 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

function sanitizeErrorText(text) {
  try {
    if (!text) return 'Connection error occurred'
    const cleanText = String(text).replace(/<[^>]*>/g, ' ')
    return cleanText.replace(/\s+/g, ' ').trim().slice(0, 200)
  } catch {
    return 'Unable to process request'
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
  // Set up server-sent events for streaming responses
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const { message, doc, selection, action, model } = req.body || {}
    
    const prompt = selection
      ? buildActionPrompt(String(selection || ''), String(action || ''))
      : `User: ${message || ''}\nDocument context: ${doc || ''}\n\nPlease provide a helpful response.`

    const modelToUse = typeof model === 'string' && model.length > 0 ? model : OLLAMA_MODEL
    const upstreamUrl = `${OLLAMA_URL}/api/generate`

    const headers = {
      'content-type': 'application/json',
      'accept': 'application/json',
      'user-agent': 'ollama-chat-editor/1.0'
    }

    const ollamaResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelToUse,
        prompt,
        stream: true
      })
    })

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text().catch(() => '')
      const cleanError = sanitizeErrorText(errorText)
      throw new Error(`Upstream ${ollamaResponse.status} ${ollamaResponse.statusText}: ${cleanError}`)
    }

    const reader = ollamaResponse.body.getReader()
    const decoder = new TextDecoder()
    let done = false

    while (!done) {
      const { value, done: readerDone } = await reader.read()
      if (value) {
        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line)
              if (chunk.response) {
                res.write(`data: ${chunk.response}\n\n`)
              }
            } catch (err) {
              // Skip malformed JSON chunks
            }
          }
        }
      }
      done = readerDone
    }
    res.end()
    
  } catch (error) {
    const message = error?.message ? sanitizeErrorText(error.message) : 'AI service unavailable'
    console.error('[API Error]:', error)
    
    try {
      res.write(`data: [Error] ${message}\n\n`)
      res.end()
    } catch {}
  }
})

// Health check endpoint for monitoring
app.get('/api/ai-ping', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: 'GET',
      headers: { 'accept': 'application/json' }
    })
    const text = await response.text()
    res.json({ 
      ok: response.ok, 
      status: response.status, 
      modelsAvailable: text.length > 0 
    })
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: 'Unable to connect to AI service' 
    })
  }
})

// Serve built frontend in production
const distPath = path.resolve(__dirname, '../dist')
app.use(express.static(distPath))

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`🤖 AI service: ${OLLAMA_URL}`)
  console.log(`📦 Model: ${OLLAMA_MODEL}`)
})
