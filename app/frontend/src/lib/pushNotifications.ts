// Push Notifications Manager - Service Worker Registration & Push API

const SW_PATH = '/sw.js';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Registra el Service Worker si no está registrado
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Push] Service Workers no soportados en este navegador');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: '/',
    });

    // Esperar a que el SW esté activo
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        registration.installing!.addEventListener('statechange', (e) => {
          if ((e.target as ServiceWorker).state === 'activated') resolve();
        });
      });
    }

    console.log('[Push] Service Worker registrado:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[Push] Error registrando Service Worker:', error);
    return null;
  }
}

/**
 * Solicita permiso de notificaciones al usuario
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[Push] Notifications API no soportada');
    return 'denied';
  }

  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Muestra una notificación push nativa a través del Service Worker
 * Funciona incluso cuando la app está en background o cerrada (si el SW está activo)
 */
export async function showPushNotification(
  title: string,
  body: string,
  options?: {
    tag?: string;
    url?: string;
    requireInteraction?: boolean;
  }
): Promise<boolean> {
  // Verificar permiso
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  try {
    // Método 1: Usar Service Worker registration.showNotification (preferido)
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, {
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: options?.tag || `elecdata-${Date.now()}`,
          vibrate: [200, 100, 200],
          requireInteraction: options?.requireInteraction ?? true,
          data: { url: options?.url || '/' },
        });
        return true;
      }
    }

    // Método 2: Enviar mensaje al SW para que muestre la notificación
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        body,
        tag: options?.tag || `elecdata-${Date.now()}`,
        url: options?.url || '/',
      });
      return true;
    }

    // Fallback: Notification API directa (solo funciona con app abierta)
    new Notification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: options?.tag || 'elecdata-alert',
    });
    return true;
  } catch (error) {
    console.error('[Push] Error mostrando notificación:', error);
    return false;
  }
}

/**
 * Obtiene la suscripción push actual o crea una nueva
 * (Para uso futuro con servidor de push real)
 */
export async function subscribeToPush(
  vapidPublicKey?: string
): Promise<PushSubscription | null> {
  if (!vapidPublicKey) {
    console.warn('[Push] No se proporcionó VAPID public key, push del servidor no disponible');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Verificar suscripción existente
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) return subscription;

    // Crear nueva suscripción
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    console.log('[Push] Suscripción push creada:', subscription.endpoint);
    return subscription;
  } catch (error) {
    console.error('[Push] Error suscribiendo a push:', error);
    return null;
  }
}

/**
 * Configura listener para mensajes del Service Worker
 */
export function onServiceWorkerMessage(
  callback: (data: { type: string; [key: string]: unknown }) => void
): () => void {
  if (!('serviceWorker' in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data) callback(event.data);
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

/**
 * Registra Periodic Background Sync para verificar notificaciones periódicamente
 */
export async function registerPeriodicSync(intervalMinutes: number = 15): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    // @ts-expect-error periodicSync is not in standard TS types but supported in Chromium
    if (registration.periodicSync) {
      // @ts-expect-error periodicSync register method not in standard types
      await registration.periodicSync.register('check-notifications', {
        minInterval: intervalMinutes * 60 * 1000,
      });
      console.log('[Push] Periodic sync registrado cada', intervalMinutes, 'minutos');
      return true;
    }
  } catch (error) {
    console.warn('[Push] Periodic Background Sync no soportado:', error);
  }
  return false;
}

// Utilidad: Convierte VAPID key de base64 a Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}