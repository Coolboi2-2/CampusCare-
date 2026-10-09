import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '@fontsource-variable/inter';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: register the offline app-shell service worker in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((error) => {
    console.error('Service worker registration failed:', error);
  });
}
