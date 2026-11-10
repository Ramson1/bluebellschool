"use client";

import dynamic from "next/dynamic";

const AdminSubmissions = dynamic(() => import("../../src/pages_components/AdminSubmissions"), {
  ssr: false,
  loading: () => <div>Loading submissions…</div>,
});

export default function SubmissionsPage() {
  return <AdminSubmissions />;
}
