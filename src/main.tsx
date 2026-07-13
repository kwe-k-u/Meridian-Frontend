// ── Entry Point ─────────────────────────────────────────────
// Mounts the React app inside StrictMode with BrowserRouter for client-side routing.
//
// Note: StrictMode double-invokes every component's render + effects in development
// (mount -> cleanup -> mount again) to surface effects that aren't safe to run twice — this is
// why every ApiService.getX() call inside a plain useEffect fires twice while running `npm run
// dev`. It's dev-only; a production build never does this, and nothing here does a
// create/update/delete on mount, so no duplicate writes happen either way. Kept as-is since the
// double dev-mode GETs are harmless and StrictMode's other checks are worth keeping.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './main.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
