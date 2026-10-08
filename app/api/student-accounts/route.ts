import { NextResponse } from 'next/server';
import { requireAdminCaller, serviceClient, generateTempPassword } from '@/src/utils/serverAdminAuth';

// POST /api/student-accounts — admin provisions a portal login for an
// EXISTING student row (students are added via NewStudent first; unlike
// staff there is no create-record flow here). Body: { studentId, email? }
// The auto-generated default password is returned ONCE to the admin UI.
export async function POST(request: Request) {
  try {
    const caller = await requireAdminCaller(request);
    if (!caller) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({} as any));
    const { studentId, email } = body || {};
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const admin = serviceClient();

    const { data: student, error: fetchErr } = await admin
      .from('jmis_student')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();
    if (fetchErr || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const loginEmail = (email || student.email || '').trim().toLowerCase();
    if (!loginEmail) {
      return NextResponse.json({ error: 'An email is required for the portal login' }, { status: 400 });
    }

    // One login per email — reject if another student (or auth user) has it
    const { data: clash } = await admin
      .from('jmis_student')
      .select('id, name')
      .ilike('email', loginEmail)
      .neq('id', studentId)
      .maybeSingle();
    if (clash) {
      return NextResponse.json({ error: `This email is already used by student "${clash.name}"` }, { status: 409 });
    }

    if (student.auth_user_id) {
      return NextResponse.json({ error: 'This student already has a portal login' }, { status: 409 });
    }

    const tempPassword = generateTempPassword();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: loginEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: student.name, role: 'student', class: student.class },
    });
    if (createErr || !created?.user) {
      return NextResponse.json({ error: 'Failed to create portal login: ' + (createErr?.message || 'unknown error') }, { status: 500 });
    }

    const { data: updated, error: updErr } = await admin
      .from('jmis_student')
      .update({ auth_user_id: created.user.id, email: loginEmail, first_login: true, portal_status: 'active' })
      .eq('id', studentId)
      .select('id, name, class, email, auth_user_id, portal_status')
      .single();
    if (updErr) {
      try { await admin.auth.admin.deleteUser(created.user.id); } catch { /* best effort */ }
      return NextResponse.json({ error: 'Failed to link login to student: ' + updErr.message }, { status: 500 });
    }

    return NextResponse.json({ student: updated, tempPassword });
  } catch (error: any) {
    console.error('student-accounts POST error:', error);
    return NextResponse.json({ error: error.message || 'Request failed' }, { status: 500 });
  }
}
