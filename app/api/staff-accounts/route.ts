import { NextResponse } from 'next/server';
import { requireAdminCaller, serviceClient, generateTempPassword } from '@/src/utils/serverAdminAuth';
import { saveStaffCredential } from '@/src/utils/staffCredentials';

// POST /api/staff-accounts — admin creates a staff member + portal login.
// The Supabase auth user is created with the service-role key (never exposed
// to the browser); the auto-generated default password is returned to the
// admin UI AND recorded in bluebell_staff_credentials, which only a developer can
// read back (see GET /api/staff-credentials). It is forgotten the moment the
// staff member sets their own password. Body:
// { name, sex, address, class_assigned, designation, department, subjects[],
//   email, phone, profile_pic?, date_of_appointment? }
export async function POST(request: Request) {
  try {
    const caller = await requireAdminCaller(request);
    if (!caller) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const body = await request.json();
    const { name, sex, address, class_assigned, designation, department, subjects, email, phone, profile_pic, date_of_appointment } = body || {};

    if (!name || !email) {
      return NextResponse.json({ error: 'NAME and EMAIL are required' }, { status: 400 });
    }

    const admin = serviceClient();

    // Reject duplicate staff emails early (both in directory and auth)
    const { data: existing } = await admin.from('bluebell_staff').select('id, email').ilike('email', email).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'A staff member with this email already exists' }, { status: 409 });
    }

    const tempPassword = generateTempPassword();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: name, role: 'staff' },
    });
    if (createErr || !created?.user) {
      return NextResponse.json({ error: 'Failed to create portal login: ' + (createErr?.message || 'unknown error') }, { status: 500 });
    }

    const { data: staffRow, error: insertErr } = await admin
      .from('bluebell_staff')
      .insert({
        name,
        sex: sex || null,
        address: address || null,
        class_assigned: class_assigned || null,
        designation: designation || null,
        department: department || 'Academic',
        subjects: Array.isArray(subjects) ? subjects : subjects ? [subjects] : [],
        email,
        phone: phone || null,
        profile_pic: profile_pic || null,
        // DATE column: only a real YYYY-MM-DD value is written, anything the
        // admin left blank stays null.
        date_of_appointment: /^\d{4}-\d{2}-\d{2}$/.test(String(date_of_appointment || '')) ? date_of_appointment : null,
        auth_user_id: created.user.id,
        status: 'active',
      })
      .select('*')
      .single();
    if (insertErr) {
      // roll back the orphaned auth user so retries are clean
      try { await admin.auth.admin.deleteUser(created.user.id); } catch { /* best effort */ }
      return NextResponse.json({ error: 'Failed to save staff record: ' + insertErr.message }, { status: 500 });
    }

    // Record the issued password for the developer-only column. Best effort:
    // the login already works, so a credential-store hiccup must not fail the
    // create (the password is still shown in the response).
    await saveStaffCredential(admin, {
      staffId: staffRow.id,
      email,
      password: tempPassword,
      setBy: caller.email,
    });

    return NextResponse.json({ staff: staffRow, tempPassword });
  } catch (error: any) {
    console.error('staff-accounts POST error:', error);
    return NextResponse.json({ error: error.message || 'Request failed' }, { status: 500 });
  }
}
