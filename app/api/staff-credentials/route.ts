import { NextResponse } from 'next/server';
import { requireDevCaller, serviceClient } from '@/src/utils/serverAdminAuth';

// GET /api/staff-credentials — the passwords issued to staff, DEVELOPERS ONLY.
//
// Why this goes through a route instead of a browser read: the credentials live
// in bluebell_staff_credentials, which has RLS enabled with no policies, so anon and
// authenticated clients get zero rows. Only the service-role key (server-side
// only, never shipped to the browser) can read it. The equivalent column on
// bluebell_staff would have been readable by any client holding the public anon key,
// because that table is deliberately open to the portals — see
// src/api/bluebell_staff_credentials.sql for the live probe results.
//
// Returns { credentials: [{ staff_id, email, password, set_at, set_by }] }.
// A staff member who has since changed their own password has no row, so the
// page shows them as "changed by staff".
export async function GET(request: Request) {
  try {
    const caller = await requireDevCaller(request);
    if (!caller) {
      return NextResponse.json({ error: 'Developer access required' }, { status: 403 });
    }

    const admin = serviceClient();
    const { data, error } = await admin
      .from('bluebell_staff_credentials')
      .select('staff_id, email, password, set_at, set_by')
      .order('set_at', { ascending: false });

    if (error) {
      // A missing table means the SQL file has not been pasted yet — say so
      // plainly instead of surfacing a raw Postgres error in the UI.
      const missing = error.code === '42P01' || /does not exist/i.test(error.message || '');
      return NextResponse.json(
        {
          error: missing
            ? 'Credential store not set up yet — run src/api/bluebell_staff_credentials.sql in the Supabase SQL Editor'
            : 'Could not load credentials: ' + error.message,
        },
        { status: missing ? 503 : 500 }
      );
    }

    return NextResponse.json({ credentials: data || [] });
  } catch (error: any) {
    console.error('staff-credentials GET error:', error);
    const msg = String(error?.message || '').includes('SERVICE_ROLE')
      ? 'Server is missing SUPABASE_SERVICE_ROLE_KEY'
      : error.message || 'Request failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
