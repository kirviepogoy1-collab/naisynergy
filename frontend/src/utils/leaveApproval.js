import Swal from 'sweetalert2';
import api from '../api/axios';

// Shared "approve this leave" flow: asks HR to pick With Pay / Without Pay
// (warning if it exceeds the employee's remaining balance), then warns if the
// approving HR user has no e-signature on file yet. Used by every screen that
// can approve a leave (Leave Applications page, HR Dashboard, Employee Profile
// modal) so none of them can silently approve with a null pay status.
//
// "Absent" is a special case: it's unpaid by definition, so approving one
// skips the With Pay/Without Pay prompt entirely and always records it as
// "without pay". This also keeps it consistent with the attendance summary,
// which colors a leave-covered day red/absent only when pay_status is
// "without pay" - without this, an "Absent"-type request approved as "With
// Pay" would show as a green "excused" day despite its name.
//
// Returns the chosen pay_status ('with pay' | 'without pay'), or null if the
// person cancelled - callers should skip the approval call in that case.
export async function confirmLeaveApproval(leave) {
    // remaining_balance is null for uncapped leave types (set server-side by
    // getRemainingBalance) - whether a type is capped is now HR-configurable,
    // so this is the only reliable signal, not a hardcoded type list.
    const exceeds = leave.remaining_balance !== null && leave.remaining_balance !== undefined &&
        leave.total_days > leave.remaining_balance;

    let payStatus;
    if (leave.leave_type === 'Absent') {
        const confirm = await Swal.fire({
            title: 'Approve as Absent (Without Pay)?',
            text: `${leave.employee_name}'s "Absent" request will be approved and recorded as Without Pay - that's what makes it count as absent in the attendance summary.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Approve',
            cancelButtonText: 'Cancel'
        });
        if (!confirm.isConfirmed) return null;
        payStatus = 'without pay';
    } else {
        const { value, isDismissed } = await Swal.fire({
            title: 'Approve leave request',
            html: exceeds
                ? `<p class="text-red-600 text-sm mb-2">This request (${leave.total_days} day(s)) exceeds ${leave.employee_name}'s remaining balance of ${leave.remaining_balance} day(s).</p><p class="text-sm">Choose how to record it:</p>`
                : `<p class="text-sm">Choose a pay status for this approval:</p>`,
            icon: exceeds ? 'warning' : 'question',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'With Pay',
            denyButtonText: 'Without Pay',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) return { value: 'with pay', isDismissed: false };
            if (result.isDenied) return { value: 'without pay', isDismissed: false };
            return { value: null, isDismissed: true };
        });
        if (isDismissed || !value) return null;
        payStatus = value;
    }

    const { data: myProfile } = await api.get('/profile');
    if (!myProfile.hr_signature_path) {
        const confirm = await Swal.fire({
            title: 'No signature on file',
            text: "You haven't uploaded an e-signature yet. It will show as blank on this decision. Continue anyway?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Continue without signature',
            cancelButtonText: 'Cancel'
        });
        if (!confirm.isConfirmed) return null;
    }

    return payStatus;
}
