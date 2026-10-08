// Server-only helpers for privileged API routes (staff/student account
// provisioning). The service-role key MUST NEVER reach the browser — it is
// read from process.env here and used exclusively inside route handlers that
// first verify the caller is a signed-in admin/developer.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Mirrors DEV_EMAILS in src/utils/authUtils.js (server copy — keep in sync)
const DEV_EMAILS = ['blackboxinfo01@gmail.com'];

// The ultimate super_admin — the only account allowed to disable/enable other
// admin or super_admin accounts. Mirrors OWNER_EMAIL in authUtils.js.
export const OWNER_EMAIL = 'blackboxinfo01@gmail.com';

// Emails the owner has suspended (bluebell_disabled_accounts). A missing table is
// treated as empty so access is never accidentally blocked by a DDL that has
// not run yet. Read via roleClient because RLS hides the rows from anon.
async function fetchDisabledEmails(): Promise<Set<string>> {
  try {
    const { data } = await roleClient().from('bluebell_disabled_accounts').select('email');
    return new Set((data || []).map((r: { email?: string }) => (r.email || '').toLowerCase()));
  } catch {
    return new Set();
  }
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function serviceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server');
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Client for server-side ROLE/DISABLED-email reads. RLS hides bluebell_userauth,
// devauth and bluebell_disabled_accounts rows from the anon role (an anon SELECT
// returns [] even though rows exist), which made requireAdminCaller reject
// every non-developer admin with 401. The service-role key sees the real rows
// and this file only ever runs server-side, never in the browser bundle.
function roleClient(): SupabaseClient {
  try {
    return serviceClient();
  } catch {
    // No service key configured: fall back to anon rather than throwing, so
    // role checks fail the same way they used to instead of crashing routes.
    return anonClient();
  }
}

// Resolve the caller from the Authorization bearer token the browser app
// sends (fetch with headers: { Authorization: `Bearer ${session.access_token}` }).
export async function getCaller(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = anonClient();
  // getUser(jwt) validates an explicit token server-side (no session storage)
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export interface CallerCheck {
  user: User;
  email: string;
  isAdmin: boolean;
  isDev: boolean;
}

// Admin or developer only — used by staff/student account provisioning routes.
// A suspended (disabled) account is rejected here too, so privileged writes
// stop working the moment the owner disables it.
export async function requireAdminCaller(request: Request): Promise<CallerCheck | null> {
  const user = await getCaller(request);
  if (!user) return null;
  const email = (user.email || user.user_metadata?.email || '').toLowerCase();
  if (!email) return null;

  if (email !== OWNER_EMAIL) {
    const disabled = await fetchDisabledEmails();
    if (disabled.has(email)) return null;
  }

  const client = roleClient();
  const isDev = DEV_EMAILS.includes(email);

  let isAdmin = false;
  if (!isDev) {
    const { data } = await client.from('bluebell_userauth').select('email');
    isAdmin = !!data?.some((r: { email?: string }) => (r.email || '').toLowerCase() === email);
    if (!isAdmin) {
      // devauth table may also hold additional developers (never fatal)
      try {
        const { data: dev } = await client.from('devauth').select('email');
        isAdmin = !!dev?.some((r: { email?: string }) => (r.email || '').toLowerCase() === email);
      } catch {
        /* ignore */
      }
    }
  } else {
    isAdmin = true; // developers oversee everything
  }

  if (!isAdmin) return null;
  return { user, email, isAdmin, isDev: isDev || isAdmin };
}

// The ultimate super_admin ONLY — used by the access-control route that lets
// blackboxinfo01@gmail.com disable/enable other admin & super_admin accounts.
// Hard-gated on the exact owner email; no other admin or developer passes.
export async function requireSuperOwner(request: Request): Promise<{ user: User; email: string } | null> {
  const user = await getCaller(request);
  if (!user) return null;
  const email = (user.email || user.user_metadata?.email || '').toLowerCase();
  if (email !== OWNER_EMAIL) return null;
  return { user, email };
}

// DEVELOPER (super_admin) ONLY — a strictly narrower gate than
// requireAdminCaller. Note that requireAdminCaller reports `isDev: isDev || isAdmin`
// (so every admin looks like a developer there), which makes it unusable for
// anything that must distinguish the two. This mirrors the browser-side
// isDev(email, devEmails) in src/utils/authUtils.js: DEV_EMAILS or devauth rows.
// Used for surfaces that expose staff credentials.
export async function requireDevCaller(request: Request): Promise<{ user: User; email: string } | null> {
  const user = await getCaller(request);
  if (!user) return null;
  const email = (user.email || user.user_metadata?.email || '').toLowerCase();
  if (!email) return null;

  // A suspended account loses privileged reads too, same as requireAdminCaller.
  if (email !== OWNER_EMAIL) {
    const disabled = await fetchDisabledEmails();
    if (disabled.has(email)) return null;
  }

  if (DEV_EMAILS.map((e) => e.toLowerCase()).includes(email)) return { user, email };

  try {
    const { data: dev } = await roleClient().from('devauth').select('email');
    const member = !!dev?.some((r: { email?: string }) => (r.email || '').toLowerCase() === email);
    return member ? { user, email } : null;
  } catch {
    // devauth unreadable: fail closed. Credentials stay hidden rather than
    // leaking because a role lookup had a bad day.
    return null;
  }
}

// Simple unguessable one-time password: Jmi- + 8 chars from an unambiguous set.
export function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (const b of bytes) suffix += alphabet[b % alphabet.length];
  return `Jmi-${suffix}`;
}
