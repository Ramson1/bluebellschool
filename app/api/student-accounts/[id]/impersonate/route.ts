import { NextResponse } from 'next/server';
import { requireAdminCaller, serviceClient } from '@/src/utils/serverAdminAuth';

// POST /api/student-accounts/[id]/impersonate — admin/developer opens the
// student portal AS this student (Full Student "Sign in as Student" button).
//
// Unlike the staff portal, the student portal does NOT use Supabase Auth. A
// student signs in with their FULL NAME + RESULT ACCESS TOKEN, and the portal
// keeps a lightweight client session (localStorage { id, token }) that it
// re-validates against bluebell_student.token on every load. The token is therefore
// the secret capability the whole portal already trusts — so handing it to the
// student portal is what establishes the session; there is nothing to "mint"
// and no password is touched.
//
// The two apps are DIFFERENT origins sharing one Supabase project, so the
// session cannot simply be copied — we return a fully-formed staff-portal URL
// whose hash fragment carries { id, token }. A hash fragment is never sent to a
// server, stored in history, or leaked via the referrer, and the landing page
// scrubs it immediately after consuming it.
//
// Enforced server-side via requireAdminCaller (UI gating is not a boundary).
// Ephemeral by design: nothing is written to any audit table and the token is
// never logged.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await requireAdminCaller(request);
    if (!caller) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing student id' }, { status: 400 });
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

    // The result access token IS the student portal login capability. Without it
    // there is nothing to hand off (mirrors the reset_password guard).
    const token = (student.token || '').toString().trim();
    if (!token) {
      return NextResponse.json(
        { error: 'This student has no portal access token yet — assign one first' },
        { status: 400 }
      );
    }

    // Base origin for the student portal. Server-only env so the portal URL
    // never reaches the browser bundle. Trailing slashes stripped for safe join.
    const base = (process.env.STUDENT_URL || '').replace(/\/+$/, '');
    if (!base) {
      return NextResponse.json(
        { error: 'Student portal URL is not configured on the server (STUDENT_URL)' },
        { status: 500 }
      );
    }

    const url = `${base}/impersonate#i=${encodeURIComponent(String(student.id))}&t=${encodeURIComponent(token)}`;
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('student-accounts/[id]/impersonate POST error:', error?.message || error);
    return NextResponse.json({ error: error.message || 'Request failed' }, { status: 500 });
  }
}
