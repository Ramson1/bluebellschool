import { NextResponse } from 'next/server';
import { requireAdminCaller, serviceClient } from '@/src/utils/serverAdminAuth';

// POST /api/staff-assignments — admin reconciles ONE staff member's class/subject
// assignments (jmis_staff_assignments) against a desired set, using the
// service-role key so the write is not subject to the browser session's RLS role
// (this mirrors how staff profile provisioning already bypasses RLS).
//
// Row semantics identical to /staff_assignments and the staff portal scope:
//   assignment_type 'class_teacher'   -> subject stored as null (owns whole class)
//   assignment_type 'subject_teacher' -> subject is the specific subject name
// Rows are diffed by a normalized signature so only true adds/removes are
// written; unrelated rows (e.g. other academic sessions) are left untouched.
//
// Body: { staffId, session?, assignments: [{ class, subject|null, assignment_type }] }

// GET /api/staff-assignments — list ALL assignment rows via the service-role
// key. The browser's authenticated role cannot read other staff members'
// rows (RLS scopes them to the staff's own id), and an empty read here would
// make the POST diff delete valid assignments, so the admin page must read
// through the same privileged path it writes through.


// Canonical class label — mirrors src/utils/classOptions.js (server copy).
const CLASS_OPTIONS = [
  'Creche', 'PreNursery1', 'PreNursery2', 'Nursery 1', 'Nursery 2',
  'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6',
  'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12',
];
const BY_KEY = new Map(CLASS_OPTIONS.map((c) => [c.toLowerCase().replace(/[^a-z0-9]/g, ''), c]));
function canonClass(value: unknown): string {
  if (!value) return '';
  const s = String(value).trim();
  return BY_KEY.get(s.toLowerCase().replace(/[^a-z0-9]/g, '')) || s;
}
const normSub = (v: unknown) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

type Desired = {
  class?: string;
  subject?: string | null;
  assignment_type?: string;
};

const keyOf = (a: { assignment_type?: string; class?: string | null; subject?: string | null }) =>
  a.assignment_type === 'class_teacher'
    ? `CT|${canonClass(a.class)}`
    : `ST|${canonClass(a.class)}|${normSub(a.subject)}`;

// Session scope matching what the staff portal honors: no session tag (legacy)
// is always in scope; otherwise the row must match the current session.
const inScope = (row: { academic_session?: string | null }, session: string) =>
  !row.academic_session || !session || row.academic_session === session;

export async function GET(request: Request) {
  try {
    const caller = await requireAdminCaller(request);
    if (!caller) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }
    const admin = serviceClient();
    const { data, error } = await admin
      .from('jmis_staff_assignments')
      .select('id, staff_id, class, subject, assignment_type, academic_session');
    if (error) {
      return NextResponse.json({ error: 'Failed to load assignments: ' + error.message }, { status: 500 });
    }
    return NextResponse.json({ rows: data || [] });
  } catch (error: any) {
    console.error('staff-assignments GET error:', error);
    return NextResponse.json({ error: error.message || 'Request failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const caller = await requireAdminCaller(request);
    if (!caller) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({} as any));
    const staffId = String(body?.staffId || '').trim();
    const session = String(body?.session || '').trim();
    const desired: Desired[] = Array.isArray(body?.assignments) ? body.assignments : [];

    if (!staffId) {
      return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });
    }

    const admin = serviceClient();

    // Verify the staff exists (service role bypasses RLS, so this is authoritative).
    const { data: staffRow, error: staffErr } = await admin
      .from('jmis_staff')
      .select('id')
      .eq('id', staffId)
      .maybeSingle();
    if (staffErr || !staffRow) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const { data: storedData, error: readErr } = await admin
      .from('jmis_staff_assignments')
      .select('id, class, subject, assignment_type, academic_session')
      .eq('staff_id', staffId);
    if (readErr) {
      return NextResponse.json({ error: 'Failed to load assignments: ' + readErr.message }, { status: 500 });
    }
    const stored = (storedData || []).filter((r: any) => inScope(r, session));

    const desiredKeyed = desired.map((d) => ({ ...d, _key: keyOf(d) }));
    const desiredKeys = new Set(desiredKeyed.map((d) => d._key));
    const storedKeys = new Set(stored.map((r) => keyOf(r)));

    const errors: string[] = [];
    let added = 0;
    let removed = 0;

    for (const d of desiredKeyed) {
      if (storedKeys.has(d._key)) continue;
      const isForm = d.assignment_type === 'class_teacher';
      const payload = {
        staff_id: staffId,
        class: canonClass(d.class),
        subject: isForm ? null : d.subject || null,
        assignment_type: isForm ? 'class_teacher' : 'subject_teacher',
        academic_session: session || null,
      };
      const { error } = await admin.from('jmis_staff_assignments').insert([payload]);
      if (error) errors.push(`${isForm ? 'Form teacher' : d.subject} · ${payload.class}: ${error.message}`);
      else added++;
    }

    for (const r of stored) {
      if (desiredKeys.has(keyOf(r))) continue;
      const { error } = await admin.from('jmis_staff_assignments').delete().eq('id', (r as any).id);
      if (error) errors.push(`Remove ${(r as any).class}${(r as any).subject ? ` · ${(r as any).subject}` : ''}: ${error.message}`);
      else removed++;
    }

    return NextResponse.json({ added, removed, errors });
  } catch (error: any) {
    console.error('staff-assignments POST error:', error);
    return NextResponse.json({ error: error.message || 'Request failed' }, { status: 500 });
  }
}
