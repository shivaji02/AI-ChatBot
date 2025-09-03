# Local Ollama + React (styled-components) Editor

- Minimal deps: **react**, **styled-components**, **express**, **vite**
- No Tailwind, no heavy editor libs — uses a clean `contenteditable` div
- Floating toolbar on selection: **Shorten / Lengthen / Convert to table**
- Preview modal: **Original vs AI Suggestion** → **Confirm/Cancel**
- Right-side **Chat** with "Apply to editor"

## 1) Requirements
- Node 18+
- Ollama running locally with model `llama3.2`:
  ```bash
  ollama pull llama3.2
  ollama run llama3.2  # (first run downloads weights)
  ```

## 2) Dev run (two processes)
Terminal A:
```bash
npm run dev:server
```
Terminal B:
```bash
npm run dev:client
# open http://localhost:5173
```

(Alternatively) Single command on macOS/Linux:
```bash
npm run dev
```

## 3) Production build + single process serve
```bash
npm run build
npm start
# open http://localhost:8787
```

## 4) Env options
- `OLLAMA_URL` (default `http://127.0.0.1:11434`)
- `OLLAMA_MODEL` (default `llama3.2`)

## Notes
- The server proxies to Ollama via `/api/ai` using `/api/generate` (no streaming). 
- If Ollama is not running, the server returns a harmless mock so the UI still demos.

# Ollama Chat Editor

A simple web-based editor and chat interface powered by local Ollama AI models. This project demonstrates a seamless workflow between AI chat suggestions and a live text editor, with robust controls and error handling.

## Features

- **AI Chat**: Interact with local Ollama models, ask questions, and receive suggestions in real time.
- **Send to Editor**: Instantly transfer AI-generated suggestions from chat to the editor block with a single click.
- **Duplicate Prevention**: Once a suggestion is sent to the editor, it cannot be resent, ensuring a clean and non-repetitive editing experience.
- **Preview Modal**: Compare original and AI-suggested text before confirming changes to the editor.
- **Control Flow**: Pause, stop, or resume AI generation in chat. Only one action is active at a time.
- **Error Handling**: Graceful handling of network and AI errors, with clear feedback in the chat.
- **Fixed Layout**: Editor and chat panes have fixed sizes for a consistent user experience.

## Usage

1. Start the Ollama server and run the client.
2. Type in the editor or chat to interact with the AI.
3. Use the chat controls to manage AI responses.
4. Send suggestions to the editor and preview changes before confirming.

## Technologies
- React
- TypeScript
- Vite
- Styled-components

## Development
- All major UI and logic changes are handled in `src/ui/Chat.tsx`, `src/ui/Editor.tsx`, and `src/ui/PreviewModal.tsx`.
- Control flow and error handling are built-in for a robust user experience.

---

## Deploy to Render (Node server)

Use the included Express server (`server/server.mjs`) to serve the built client and handle `/api/ai` streaming.

1) Create a new Web Service in Render, connect this repo.

2) Environment Variables:
   - `OLLAMA_URL` = reachable Ollama base URL (not localhost)
   - `OLLAMA_MODEL` = optional default (e.g., `llama3.2`)

3) Build & Start Commands:
   - Build: `npm ci && npm run build`
   - Start: `npm start`

Notes:
- The server listens on `process.env.PORT` (Render sets this).
- Static files are served from `dist`, API at `/api/ai` proxies to `OLLAMA_URL` and streams results.
