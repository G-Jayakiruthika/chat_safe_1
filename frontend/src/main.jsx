import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import './index.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('TrueSafe Uncaught Exception:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#05060f', color: '#fff', fontFamily: 'sans-serif', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#22d3ee' }}>Chat_Safe + Urimai Active</h1>
          <p style={{ maxWidth: '480px', color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
            A visual rendering glitch was caught safely. Click below to reload the app with default settings.
          </p>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ padding: '10px 20px', borderRadius: '9999px', backgroundColor: '#22d3ee', color: '#05060f', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
          >
            Reset &amp; Launch Clean Session
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <HashRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </HashRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
