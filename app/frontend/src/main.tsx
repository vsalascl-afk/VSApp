import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { loadRuntimeConfig } from './lib/config.ts';
import { initAutoSync } from './lib/syncManager.ts';
import { registerServiceWorker, registerPeriodicSync } from './lib/pushNotifications.ts';

// Load runtime configuration before rendering the app
async function initializeApp() {
  try {
    await loadRuntimeConfig();
    console.log('Runtime configuration loaded successfully');
  } catch (error) {
    console.warn(
      'Failed to load runtime configuration, using defaults:',
      error
    );
  }

  // Initialize offline sync manager
  initAutoSync();

  // Register Service Worker for push notifications
  registerServiceWorker().then((registration) => {
    if (registration) {
      console.log('[App] Service Worker registrado para push notifications');
      // Intentar registrar periodic sync para verificar notificaciones en background
      registerPeriodicSync(15);
    }
  });

  // Render the app
  createRoot(document.getElementById('root')!).render(<App />);
}

// Initialize the app
initializeApp();