// Server-only helpers for the jmis_staff_credentials store.
//
// The store holds the password we ISSUED to a staff member, so that developers
// can read it back on the Staff Accounts page while it is still their live
// password. Supabase itself keeps only a bcrypt hash, which cannot be shown.
//
// The table has RLS enabled with no policies, so it is invisible to anon and
// authenticated clients — only the service-role client reaches it. Every call
// here must therefore receive the service client from serviceClient().
import type { SupabaseClient } from '@supabase/supabase-js';

export interface StoredCredential {
  staff_id: string;
  email: string | null;
  password: string;
  set_at: string;
  set_by: string | null;
}

// Record (or replace) the issued password for one staff member.
// Best-effort by contract at the call sites: a failure here must never abort
// account creation or a password reset, because the auth user already has the
// new password and the staff member can still sign in.
export async function saveStaffCredential(
  admin: SupabaseClient,
  args: { staffId: string; email?: string | null; password: string; setBy?: string | null }
): Promise<boolean> {
  try {
    const { error } = await admin.from('jmis_staff_credentials').upsert(
      {
        staff_id: args.staffId,
        email: args.email || null,
        password: args.password,
        set_at: new Date().toISOString(),
        set_by: args.setBy || null,
      },
      { onConflict: 'staff_id' }
    );
    return !error;
  } catch {
    return false;
  }
}

// Forget the stored password. Called when the staff member sets their own
// password, so the page never shows a credential for a password that no longer
// works (their new one is unknown to us and must stay unknown).
export async function clearStaffCredential(admin: SupabaseClient, staffId: string): Promise<boolean> {
  try {
    const { error } = await admin.from('jmis_staff_credentials').delete().eq('staff_id', staffId);
    return !error;
  } catch {
    return false;
  }
}
