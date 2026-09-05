// Service worker for Web Push notifications.
// This runs in the background, separate from the page - it's what lets a
// notification appear even when the site isn't open in a tab.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let data = { title: 'NAI Synergy', body: 'You have a new notification.', url: '/' };
    try {
        data = event.data.json();
    } catch (e) {
        // if the payload isn't JSON for some reason, fall back to the defaults above
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'NAI Synergy', {
            body: data.body || '',
            icon: '/logo.png',
            badge: '/logo.png',
            data: { url: data.url || '/' }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If a tab is already open, focus it and navigate there instead of opening a duplicate
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    if ('navigate' in client) client.navigate(targetUrl);
                    return;
                }
            }
            if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        })
    );
});
