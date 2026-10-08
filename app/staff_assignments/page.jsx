"use client";

import dynamic from "next/dynamic";

// Loaded client-side only: the page reads the live session and Supabase auth.
const AssignmentsHub = dynamic(() => import("../../src/components/AssignmentsHub"), {
  ssr: false,
  loading: () => <div>Loading…</div>,
});

// Legacy route kept working as an alias of the combined Assignments page —
// it simply opens on the Teaching Assignments tab.
export default function StaffAssignmentsPage() {
  return <AssignmentsHub initialTab="teaching" />;
}
