"use client";

import React from "react";
import { RiFileTextLine } from "react-icons/ri";
import { makeAdminAcademicsPage } from "./AdminAcademicsKit.jsx";

// Admin oversight/management of assignments/assessments/projects (bluebell_assignments).
const TERMS = ["First Term", "Second Term", "Third Term"];

const AdminAssignments = makeAdminAcademicsPage({
  table: "bluebell_assignments",
  title: "Assignments",
  singular: "assignment",
  icon: RiFileTextLine,
  blurb: "All homework, assessments and projects given across the school. Teachers create these in the Staff Portal; here you can review, edit and remove any of them.",
  authorField: "created_by",
  fields: [
    { key: "class", label: "Class", type: "select", required: true },
    { key: "subject", label: "Subject", type: "select", required: true },
    { key: "title", label: "Title", required: true },
    { key: "assignment_type", label: "Type", type: "select", options: ["assignment", "assessment", "project"] },
    { key: "due_date", label: "Due date", type: "date" },
    { key: "academic_session", label: "Academic Session", placeholder: "e.g. 2025/2026" },
    { key: "term", label: "Term", type: "select", options: TERMS },
    { key: "instructions", label: "Instructions", type: "textarea", full: true, rows: 5 },
    { key: "attachment_url", label: "Attachment (PDF/Word/Image)", type: "file", full: true },
  ],
  listColumns: [
    { key: "title", label: "Title" },
    { key: "class", label: "Class" },
    { key: "subject", label: "Subject" },
    { key: "assignment_type", label: "Type", render: (r) => r.assignment_type || "assignment" },
    { key: "due_date", label: "Due", render: (r) => r.due_date || "—" },
    { key: "term", label: "Term", render: (r) => [r.academic_session, r.term].filter(Boolean).join(" · ") || "—" },
    { key: "created_by", label: "Teacher", render: (r) => r.created_by || "—" },
    { key: "attachment_url", label: "File", render: (r) => (r.attachment_url ? <a href={r.attachment_url} target="_blank" rel="noopener noreferrer">open</a> : "—") },
  ],
});

export default AdminAssignments;
