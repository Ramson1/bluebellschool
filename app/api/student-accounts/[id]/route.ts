import { NextResponse } from 'next/server';
import { requireAdminCaller, serviceClient, generateTempPassword } from '@/src/utils/serverAdminAuth';

// PATCH /api/student-accounts/[id] — admin actions on a student portal account
// (student rows themselves are managed by the existing FullStudent/NewStudent
// pages; this route only handles login lifecycle):
//  { action: 'reset_password' }  → new temp password (returned once)
//  { action: 'set_status', status: 'active'|'suspended'|'blocked' }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await requireAdminCaller(request);
    if (!caller) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const { id } = await params;
    const { action, status } = await request.json().catch(() => ({} as any));
    if (!id || !action) {
      return NextResponse.json({ error: 'Missing student id or action' }, { status: 400 });
    }

    const admin = serviceClient();

    const { data: student, error: fetchErr } = await admin
      .from('bluebell_student')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (action === 'reset_password') {
      if (!student.auth_user_id) {
        return NextResponse.json({ error: 'This student has no portal login yet — create it first' }, { status: 400 });
      }
      const tempPassword = generateTempPassword();
      const { error: resetErr } = await admin.auth.admin.updateUserById(student.auth_user_id, {
        password: tempPassword,
      });
      if (resetErr) {
        return NextResponse.json({ error: 'Password reset failed: ' + resetErr.message }, { status: 500 });
      }
      // force first-login password-change prompt + kill live sessions
      await admin.from('bluebell_student').update({ first_login: true }).eq('id', id);
      try { await admin.auth.admin.signOut(student.auth_user_id); } catch { /* ignore */ }
      return NextResponse.json({ tempPassword });
    }

    if (action === 'set_status') {
      if (!['active', 'suspended', 'blocked'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      const { error: stErr } = await admin
        .from('bluebell_student')
        .update({ portal_status: status })
        .eq('id', id);
      if (stErr) {
        return NextResponse.json({ error: 'Status update failed: ' + stErr.message }, { status: 500 });
      }
      if (status !== 'active' && student.auth_user_id) {
        try { await admin.auth.admin.signOut(student.auth_user_id); } catch { /* ignore */ }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('student-accounts/[id] PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Request failed' }, { status: 500 });
  }
}
