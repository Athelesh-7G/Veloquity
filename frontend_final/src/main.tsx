import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initializeDefaultSources } from '@/utils/uploadState'
import './globals.css'

// Must run before render: pages read upload state synchronously during render.
initializeDefaultSources()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
