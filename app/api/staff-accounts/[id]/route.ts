import { NextResponse } from 'next/server';
import { requireAdminCaller, serviceClient, generateTempPassword } from '@/src/utils/serverAdminAuth';
import { saveStaffCredential } from '@/src/utils/staffCredentials';

// PATCH /api/staff-accounts/[id] — admin actions on one staff member:
//  { action: 'update', profile: {...} }              → edit profile fields
//  { action: 'reset_password' }                      → new temp password (recorded
//                                                      for the developer-only column)
//  { action: 'set_status', status: 'active'|'suspended'|'blocked' }
// 'blocked' also force-signs the user out of the staff portal.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await requireAdminCaller(request);
    if (!caller) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const { id } = await params;
    const { action, profile, status } = await request.json().catch(() => ({} as any));
    if (!id || !action) {
      return NextResponse.json({ error: 'Missing staff id or action' }, { status: 400 });
    }

    const admin = serviceClient();

    const { data: staff, error: fetchErr } = await admin
      .from('jmis_staff')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr || !staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    if (action === 'update') {
      const allowedFields = ['name', 'sex', 'address', 'class_assigned', 'designation', 'department', 'subjects', 'email', 'phone', 'profile_pic', 'date_of_appointment'];
      const updates: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (profile && key in profile) updates[key] = profile[key];
      }
      if (Array.isArray(updates.subjects)) updates.subjects = updates.subjects; // TEXT[] passthrough
      // date_of_appointment is a DATE column: the form's calendar input sends
      // '' when cleared, and Postgres refuses '' in a date column, so blank
      // means "no appointment date on record" (null).
      if ('date_of_appointment' in updates) {
        const raw = String(updates.date_of_appointment ?? '').trim();
        updates.date_of_appointment = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
      }
      const { data: updated, error: updErr } = await admin
        .from('jmis_staff')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (updErr) {
        return NextResponse.json({ error: 'Update failed: ' + updErr.message }, { status: 500 });
      }
      // keep auth metadata's name roughly in sync (best effort)
      if (staff.auth_user_id && updates.name) {
        try { await admin.auth.admin.updateUserById(staff.auth_user_id, { user_metadata: { full_name: updates.name } }); } catch { /* ignore */ }
      }
      // Role changes propagate to teacher access: Academic staff are kept on
      // jmis_teacherauth (results/CBT pages); Non-Academic staff (minders,
      // assistants, security, cleaners…) are removed from it.
      const targetEmail = String(updates.email || staff.email || '').toLowerCase();
      if (targetEmail && (updates.department || updates.email)) {
        const dept = String(updates.department || staff.department || 'Academic').toLowerCase();
        try {
          if (dept === 'non-academic') {
            await admin.from('jmis_teacherauth').delete().eq('email', targetEmail);
          } else {
            const oldEmail = String(staff.email || '').toLowerCase();
            const { data: ta } = await admin.from('jmis_teacherauth').select('email').eq('email', targetEmail).maybeSingle();
            if (!ta) {
              const { data: oldRow } = oldEmail && oldEmail !== targetEmail
                ? await admin.from('jmis_teacherauth').select('email').eq('email', oldEmail).maybeSingle()
                : { data: null };
              if (oldRow) await admin.from('jmis_teacherauth').update({ email: targetEmail }).eq('email', oldEmail);
              else await admin.from('jmis_teacherauth').insert({ email: targetEmail });
            }
          }
        } catch { /* access list sync is best effort */ }
      }
      return NextResponse.json({ staff: updated });
    }

    if (action === 'reset_password') {
      if (!staff.auth_user_id) {
        return NextResponse.json({ error: 'This staff member has no portal login yet — create it first' }, { status: 400 });
      }
      const tempPassword = generateTempPassword();
      const { error: resetErr } = await admin.auth.admin.updateUserById(staff.auth_user_id, {
        password: tempPassword,
      });
      if (resetErr) {
        return NextResponse.json({ error: 'Password reset failed: ' + resetErr.message }, { status: 500 });
      }
      // force a fresh login with the new password
      try { await admin.auth.admin.signOut(staff.auth_user_id); } catch { /* older API may not accept scope — ignore */ }
      // Replace whatever we had on record: the old password is now dead, so
      // keeping it would show developers a credential that no longer works.
      await saveStaffCredential(admin, {
        staffId: id,
        email: staff.email,
        password: tempPassword,
        setBy: caller.email,
      });
      return NextResponse.json({ tempPassword });
    }

    if (action === 'set_status') {
      if (!['active', 'suspended', 'blocked'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      const { data: updated, error: stErr } = await admin
        .from('jmis_staff')
        .update({ status })
        .eq('id', id)
        .select('*')
        .single();
      if (stErr) {
        return NextResponse.json({ error: 'Status update failed: ' + stErr.message }, { status: 500 });
      }
      // blocked/suspended staff must not keep a live portal session
      if (status !== 'active' && staff.auth_user_id) {
        try { await admin.auth.admin.signOut(staff.auth_user_id); } catch { /* ignore */ }
      }
      return NextResponse.json({ staff: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('staff-accounts/[id] PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Request failed' }, { status: 500 });
  }
}

// DELETE /api/staff-accounts/[id] — remove a staff member from the system:
// deletes the jmis_staff row, their class/subject assignments, their teacher
// access entry and their portal login (Supabase auth user, signed out first).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await requireAdminCaller(request);
    if (!caller) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });
    }

    const admin = serviceClient();

    const { data: staff, error: fetchErr } = await admin
      .from('jmis_staff')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr || !staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Drop the portal session before deleting the auth user
    if (staff.auth_user_id) {
      try { await admin.auth.admin.signOut(staff.auth_user_id); } catch { /* ignore */ }
    }

    const { error: delErr } = await admin.from('jmis_staff').delete().eq('id', id);
    if (delErr) {
      return NextResponse.json({ error: 'Delete failed: ' + delErr.message }, { status: 500 });
    }

    // Related records — best effort so one leftover row never blocks the delete
    try { await admin.from('jmis_staff_assignments').delete().eq('staff_id', id); } catch { /* ignore */ }
    const email = String(staff.email || '').toLowerCase();
    if (email) {
      try { await admin.from('jmis_teacherauth').delete().eq('email', email); } catch { /* ignore */ }
    }
    if (staff.auth_user_id) {
      try { await admin.auth.admin.deleteUser(staff.auth_user_id); } catch { /* ignore */ }
    }

    return NextResponse.json({ deleted: true, staff });
  } catch (error: any) {
    console.error('staff-accounts/[id] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Request failed' }, { status: 500 });
  }
}
