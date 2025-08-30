// ...existing code...
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App'

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
} else {
  throw new Error("Root element not found");
}
