import { NextResponse } from 'next/server';
import { requireSuperOwner, serviceClient, OWNER_EMAIL } from '@/src/utils/serverAdminAuth';

// Access-control route — reserved for the ultimate super_admin (OWNER_EMAIL).
// Lets that one account suspend / restore any OTHER admin or super_admin.
// Disabling is reversible: the account's Supabase login + data stay intact,
// we only remove its email from the role table and record a snapshot in
// bluebell_disabled_accounts so it can be re-enabled to the exact same role.
//
// Every handler is hard-gated with requireSuperOwner, so no other admin or
// developer can call these endpoints even with a valid token or by hand.

const DEV_EMAILS = ['blackboxinfo01@gmail.com', 'rhemaexpertsolutions@gmail.com'];
const norm = (e: unknown) => String(e || '').toLowerCase().trim();

// Find the Supabase auth user id for an email (service role) so we can force
// sign-out immediately. Returns null when there is no matching login.
async function findAuthUserId(admin: ReturnType<typeof serviceClient>, email: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = (data?.users || []).find((u: any) => norm(u.email) === norm(email));
    return found?.id || null;
  } catch {
    return null;
  }
}

// GET /api/access-control — the owner's management view data:
//   admins        : bluebell_userauth entries (excluding the owner)
//   superAdmins   : devauth entries + built-in DEV_EMAILS (excluding the owner)
//   disabled      : bluebell_disabled_accounts snapshots
export async function GET(request: Request) {
  try {
    const owner = await requireSuperOwner(request);
    if (!owner) return NextResponse.json({ error: 'Not authorised' }, { status: 403 });

    const admin = serviceClient();

    const [userauthRes, devRes, disabledRes, staffRes] = await Promise.all([
      admin.from('bluebell_userauth').select('email'),
      Promise.resolve(admin.from('devauth').select('email')).catch(() => ({ data: [], error: null } as any)),
      admin.from('bluebell_disabled_accounts').select('*'),
      Promise.resolve(admin.from('bluebell_staff').select('email, name')).catch(() => ({ data: [], error: null } as any)),
    ]);

    // email -> display name (best effort, from the staff directory)
    const nameMap: Record<string, string> = {};
    for (const s of staffRes.data || []) {
      if (s?.email && s?.name) nameMap[norm(s.email)] = s.name;
    }

    const disabledEmails = new Set((disabledRes.data || []).map((d: any) => norm(d.email)));

    const admins = (userauthRes.data || [])
      .map((r: any) => norm(r.email))
      .filter((e: string) => e && e !== norm(OWNER_EMAIL))
      .filter((e: string) => !disabledEmails.has(e))
      .sort();

    const superSet = new Set<string>([
      ...DEV_EMAILS.map(norm),
      ...(devRes.data || []).map((r: any) => norm(r.email)),
    ]);
    const superAdmins = [...superSet]
      .filter((e) => e && e !== norm(OWNER_EMAIL))
      .filter((e) => !disabledEmails.has(e))
      .sort();

    return NextResponse.json({
      ownerEmail: OWNER_EMAIL,
      admins: admins.map((email: string) => ({ email, name: nameMap[email] || '' })),
      superAdmins: superAdmins.map((email: string) => ({ email, name: nameMap[email] || '' })),
      disabled: (disabledRes.data || []).map((d: any) => ({
        email: d.email, role: d.role, name: d.name, reason: d.reason,
        disabled_by: d.disabled_by, disabled_at: d.disabled_at,
      })),
    });
  } catch (error: any) {
    console.error('access-control GET error:', error);
    return NextResponse.json({ error: error.message || 'Request failed' }, { status: 500 });
  }
}

// POST /api/access-control
//   { action: 'disable', email, role, name?, reason? }
//   { action: 'enable',  email }
export async function POST(request: Request) {
  try {
    const owner = await requireSuperOwner(request);
    if (!owner) return NextResponse.json({ error: 'Not authorised' }, { status: 403 });

    const body = await request.json().catch(() => ({} as any));
    const action = body?.action;
    const email = norm(body?.email);

    if (!action || !email) {
      return NextResponse.json({ error: 'Missing action or email' }, { status: 400 });
    }

    // The owner is untouchable, and no one may disable themselves.
    if (email === norm(OWNER_EMAIL) || email === norm(owner.email)) {
      return NextResponse.json({ error: 'This account cannot be disabled' }, { status: 400 });
    }

    const admin = serviceClient();

    if (action === 'disable') {
      const role = body.role === 'super_admin' ? 'super_admin' : 'admin';

      // Snapshot the record first (name resolved from staff dir / auth meta).
      let snapshotName = String(body.name || '').trim();
      if (!snapshotName) {
        const { data: st } = await admin.from('bluebell_staff').select('name').ilike('email', email).maybeSingle();
        snapshotName = st?.name || '';
      }
      if (!snapshotName) {
        const uid = await findAuthUserId(admin, email);
        if (uid) {
          const { data: u } = await admin.auth.admin.getUserById(uid);
          snapshotName = u?.user?.user_metadata?.full_name || '';
        }
      }

      // Record in the disabled registry (upsert so re-disable refreshes it).
      const { error: insErr } = await admin.from('bluebell_disabled_accounts').upsert(
        { email, role, name: snapshotName || null, reason: String(body.reason || '').trim() || null, disabled_by: owner.email },
        { onConflict: 'email' },
      );
      if (insErr) {
        return NextResponse.json({ error: 'Failed to record suspension: ' + insErr.message }, { status: 500 });
      }

      // Remove from every role table so all presence checks fail immediately.
      try { await admin.from('bluebell_userauth').delete().ilike('email', email); } catch { /* ignore */ }
      try { await admin.from('devauth').delete().ilike('email', email); } catch { /* ignore */ }

      // Drop live sessions so an already-signed-in account loses access now.
      const uid = await findAuthUserId(admin, email);
      if (uid) {
        try { await admin.auth.admin.signOut(uid); } catch { /* older API may not accept scope */ }
      }

      return NextResponse.json({ disabled: true, email, role });
    }

    if (action === 'enable') {
      const { data: row, error: fetchErr } = await admin
        .from('bluebell_disabled_accounts').select('*').ilike('email', email).maybeSingle();
      if (fetchErr || !row) {
        return NextResponse.json({ error: 'That account is not disabled' }, { status: 404 });
      }

      const restoreEmail = row.email || email;
      if ((row.role || 'admin') === 'super_admin') {
        try { await admin.from('devauth').insert({ email: restoreEmail }); } catch { /* ignore duplicate */ }
      } else {
        try { await admin.from('bluebell_userauth').insert({ email: restoreEmail }); } catch { /* ignore duplicate */ }
      }

      const { error: delErr } = await admin.from('bluebell_disabled_accounts').delete().ilike('email', email);
      if (delErr) {
        return NextResponse.json({ error: 'Failed to clear suspension: ' + delErr.message }, { status: 500 });
      }

      return NextResponse.json({ enabled: true, email: restoreEmail, role: row.role });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('access-control POST error:', error);
    return NextResponse.json({ error: error.message || 'Request failed' }, { status: 500 });
  }
}
