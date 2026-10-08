"use client";

import dynamic from "next/dynamic";

// Loaded client-side only: the page reads the live session and Supabase auth.
const AdminNotes = dynamic(() => import("../../src/components/AdminNotes"), {
  ssr: false,
  loading: () => <div>Loading…</div>,
});

export default function NotesPage() {
  return <AdminNotes />;
}
