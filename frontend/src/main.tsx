import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// When a dynamic import fails (stale cached HTML after a new deployment),
// automatically reload once to pick up the fresh index.html and new chunks.
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
