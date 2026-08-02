import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { queryClient } from './store/queryClient.js';
import './index.css';

// Restore deep-link path after static 404.html fallback (non-Vercel hosts).
try {
  const spaRedirect = sessionStorage.getItem('spa-redirect');
  if (spaRedirect) {
    sessionStorage.removeItem('spa-redirect');
    if (spaRedirect !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, '', spaRedirect);
    }
  }
} catch {
  /* ignore private-mode storage errors */
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
