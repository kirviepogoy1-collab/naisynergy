const webpush = require('web-push');
const pool = require('../config/db');

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

let configured = false;
if (vapidPublicKey && vapidPrivateKey) {
    try {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
        configured = true;
    } catch (err) {
        console.warn('WARNING: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY look malformed - push notifications are disabled.', err.message);
    }
} else {
    console.warn('WARNING: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set - push notifications are disabled.');
}

// Sends a push notification to every subscription on file for one user.
// Silently skips if push isn't configured (missing VAPID keys) - the in-app
// notification bell still works either way, this is purely additive.
async function sendPushToUser(userId, payload) {
    if (!configured) return;

    const [subs] = await pool.query('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId]);
    const body = JSON.stringify(payload);

    for (const sub of subs) {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
        };
        try {
            await webpush.sendNotification(pushSubscription, body);
        } catch (err) {
            // 404/410 means the browser unsubscribed or the endpoint expired -
            // clean it up so we stop wasting sends on it.
            if (err.statusCode === 404 || err.statusCode === 410) {
                await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]).catch(() => {});
            } else {
                console.error('Push send failed:', err.message);
            }
        }
    }
}

// Sends to every user with any of the given roles.
async function sendPushToRoles(roles, payload) {
    if (!configured) return;

    const [users] = await pool.query(
        `SELECT id FROM users WHERE role IN (${roles.map(() => '?').join(',')})`,
        roles
    );
    for (const u of users) {
        await sendPushToUser(u.id, payload);
    }
}

module.exports = { sendPushToUser, sendPushToRoles, vapidPublicKey };
