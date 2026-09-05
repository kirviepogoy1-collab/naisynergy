// The one place that maps a role to where they land after logging in.
// Both App.jsx (for the "/" redirect) and Login.jsx (for the post-login
// redirect) import this - previously each had its own separate copy, and
// adding inventory_viewer to only one of them meant that role could log in
// successfully but never actually get redirected anywhere.
export const HOME_BY_ROLE = {
    superadmin: '/superadmin',
    hr_staff: '/hr',
    inventory_staff: '/inventory',
    inventory_viewer: '/inventory',
    employee: '/employee'
};
