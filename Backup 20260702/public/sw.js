self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('message', e => {
  if (e.data?.type !== 'SEND_NOTIFICATION') return;
  const { title, body, icon, tag, requireInteraction } = e.data;
  self.registration.showNotification(title, {
    body,
    icon:             icon || '/icon-192.png',
    badge:            '/icon-192.png',
    tag,
    requireInteraction,
    vibrate:          [200, 100, 200],
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    if (list.length > 0) return list[0].focus();
    return clients.openWindow('/');
  }));
});