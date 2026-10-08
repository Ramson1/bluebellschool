"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Chat from "./Chat.jsx";
import { supabase } from "../supabaseClient.js";
import "../styles/AdminPages.css";
import "../styles/Chat.css";

// School Admin / Office view of the shared chat. Any admin/developer sees every
// parent thread (their own office threads and teachers' threads) and can reply
// as "School Admin/Office", or start a chat with any parent.
export default function AdminChat() {
  const [email, setEmail] = useState(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (alive) setEmail(user?.email || "admin@school");
    });
    return () => { alive = false; };
  }, []);

  const me = useMemo(
    () => ({ side: "school", key: `admin:${email || ""}`, name: "School Admin/Office" }),
    [email]
  );
  const listFilter = useMemo(() => ({ adminAll: true }), []);

  const loadContacts = async () => {
    // Parents/guardians (student threads) + staff members (office <-> staff
    // threads). Staff threads reuse the conversation table with the staff
    // encoded in student_id as `staff:<id>` (never collides with a real student
    // uuid, so the parent portal can't see them) and teacher_staff_id set so the
    // staff member's portal lists and can reply to them.
    const [{ data: students, error: sErr }, { data: staff, error: tErr }] = await Promise.all([
      supabase.from("jmis_student").select("id, name, class").order("name").limit(1000),
      supabase
        .from("jmis_staff")
        .select("id, name, designation, department, status")
        .order("name")
        .limit(1000),
    ]);
    if (sErr) throw sErr;
    if (tErr) throw tErr;
    const parentContacts = (students || []).map((s) => ({
      key: `stu:${s.id}`, kind: "student",
      title: s.name, subtitle: s.class,
      studentId: s.id, studentName: s.name, studentClass: s.class,
      schoolType: "admin", schoolLabel: "School Admin/Office",
    }));
    // Keep NULL/legacy/active staff; drop only suspended/blocked (filter in JS so
    // a NULL status is never hidden the way SQL `!= 'suspended'` would exclude it).
    const staffContacts = (staff || [])
      .filter((m) => m.status !== "suspended" && m.status !== "blocked")
      .map((m) => ({
        key: `staff:${m.id}`, kind: "staff",
        title: m.name, subtitle: [m.designation, m.department].filter(Boolean).join(" · ") || "Staff",
        studentId: `staff:${m.id}`, studentName: m.name, studentClass: m.designation || "Staff",
        schoolType: "admin", teacherStaffId: m.id, schoolLabel: "School Admin/Office",
      }));
    // Staff first, then parents — admins usually reach staff from here.
    return [...staffContacts, ...parentContacts];
  };

  const getPeer = (conv) => {
    const isStaff = typeof conv.student_id === "string" && conv.student_id.startsWith("staff:");
    if (isStaff) {
      return { title: conv.student_name || "Staff", subtitle: conv.student_class || "Staff" };
    }
    return { title: conv.student_name || "Parent", subtitle: conv.student_class || "" };
  };

  if (!email) {
    return <div className="ap-page"><div style={{ padding: 24, color: "#9ca3af" }}>Loading messages…</div></div>;
  }
  return (
    <>
      <ToastContainer position="top-center" />
      <Chat me={me} listFilter={listFilter} loadContacts={loadContacts} getPeer={getPeer} placeholder="Message…" />
    </>
  );
}
