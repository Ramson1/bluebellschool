"use client";

import dynamic from "next/dynamic";

// Loaded client-side only: the page reads the live session and Supabase auth.
const AssignmentsHub = dynamic(() => import("../../src/components/AssignmentsHub"), {
  ssr: false,
  loading: () => <div>Loading…</div>,
});

// Combined page: Student Homework (jmis_assignments) + Teaching Assignments
// (jmis_staff_assignments) as tabs — all functions of both former pages.
export default function AssignmentsPage() {
  return <AssignmentsHub initialTab="student" />;
}
