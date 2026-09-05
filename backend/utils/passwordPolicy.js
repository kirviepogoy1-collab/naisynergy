// Shared password strength rule, used everywhere a password gets set:
// login account creation (superadmin -> HR/inventory staff), HR creating an
// employee account, an employee/HR/staff changing their own password, and
// the "forgot password" reset flow. Keeping it in one place means every one
// of those can't quietly drift out of sync with each other.
//
// Requires: at least 8 characters, with a lowercase letter, an uppercase
// letter, a number, and a symbol - matches the "Strong" tier shown by the
// password strength meter in the UI, so what the meter promises is what's
// actually enforced.
function passwordPolicyError(password) {
    if (!password || password.length < 8) {
        return 'Password must be at least 8 characters.';
    }
    if (!/[a-z]/.test(password)) {
        return 'Password must include at least one lowercase letter.';
    }
    if (!/[A-Z]/.test(password)) {
        return 'Password must include at least one uppercase letter.';
    }
    if (!/[0-9]/.test(password)) {
        return 'Password must include at least one number.';
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        return 'Password must include at least one symbol (e.g. ! @ # $ %).';
    }
    return null;
}

module.exports = { passwordPolicyError };
