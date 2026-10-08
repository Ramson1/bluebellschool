"use client";

import React from "react";
import { RiBookOpenLine } from "react-icons/ri";
import { makeAdminAcademicsPage } from "./AdminAcademicsKit.jsx";

// Admin oversight/management of lesson notes across all classes (bluebell_notes).
const TERMS = ["First Term", "Second Term", "Third Term"];

const AdminNotes = makeAdminAcademicsPage({
  table: "bluebell_notes",
  title: "E-Notes",
  singular: "note",
  icon: RiBookOpenLine,
  blurb: "All lesson notes / materials shared with classes across the school. Teachers author these in the Staff Portal; here you can review, edit and remove any of them.",
  authorField: "uploaded_by",
  fields: [
    { key: "class", label: "Class", type: "select", required: true },
    { key: "subject", label: "Subject", type: "select", required: true },
    { key: "title", label: "Title", required: true },
    { key: "academic_session", label: "Academic Session", placeholder: "e.g. 2025/2026" },
    { key: "term", label: "Term", type: "select", options: TERMS },
    { key: "content", label: "Note text / summary", type: "textarea", full: true },
    { key: "file_url", label: "Attachment (PDF/Word/Image)", type: "file", full: true },
  ],
  listColumns: [
    { key: "title", label: "Title" },
    { key: "class", label: "Class" },
    { key: "subject", label: "Subject" },
    { key: "term", label: "Term", render: (r) => [r.academic_session, r.term].filter(Boolean).join(" · ") || "—" },
    { key: "uploaded_by", label: "Teacher", render: (r) => r.uploaded_by || "—" },
    { key: "file_url", label: "File", render: (r) => (r.file_url ? <a href={r.file_url} target="_blank" rel="noopener noreferrer">open</a> : "—") },
    { key: "created_at", label: "Added", render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : "—") },
  ],
});

export default AdminNotes;
