// ============================================================================
// CUSTOM SERVICE WORKER PWA (Maneja notificaciones con navegador cerrado)
// ============================================================================

self.addEventListener('push', (event) => {
  console.log('⚡ [PWA Service Worker]: Evento PUSH recibido en segundo plano.');

  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    data = { title: '🚨 BUAP Asistencia: Aviso Urgente', body: event.data ? event.data.text() : 'Aviso de emergencia de tu especialista.' };
  }

  const title = data.title || '🚨 BUAP Asistencia: Aviso de Emergencia';
  const options = {
    body: data.body || 'Tu tratante ha modificado tu cita.',
    icon: data.icon || '/amati-logo.svg',
    badge: data.badge || '/amati-logo.svg',
    vibrate: [200, 100, 200, 100, 200, 100, 200], // Vibración de emergencia SOS
    requireInteraction: true, // Fuerza a que la notificación en Windows no desaparezca sola hasta que el usuario interactúe
    data: data.data || { url: '/dashboard' },
    actions: [
      { action: 'open', title: '🟢 Abrir Panel de Asistencia' },
      { action: 'dismiss', title: '❌ Enterado / Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('⚡ [PWA Service Worker]: Clic detectado en la notificación de Windows.', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Abrir o enfocar la pestaña del dashboard si el usuario hace clic
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const targetUrl = event.notification.data?.url || '/dashboard';
      
      // Si ya hay una pestaña abierta del sistema, enfocarla
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Si el navegador estaba completamente cerrado, abrir nueva pestaña en Windows
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
