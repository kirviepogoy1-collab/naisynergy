import api from '../api/axios';

export function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Web Push wants the VAPID key as a Uint8Array, not the base64 string the server gives us
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// Returns 'granted' | 'denied' | 'unsupported' | 'error'
export async function enablePushNotifications() {
    if (!isPushSupported()) return 'unsupported';

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return 'denied';

        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const { data } = await api.get('/push/vapid-public-key');

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.publicKey)
        });

        await api.post('/push/subscribe', subscription.toJSON());
        return 'granted';
    } catch (err) {
        console.error('Failed to enable push notifications:', err);
        return 'error';
    }
}

export async function getPushPermissionState() {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission; // 'granted' | 'denied' | 'default'
}
