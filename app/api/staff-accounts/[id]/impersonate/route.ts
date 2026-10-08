import { NextResponse } from 'next/server';
import { requireAdminCaller, serviceClient } from '@/src/utils/serverAdminAuth';

// POST /api/staff-accounts/[id]/impersonate — admin/developer opens the staff
// portal AS this staff member (Staff Accounts "Sign in as Staff" button).
//
// The admin app and the staff portal are DIFFERENT origins that share one
// Supabase project, and the staff password is an unreadable bcrypt hash — so a
// browser session cannot be copied across. Instead we use Supabase's own
// passwordless primitive: the service-role Admin API mints a magiclink
// (generateLink) for the staff email, returning a single-use hashed token that
// the staff portal exchanges for a real session. No password is touched and no
// email is sent, so the provisional @bluebellschool.com mailboxes are irrelevant.
//
// Enforced server-side via requireAdminCaller (UI gating is not a boundary).
// Ephemeral by design: nothing is written to bluebell_auditlogs, and the token is
// never logged. Returns { url } — a fully-formed staff-portal URL whose hash
// fragment carries the one-time token (a fragment is not sent to any server,
// stored in history, or leaked via referrer).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
      .from('bluebell_staff')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr || !staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }
    if (!staff.email || !staff.auth_user_id) {
      return NextResponse.json(
        { error: 'This staff member has no portal login yet — create it first' },
        { status: 400 }
      );
    }

    // Base origin for the staff portal. Server-only env so the portal URL never
    // reaches the browser bundle. Trailing slashes stripped for safe joining.
    const base = (process.env.STAFF_URL || '').replace(/\/+$/, '');
    if (!base) {
      return NextResponse.json(
        { error: 'Staff portal URL is not configured on the server (STAFF_URL)' },
        { status: 500 }
      );
    }

    // Mint a single-use magiclink. data.properties.hashed_token is the value the
    // portal verifies with (verifyOtp({ type: 'magiclink', token_hash })).
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: staff.email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkErr || !tokenHash) {
      return NextResponse.json(
        { error: 'Could not create the staff session: ' + (linkErr?.message || 'no token issued') },
        { status: 500 }
      );
    }

    const url = `${base}/impersonate#t=${encodeURIComponent(tokenHash)}`;
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('staff-accounts/[id]/impersonate POST error:', error?.message || error);
    return NextResponse.json({ error: error.message || 'Request failed' }, { status: 500 });
  }
}
