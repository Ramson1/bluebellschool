"use client";

// SecretaryView — read-only directory of students and staff for the
// school secretary. Requirement 7: the secretary may SEE teachers' data
// and students but must never edit anything (no attendance, results,
// lesson plans, CBT or profile mutations here — this page is fetch-only).
// Admins and developers can also open it (they see everything anyway).

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabaseClient.js";
import { CLASS_OPTIONS, canonClass } from "../utils/classOptions";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  RiShieldUserLine,
  RiGraduationCapLine,
  RiTeamLine,
  RiSearchLine,
  RiInboxLine,
  RiErrorWarningLine,
  RiTimeLine,
} from "react-icons/ri";
import "../styles/AdminPages.css";
import { fetchAuthRoles, isAdmin, isDev, isSecretary } from "../utils/authUtils";

const passportUrl = (file) =>
  file && !file.startsWith("http")
    ? supabase.storage.from("passport").getPublicUrl(file).data.publicUrl
    : file || "/logo.png";

export default function SecretaryView() {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState({ adminEmails: [], teacherEmails: [], devEmails: [], secretaryEmails: [] });
  const [ready, setReady] = useState(false);

  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const [tab, setTab] = useState("students"); // 'students' | 'staff'
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const email = user?.user_metadata?.email;
  const allowed =
    isAdmin(email, roles.adminEmails) ||
    isDev(email, roles.devEmails) ||
    isSecretary(email, roles.secretaryEmails);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user: cu } } = await supabase.auth.getUser();
        setUser(cu);
        const r = await fetchAuthRoles(supabase);
        setRoles(r);
      } catch (e) {
        console.error(e);
      } finally {
        setReady(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const load = async () => {
      setLoadingData(true);
      try {
        const [stuRes, staffRes, assignRes] = await Promise.all([
          supabase
            .from("bluebell_student")
            .select("id, name, class, sex, parentcontact, passport, token")
            .order("name", { ascending: true }),
          supabase
            .from("bluebell_staff")
            .select("id, staff_no, name, sex, designation, department, email, phone, address, class_assigned, subjects, profile_pic, status")
            .order("name", { ascending: true }),
          // assignments table may not exist until the SQL migration runs — never fatal
          Promise.resolve(supabase.from("bluebell_staff_assignments").select("staff_id, class, subject, assignment_type")).catch(() => ({ data: [], error: null })),
        ]);
        if (stuRes.error) throw stuRes.error;
        if (staffRes.error) throw staffRes.error;
        setStudents(stuRes.data || []);
        setStaff(staffRes.data || []);
        setAssignments((assignRes && assignRes.data) || []);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load records: " + e.message);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [allowed]);

  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        (!classFilter || canonClass(s.class) === classFilter) &&
        (!q || (s.name || "").toLowerCase().includes(q) || (s.class || "").toLowerCase().includes(q))
    );
  }, [students, search, classFilter]);

  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase();
    return staff.filter(
      (s) =>
        !q ||
        (s.name || "").toLowerCase().includes(q) ||
        (s.designation || "").toLowerCase().includes(q) ||
        (s.class_assigned || "").toLowerCase().includes(q) ||
        (s.staff_no || "").toLowerCase().includes(q)
    );
  }, [staff, search]);

  const assignmentsFor = (staffId) =>
    assignments
      .filter((a) => a.staff_id === staffId)
      .map((a) => (a.subject ? `${a.class} · ${a.subject}` : `${a.class} (all subjects)`));

  if (!ready) {
    return (
      <>
        <ToastContainer />
        <div className="ap-loading">
          <div className="ap-spinner" />
          <div>Verifying credentials...</div>
        </div>
      </>
    );
  }

  if (!allowed) {
    return (
      <>
        <ToastContainer />
        <div className="ap-denied">
          <RiErrorWarningLine />
          <h2>Not authorised</h2>
          <p>This read-only view is for the school secretary, administrators and developers.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <ToastContainer />
      <div className="ap-page">
        <div className="ap-head">
          <div>
            <h1 className="ap-title">
              <span className="ap-title-ic"><RiShieldUserLine /></span>
              Records Overview
            </h1>
            <p className="ap-sub">Read-only view of students and staff — editing is not available from this page.</p>
          </div>
          <div className="ap-pills">
            <span className="ap-pill"><RiGraduationCapLine /> {filteredStudents.length} student(s)</span>
            <span className="ap-pill blue"><RiTeamLine /> {filteredStaff.length} staff member(s)</span>
          </div>
        </div>

        <div className="ap-toolbar">
          <div className="ap-search">
            <RiSearchLine />
            <input
              type="text"
              placeholder={tab === "students" ? "Search students by name or class" : "Search staff by name, staff no or role"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ap-input"
            />
          </div>
          {tab === "students" && (
            <select className="ap-input" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ maxWidth: 220 }}>
              <option value="">All classes</option>
              {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button className={"ap-btn " + (tab === "students" ? "primary" : "ghost")} onClick={() => setTab("students")}>
              <RiGraduationCapLine /> Students
            </button>
            <button className={"ap-btn " + (tab === "staff" ? "primary" : "ghost")} onClick={() => setTab("staff")}>
              <RiTeamLine /> Staff
            </button>
          </div>
        </div>

        {loadingData ? (
          <div className="ap-loading">
            <div className="ap-spinner" />
            <div>Loading records...</div>
          </div>
        ) : tab === "students" ? (
          <div className="ap-card">
            <div className="ap-card-head">
              <span className="ic"><RiGraduationCapLine /></span>
              Students
              <span className="ap-card-sub">{filteredStudents.length} shown of {students.length} total</span>
            </div>
            {filteredStudents.length === 0 ? (
              <div className="ap-empty"><RiInboxLine /> No students match the current filters.</div>
            ) : (
              <div className="ap-tablewrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Photo</th>
                      <th>Name</th>
                      <th>Class</th>
                      <th>Sex</th>
                      <th>Parent Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, i) => (
                      <tr key={s.id ?? `${s.name}-${i}`}>
                        <td className="ap-num">{i + 1}</td>
                        <td>
                          <img
                            src={passportUrl(s.passport)}
                            alt={s.name}
                            style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--card-border, #e5e7eb)" }}
                          />
                        </td>
                        <td>{s.name}</td>
                        <td><span className="ap-badge info">{s.class || "—"}</span></td>
                        <td>{s.sex || "—"}</td>
                        <td>{s.parentcontact || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="ap-card">
            <div className="ap-card-head">
              <span className="ic blue"><RiTeamLine /></span>
              Staff
              <span className="ap-card-sub">{filteredStaff.length} shown of {staff.length} total</span>
            </div>
            {filteredStaff.length === 0 ? (
              <div className="ap-empty"><RiInboxLine /> No staff records yet — the admin creates them under Staff Accounts.</div>
            ) : (
              <div className="ap-tablewrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Staff No</th>
                      <th>Name</th>
                      <th>Designation</th>
                      <th>Department</th>
                      <th>Class</th>
                      <th>Subjects / Assignments</th>
                      <th>Phone</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((s, i) => {
                      const asg = assignmentsFor(s.id);
                      return (
                        <tr key={s.id ?? `${s.name}-${i}`}>
                          <td className="ap-num">{i + 1}</td>
                          <td>{s.staff_no || "—"}</td>
                          <td>{s.name}</td>
                          <td>{s.designation || "—"}</td>
                          <td>{s.department || "—"}</td>
                          <td><span className="ap-badge info">{s.class_assigned || "—"}</span></td>
                          <td style={{ maxWidth: 260 }}>
                            {asg.length > 0
                              ? asg.join(", ")
                              : (Array.isArray(s.subjects) && s.subjects.length ? s.subjects.join(", ") : (s.subjects || "—"))}
                          </td>
                          <td>{s.phone || "—"}</td>
                          <td>
                            <span className={"ap-badge " + (s.status === "active" ? "ok" : s.status === "suspended" ? "warn" : "danger")}>
                              {s.status || "active"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <p className="ap-hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <RiTimeLine /> This is a snapshot view — records refresh each time the page is opened.
        </p>
      </div>
    </>
  );
}
