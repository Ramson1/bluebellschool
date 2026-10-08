// Shared role helpers for new feature pages.
// Existing pages keep their inline checks; new pages should use these.
// Tables: bluebell_userauth (admin), bluebell_teacherauth (teacher), devauth (developer),
// bluebell_secretaryauth (secretary — read-only dashboard access).

// Built-in developer accounts — always treated as developer even if the
// devauth table is missing or does not contain them yet.
export const DEV_EMAILS = [
  'blackboxinfo01@gmail.com',
];

// The ultimate super_admin. Only this account may disable/enable other admin
// or super_admin accounts, and this account can never itself be disabled.
export const OWNER_EMAIL = 'blackboxinfo01@gmail.com';

const norm = (e) => (e || '').toLowerCase();

export async function fetchAuthRoles(supabase) {
  const [adminRes, teacherRes, devRes, secretaryRes, disabledRes] = await Promise.allSettled([
    supabase.from('bluebell_userauth').select('email'),
    supabase.from('bluebell_teacherauth').select('email'),
    supabase.from('devauth').select('email'),
    // table may not exist until platform_staff_management_setup.sql runs —
    // allSettled keeps a failure here harmless (resolves to [])
    supabase.from('bluebell_secretaryauth').select('email'),
    // suspended accounts registry (bluebell_disabled_accounts_setup.sql) — a
    // missing table resolves to [] so access is never accidentally blocked
    supabase.from('bluebell_disabled_accounts').select('email'),
  ]);

  const unwrap = (res) =>
    res.status === 'fulfilled' && !res.value.error ? (res.value.data || []) : [];

  const devEmails = unwrap(devRes).map((r) => r.email);
  return {
    adminEmails: unwrap(adminRes).map((r) => r.email),
    teacherEmails: unwrap(teacherRes).map((r) => r.email),
    secretaryEmails: unwrap(secretaryRes).map((r) => r.email),
    // merge fallback developer emails (deduped, case-insensitive)
    devEmails: [...new Set([...devEmails, ...DEV_EMAILS].map(norm))],
    // emails the owner has suspended — every role helper below treats a
    // disabled email as having NO role (the owner can never be disabled)
    disabledEmails: [...new Set(unwrap(disabledRes).map((r) => norm(r.email)))],
  };
}

// A disabled email loses every role, except the ultimate owner which is
// always allowed through (defensive: the owner is never written to the table).
const isDisabled = (email, disabledEmails = []) =>
  !!email && norm(email) !== norm(OWNER_EMAIL) && (disabledEmails || []).map(norm).includes(norm(email));

export const isAdmin = (email, adminEmails = [], disabledEmails = []) =>
  !!email && !isDisabled(email, disabledEmails) && adminEmails.includes(email);

export const isTeacher = (email, teacherEmails = [], disabledEmails = []) =>
  !!email && !isDisabled(email, disabledEmails) && teacherEmails.includes(email);

export const isSecretary = (email, secretaryEmails = [], disabledEmails = []) =>
  !!email && !isDisabled(email, disabledEmails) && secretaryEmails.map(norm).includes(norm(email));

export const isDev = (email, devEmails = [], disabledEmails = []) =>
  !!email && !isDisabled(email, disabledEmails) &&
  (DEV_EMAILS.map(norm).includes(norm(email)) || devEmails.map(norm).includes(norm(email)));

// Any staff member allowed into the attendance taker
export const canTakeAttendance = (email, { adminEmails = [], teacherEmails = [], devEmails = [] } = {}) =>
  isAdmin(email, adminEmails) || isTeacher(email, teacherEmails) || isDev(email, devEmails);

// Staff attendance management: admin + dev only (teachers must NOT see it)
export const canManageStaffAttendance = (email, { adminEmails = [], devEmails = [] } = {}) =>
  isAdmin(email, adminEmails) || isDev(email, devEmails);
