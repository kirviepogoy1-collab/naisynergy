// Simple 5-point checklist: length, lowercase, uppercase, number, symbol.
// Score maps to a 3-tier label rather than exposing the raw number, since
// "3 out of 5" means less to someone typing a password than "Medium" does.
export function getPasswordStrength(password) {
    const criteria = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password)
    };
    const score = Object.values(criteria).filter(Boolean).length;

    let label = 'Poor';
    if (score >= 5) label = 'Strong';
    else if (score >= 3) label = 'Medium';

    return { score, label, criteria };
}
