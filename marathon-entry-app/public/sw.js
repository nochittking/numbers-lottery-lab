// Service Worker — プッシュ通知の受信と表示
self.addEventListener('push', (event) => {
  let data = { title: '🏃 RaceEntry Navi', body: '', url: null };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    data.body = event.data?.text() ?? '';
  }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    data: { url: data.url },
    lang: 'ja',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
