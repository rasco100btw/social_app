self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('notification-cache').then((cache) => {
      return cache.addAll([
        '/offline.html',
        '/notification-sounds/notification.mp3'
      ]);
    })
  );
});

self.addEventListener('push', (event) => {
  const notification = event.data.json();
  
  const options = {
    body: notification.content,
    icon: '/notification-icon.png',
    badge: '/notification-badge.png',
    tag: notification.id,
    data: notification,
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'View'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notification.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    const notification = event.notification.data;
    event.waitUntil(
      clients.openWindow(notification.link || '/')
    );
  }
});