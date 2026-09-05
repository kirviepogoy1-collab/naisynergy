// Sends email via Brevo's HTTPS API (not SMTP) - Render's network blocks
// outbound SMTP ports, but regular HTTPS requests aren't affected.
//
// Credentials come from environment variables only - never hardcode them
// here. Set BREVO_API_KEY and BREVO_FROM_EMAIL on the host (e.g. Render's
// Environment tab). BREVO_FROM_EMAIL must be a sender verified in the Brevo
// dashboard (Senders, Domains & Dedicated IPs > Senders) - that only needs a
// one-time confirmation click on an email Brevo sends to that address, no
// DNS access required. If either variable is unset, sendEmail() silently
// no-ops - email is a fallback on top of in-app + push notifications, not a
// hard requirement.

async function sendEmail(to, subject, text) {
    const apiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.BREVO_FROM_EMAIL;
    if (!apiKey || !fromEmail || !to) return;

    try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                sender: { email: fromEmail, name: 'NAI Synergy' },
                to: [{ email: to }],
                subject,
                textContent: text
            })
        });
        if (!res.ok) {
            console.error('Failed to send email:', res.status, await res.text());
        }
    } catch (err) {
        console.error('Failed to send email:', err);
    }
}

module.exports = { sendEmail };
