import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register Service Worker for PWA Installation in Chrome / Android
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[PWA] ServiceWorker registered:', reg.scope))
      .catch((err) => console.log('[PWA] ServiceWorker failed:', err));
  });
}

// A single failed API response or unexpected state shape used to crash the
// whole app with a blank screen. Error boundary keeps the shell alive and
// shows a recoverable message instead.
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#03071E] text-slate-300 p-6 text-center">
          <div className="text-5xl mb-4">🎧</div>
          <h1 className="text-lg font-bold text-white mb-2">Player mengalami kendala</h1>
          <p className="text-sm text-slate-400 max-w-md mb-4">
            Terjadi kesalahan saat merender antarmuka. Muat ulang aplikasi untuk melanjutkan.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-black text-[#FFC107] border-2 border-[#FFC107] hover:bg-[#FFC107]/10"
          >
            Muat Ulang
          </button>
          <pre className="mt-4 text-[10px] text-slate-600 max-w-full overflow-auto whitespace-pre-wrap">
            {String(this.state.error && this.state.error.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)