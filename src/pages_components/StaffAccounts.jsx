"use client";

// StaffAccounts — admin provisioning of staff records + portal logins
// (requirement 10). Creating an account makes a Supabase auth user (via the
// service-role API route), shows the auto-generated default password, and
// stores the staff row with staff_no auto-filled by a DB trigger.
// Developers (super_admin) additionally get a Password column holding the
// password on record for every staff member, read from jmis_staff_credentials
// through /api/staff-credentials. That route enforces the developer check —
// the isDev test below only decides whether to ask for the list at all.
// Admins can also reset passwords and block/suspend/activate staff here;
// blocked staff are force-signed-out of the staff portal server-side.
// Only admins/developers may open this page (secretary and staff cannot).

import React, { useEffect, useState, useMemo } from "react";
import { Modal } from "react-bootstrap";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  RiTeamLine,
  RiAddLine,
  RiSearchLine,
  RiEditLine,
  RiKeyLine,
  RiForbidLine,
  RiPauseCircleLine,
  RiPlayCircleLine,
  RiInboxLine,
  RiErrorWarningLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiCameraLine,
  RiUploadLine,
  RiFileCopyLine,
  RiLoader4Line,
  RiLoginBoxLine,
  RiShieldStarLine,
} from "react-icons/ri";
import "../styles/AdminPages.css";
import { fetchAuthRoles, isAdmin, isDev } from "../utils/authUtils";
import { logAction } from "../api/auditLog.js";
import { schoolSubjects, subjectsForClass } from "../utils/subjectUtils";
import { CLASS_OPTIONS, canonClass } from "../utils/classOptions";

const ALL_SUBJECTS = Array.from(new Set(Object.values(schoolSubjects).flat())).sort();

const picUrl = (file) => {
  if (!file) return "/logo.png";
  if (file.startsWith("http")) return file;
  // staff pics live in staff_passport; fall back to the student passport bucket
  return (
    supabase.storage.from("staff_passport").getPublicUrl(file).data
      .publicUrl || file
  );
};

const emptyForm = {
  name: "", sex: "", address: "", class_assigned: "", designation: "",
  department: "Academic", subjects: [], assignments: [], email: "", phone: "", profile_pic: "",
  date_of_appointment: "",
};

export default function StaffAccounts() {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState({ adminEmails: [], devEmails: [] });
  const [ready, setReady] = useState(false);

  const [staff, setStaff] = useState([]);
  const [assignmentsByStaff, setAssignmentsByStaff] = useState({});
  // False when the last assignment load FAILED — saving while stale would diff
  // against an empty seed and delete real rows, so doSave skips the sync then.
  const [assignmentsOk, setAssignmentsOk] = useState(true);
  const [session, setSession] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // create/edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // staff row when editing
  const [form, setForm] = useState(emptyForm);
  const [assignDraft, setAssignDraft] = useState({ class: "", subject: "", formTeacher: false });
  const [picFile, setPicFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);

  // one-time password modal
  const [pwModal, setPwModal] = useState({ show: false, password: "", title: "" });

  // Developer-only: the password issued to each staff member, keyed by staff id.
  // A staff member with no entry has changed their own password, so we no longer
  // have anything true to show for them.
  const [creds, setCreds] = useState({});
  const [credsErr, setCredsErr] = useState("");

  // custom confirmation modal — { show, title, message, confirmText, tone, action }
  // tone: confirm button style (green | blue | red | amber); action runs on Confirm
  const [confirm, setConfirm] = useState(null);

  const askConfirm = ({ title, message, confirmText, tone = "green", action }) =>
    setConfirm({ show: true, title, message, confirmText, tone, action });

  const closeConfirm = () => setConfirm(null);

  const runConfirm = async () => {
    if (!confirm) return;
    const action = confirm.action;
    closeConfirm();
    await action();
  };

  const email = user?.user_metadata?.email;
  const allowed = isAdmin(email, roles.adminEmails) || isDev(email, roles.devEmails);
  // Passwords are narrower than page access: only developers see them, and
  // requireDevCaller on the server re-checks it independently of this flag.
  const showPasswords = isDev(email, roles.devEmails);
  const actorRole = "admin"; // audit convention in this codebase (devs are not logged)

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
    loadStaff();
    if (showPasswords) loadCredentials();
    supabase.from("jmis_settings").select("session").limit(1).then(({ data }) => {
      if (data?.[0]?.session) setSession(data[0].session);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  const loadStaff = async () => {
    setLoadingData(true);
    try {
      // Assignments come through the service-role API: the browser's own
      // Supabase role can only see a staff member's OWN assignment rows, so a
      // direct read here would look empty and the edit modal would seed nothing.
      const [staffRes, assignJson] = await Promise.all([
        supabase.from("jmis_staff").select("*").order("name", { ascending: true }),
        api("/api/staff-assignments", "GET").then((j) => { setAssignmentsOk(true); return j; })
          .catch((e) => {
            setAssignmentsOk(false);
            toast.warn("Could not load class/subject assignments: " + e.message);
            return { rows: [] };
          }),
      ]);
      if (staffRes.error) throw staffRes.error;
      setStaff(staffRes.data || []);
      const byStaff = {};
      (assignJson?.rows || []).forEach((r) => {
        if (!r.staff_id) return;
        (byStaff[r.staff_id] ||= []).push(r);
      });
      setAssignmentsByStaff(byStaff);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load staff: " + e.message);
    } finally {
      setLoadingData(false);
    }
  };

  // Call a service-role API route with the signed-in admin's bearer token.
  const api = async (url, method, body) => {
    const { data: { session: sess } } = await supabase.auth.getSession();
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sess?.access_token || ""}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  };

  // Developers only: read back the passwords we issued. A non-dev calling this
  // gets 403 from the route, so the column simply has no values to show.
  const loadCredentials = async () => {
    try {
      const { credentials } = await api("/api/staff-credentials", "GET");
      const map = {};
      (credentials || []).forEach((c) => {
        if (c?.staff_id) map[c.staff_id] = c;
      });
      setCreds(map);
      setCredsErr("");
    } catch (e) {
      setCreds({});
      // Most likely the credential table has not been created yet. Surface the
      // route's message instead of letting every row claim "changed by staff".
      setCredsErr(e.message);
      toast.warn(e.message);
    }
  };

  // Validate a chosen/dropped image and stage it for upload on save.
  const applyPicFile = (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      toast.error("Please choose an image file (JPG, PNG, etc.)");
      return;
    }
    setPicFile(file);
  };

  const uploadPic = async (file) => {
    const ext = file.name.split(".").pop();
    const fileName = `staff/${Date.now()}.${ext}`;
    let { error } = await supabase.storage.from("staff_passport").upload(fileName, file, { upsert: false });
    if (error) {
      // bucket not created yet — fall back to the long-standing passport bucket
      ({ error } = await supabase.storage.from("passport").upload(`staff-${fileName}`, file, { upsert: false }));
      if (error) throw error;
      return supabase.storage.from("passport").getPublicUrl(`staff-${fileName}`).data.publicUrl;
    }
    return supabase.storage.from("staff_passport").getPublicUrl(fileName).data.publicUrl;
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, assignments: [] });
    setAssignDraft({ class: "", subject: "", formTeacher: false });
    setPicFile(null);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    // Seed the inline editor from this staff member's session-scoped
    // jmis_staff_assignments rows so the diff on save only touches real changes.
    const seeded = (assignmentsByStaff[row.id] || [])
      .filter((a) => !a.academic_session || !session || a.academic_session === session)
      .map((a) => ({
        key: a.id || `${a.class}-${a.subject}`,
        id: a.id,
        class: canonClass(a.class) || a.class,
        subject: a.subject ?? null,
        assignment_type: a.assignment_type,
      }));
    setForm({
      name: row.name || "",
      sex: row.sex || "",
      address: row.address || "",
      class_assigned: row.class_assigned || "",
      designation: row.designation || "",
      department: row.department || "Academic",
      subjects: Array.isArray(row.subjects) ? row.subjects : [],
      assignments: seeded,
      email: row.email || "",
      phone: row.phone || "",
      profile_pic: row.profile_pic || "",
      date_of_appointment: row.date_of_appointment || "",
    });
    setAssignDraft({ class: "", subject: "", formTeacher: false });
    setPicFile(null);
    setFormOpen(true);
  };

  const normSub = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const keyOf = (a) =>
    a.assignment_type === "class_teacher"
      ? `CT|${canonClass(a.class)}`
      : `ST|${canonClass(a.class)}|${normSub(a.subject)}`;

  // Subjects offered follow the class picked in the adder, so a Year 7 pick
  // never lists Creche-only subjects; unknown/legacy labels fall back to all.
  const assignSubjects = useMemo(() => {
    const list = subjectsForClass(assignDraft.class);
    return list.length ? list : ALL_SUBJECTS;
  }, [assignDraft.class]);

  const addAssignment = () => {
    const cls = canonClass(assignDraft.class);
    if (!cls) { toast.error("Select a class first."); return; }
    if (!assignDraft.formTeacher && !assignDraft.subject) {
      toast.error("Select a subject (or tick Form teacher).");
      return;
    }
    const entry = assignDraft.formTeacher
      ? { key: `k-${Date.now()}`, class: cls, subject: null, assignment_type: "class_teacher" }
      : { key: `k-${Date.now()}`, class: cls, subject: assignDraft.subject, assignment_type: "subject_teacher" };
    setForm((f) => {
      const list = f.assignments || [];
      if (list.some((a) => keyOf(a) === keyOf(entry))) {
        toast.info("That assignment is already listed.");
        return f;
      }
      // A form teacher owns every subject in the class: adding one drops the
      // now-redundant subject rows for the same class, and a subject row is
      // refused where the class is already covered by a form teacher.
      if (entry.assignment_type === "class_teacher") {
        const next = list.filter(
          (a) => !(canonClass(a.class) === cls && a.assignment_type === "subject_teacher")
        );
        return { ...f, assignments: [...next, entry] };
      }
      if (list.some((a) => a.assignment_type === "class_teacher" && canonClass(a.class) === cls)) {
        toast.info(`${cls} is already a form-teacher class — it covers all subjects.`);
        return f;
      }
      return { ...f, assignments: [...list, entry] };
    });
    setAssignDraft((d) => ({ ...d, subject: "", formTeacher: false }));
  };

  const removeAssignment = (key) =>
    setForm((f) => ({ ...f, assignments: (f.assignments || []).filter((a) => a.key !== key) }));

  const doSave = async () => {
    setSaving(true);
    try {
      let picPath = form.profile_pic;
      if (picFile) {
        picPath = await uploadPic(picFile);
      }
      // Only Academic staff carry class/subject assignments. The authoritative
      // per-class access lives in jmis_staff_assignments; the flat subjects /
      // class_assigned columns are kept as a derived snapshot for the directory
      // display and the staff portal's legacy fallback.
      const isAcademic = form.department === "Academic";
      const assignments = isAcademic ? (form.assignments || []) : [];
      const derivedSubjects = [...new Set(assignments.filter((a) => a.subject).map((a) => a.subject))];
      const ctClass = assignments.find((a) => a.assignment_type === "class_teacher")?.class || "";
      const profileFields = { ...form };
      delete profileFields.assignments;
      const profile = {
        ...profileFields,
        subjects: derivedSubjects,
        class_assigned: form.class_assigned || ctClass || "",
        profile_pic: picPath,
      };

      let staffId = editing?.id;
      if (editing) {
        const { staff: updated } = await api(`/api/staff-accounts/${editing.id}`, "PATCH", {
          action: "update",
          profile,
        });
        staffId = updated.id;
        setStaff((list) => list.map((s) => (s.id === editing.id ? updated : s)));
        logAction(supabase, {
          email, role: actorRole, action: "staff_update", targetTable: "jmis_staff",
          recordId: updated.id, details: { before: editing, after: updated },
        });
        toast.success("Staff record updated");
      } else {
        const { staff: created, tempPassword } = await api("/api/staff-accounts", "POST", profile);
        staffId = created.id;
        setStaff((list) => [...list, created].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
        logAction(supabase, {
          email, role: actorRole, action: "staff_add", targetTable: "jmis_staff",
          recordId: created.id, details: { name: created.name, email: created.email, staff_no: created.staff_no },
        });
        setPwModal({
          show: true,
          password: tempPassword,
          title: `Portal login created for ${created.name}${created.staff_no ? ` (${created.staff_no})` : ""}`,
        });
        if (showPasswords) loadCredentials();
      }

      // Write class/subject rows — the staff portal reads exactly these.
      // The API route reconciles jmis_staff_assignments with the service-role
      // key, so the write succeeds regardless of the browser session's role.
      // Skipped when the current assignment list failed to load: diffing
      // against a stale/empty seed would wrongly delete stored rows.
      if (staffId) {
        if (!assignmentsOk) {
          toast.warn("Assignments could not be loaded, so class/subject changes were NOT saved. Close this modal and press Reload (or refresh) then try again.");
        } else {
          const res = await api("/api/staff-assignments", "POST", { staffId, session, assignments });
          if ((res.errors || []).length) {
            toast.warn(`Saved, but ${res.errors.length} assignment change(s) failed: ${(res.errors || []).slice(0, 2).join(" · ")}`);
          } else {
            if ((res.added || 0) + (res.removed || 0) > 0) {
              logAction(supabase, {
                email, role: actorRole, action: "staff_assignments_sync", targetTable: "jmis_staff_assignments",
                recordId: staffId, details: { added: res.added, removed: res.removed },
              });
            }
            // Explicit confirmation — if this toast never appears after a save,
            // the tab is running stale code and needs a hard refresh.
            toast.success(
              (res.added || 0) + (res.removed || 0) > 0
                ? `Class/subject assignments saved (${res.added} added, ${res.removed} removed).`
                : "Class/subject assignments already up to date."
            );
          }
          loadStaff();
        }
      }

      setFormOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("NAME and EMAIL are required");
      return;
    }
    askConfirm({
      title: editing ? "Save changes" : "Create staff account",
      message: editing
        ? `Update the profile for ${form.name.trim()}? Changes take effect immediately, including on the staff portal.`
        : `Create the staff record for ${form.name.trim()} and a staff portal login? A system-generated password will be shown after saving.`,
      confirmText: editing ? "Yes, save changes" : "Yes, create account",
      tone: "green",
      action: doSave,
    });
  };

  const doResetPassword = async (row) => {
    try {
      const { tempPassword } = await api(`/api/staff-accounts/${row.id}`, "PATCH", { action: "reset_password" });
      logAction(supabase, {
        email, role: actorRole, action: "staff_password_reset", targetTable: "jmis_staff",
        recordId: row.id, details: { name: row.name },
      });
      setPwModal({ show: true, password: tempPassword, title: `New password for ${row.name}` });
      if (showPasswords) loadCredentials();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleResetPassword = (row) => {
    askConfirm({
      title: "Reset password",
      message: `Generate a new temporary password for ${row.name}? Their current password stops working immediately.`,
      confirmText: "Yes, reset password",
      tone: "amber",
      action: () => doResetPassword(row),
    });
  };

  // Open the staff portal as this person in a NEW TAB (server mints a one-time
  // Supabase magiclink token; nothing about their password or session changes).
  const doImpersonate = async (row) => {
    try {
      const { url } = await api(`/api/staff-accounts/${row.id}/impersonate`, "POST");
      const w = window.open(url, "_blank");
      if (!w) toast.error("Pop-up blocked — allow pop-ups for this site and try again.");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleImpersonate = (row) => {
    askConfirm({
      title: "Open staff portal as " + row.name,
      message:
        `This opens the Staff Portal in a new browser tab signed in as ${row.name}. `
        + "Their own session and password are unchanged. Close the tab when done.",
      confirmText: "Yes, open as staff",
      tone: "blue",
      action: () => doImpersonate(row),
    });
  };

  const doStatus = async (row, status) => {
    try {
      const { staff: updated } = await api(`/api/staff-accounts/${row.id}`, "PATCH", { action: "set_status", status });
      setStaff((list) => list.map((s) => (s.id === row.id ? updated : s)));
      logAction(supabase, {
        email, role: actorRole, action: "staff_status_change", targetTable: "jmis_staff",
        recordId: row.id, details: { name: row.name, status },
      });
      toast.success(`${row.name} is now ${status}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleStatus = (row, status) => {
    const messages = {
      suspended: `Suspend ${row.name}'s portal access? They will not be able to start new sessions until reactivated.`,
      blocked: `Block ${row.name}? They will be signed out of the staff portal immediately and cannot sign back in until reactivated.`,
      active: `Reactivate ${row.name}'s portal access?`,
    };
    askConfirm({
      title: `${status.charAt(0).toUpperCase() + status.slice(1)} ${row.name}`,
      message: messages[status] || `Change ${row.name}'s status to ${status}?`,
      confirmText: `Yes, set to ${status}`,
      tone: status === "blocked" ? "red" : status === "suspended" ? "amber" : "green",
      action: () => doStatus(row, status),
    });
  };

  const copyText = (text, label) => {
    navigator.clipboard
      .writeText(text || "")
      .then(() => toast.success(label ? `Copied ${label}'s password` : "Copied to clipboard"))
      .catch(() => toast.error("Select and copy manually"));
  };

  const copyPassword = () => copyText(pwModal.password);

  const doDeleteStaff = async (row) => {
    try {
      await api(`/api/staff-accounts/${row.id}`, "DELETE");
      setStaff((list) => list.filter((s) => s.id !== row.id));
      setSelected((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      logAction(supabase, {
        email, role: actorRole, action: "staff_delete", targetTable: "jmis_staff",
        recordId: row.id, details: { name: row.name, email: row.email, staff_no: row.staff_no },
      });
      toast.success(`${row.name} removed from the system`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDeleteStaff = (row) => {
    askConfirm({
      title: `Delete ${row.name}`,
      message: `Permanently remove ${row.name}${row.staff_no ? ` (${row.staff_no})` : ""} from the system? Their staff record, class/subject assignments and portal login are all deleted. This cannot be undone — use Block instead if you only want to revoke access.`,
      confirmText: "Yes, delete staff",
      tone: "red",
      action: () => doDeleteStaff(row),
    });
  };

  // Class/subject assignment is edited inline via the "Class & Subjects" editor
  // in the modal (syncStaffAssignments writes jmis_staff_assignments). The
  // dedicated School-wide Staff Assignments page (/staff_assignments) manages
  // the same rows for bulk / cross-staff work.

  const statusBadge = (status) => {
    const s = status || "active";
    const cls = s === "active" ? "ok" : s === "suspended" ? "warn" : "danger";
    return <span className={`ap-badge ${cls}`}>{s}</span>;
  };

  // Directory cell: subjects grouped by the class they apply to, straight from
  // jmis_staff_assignments. Falls back to the legacy flat fields when a staff
  // has no assignment rows.
  const assignmentCell = (s) => {
    const rows = (assignmentsByStaff[s.id] || []).filter(
      (a) => !a.academic_session || !session || a.academic_session === session
    );
    if (rows.length === 0) {
      return (
        <>
          <div>{s.class_assigned || "—"}</div>
          {(s.subjects || []).length > 0 && (
            <div className="ap-hint">{(s.subjects || []).join(", ")}</div>
          )}
        </>
      );
    }
    const byCls = {};
    rows.forEach((r) => {
      const c = canonClass(r.class) || r.class || "—";
      (byCls[c] ||= { form: false, subjects: [] });
      if (r.assignment_type === "class_teacher") byCls[c].form = true;
      else if (r.subject) byCls[c].subjects.push(r.subject);
    });
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {Object.entries(byCls).map(([c, v]) => (
          <div key={c}>
            <div style={{ fontWeight: 700 }}>{c}</div>
            <div className="ap-hint">
              {v.form ? "Form teacher — all subjects" : v.subjects.join(", ")}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return staff.filter(
      (s) =>
        (!statusFilter || (s.status || "active") === statusFilter) &&
        (!q ||
          (s.name || "").toLowerCase().includes(q) ||
          (s.staff_no || "").toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q) ||
          (s.designation || "").toLowerCase().includes(q) ||
          (s.class_assigned || "").toLowerCase().includes(q))
    );
  }, [staff, search, statusFilter]);

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
          <p>Staff account management is limited to administrators and developers.</p>
          <button className="ap-btn ghost" onClick={() => (window.location.href = "/home")}>Back to Dashboard</button>
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
              <span className="ap-title-ic"><RiTeamLine /></span>
              Staff Accounts
            </h1>
            <p className="ap-sub">Create staff records with portal logins, reset passwords, and block or suspend access.</p>
          </div>
          <div className="ap-actions">
            <span className="ap-pill blue"><RiTeamLine /> {staff.length} staff</span>
            <button className="ap-btn primary" onClick={openCreate}>
              <RiAddLine /> New Staff Account
            </button>
          </div>
        </div>

        <div className="ap-toolbar">
          <div className="ap-search">
            <RiSearchLine />
            <input
              type="text"
              placeholder="Search by name, staff no, email, role or class"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ap-input"
            />
          </div>
          <select className="ap-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        {showPasswords && credsErr && (
          <div className="ap-hint" style={{ margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6, color: "#a13834" }}>
            <RiErrorWarningLine /> {credsErr}
          </div>
        )}

        {loadingData ? (
          <div className="ap-loading">
            <div className="ap-spinner" />
            <div>Loading staff...</div>
          </div>
        ) : (
          <div className="ap-card">
            <div className="ap-card-head">
              <span className="ic"><RiTeamLine /></span>
              Staff Directory
              <span className="ap-card-sub">{filtered.length} shown of {staff.length} total</span>
            </div>
            {filtered.length === 0 ? (
              <div className="ap-empty"><RiInboxLine /> No staff match the current filters.</div>
            ) : (
              <div className="ap-tablewrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Photo</th>
                      <th>Name / Staff No</th>
                      <th>Role</th>
                      <th>Date of Appointment</th>
                      <th>Class &amp; Subjects</th>
                      <th>Contact</th>
                      {showPasswords && <th style={{ minWidth: 190 }}>Password</th>}
                      <th>Status</th>
                      <th style={{ minWidth: 320 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => (
                      <tr key={s.id ?? `${s.name}-${i}`}>
                        <td className="ap-num">{i + 1}</td>
                        <td>
                          <img
                            src={picUrl(s.profile_pic)}
                            alt={s.name}
                            style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", background: "var(--container-bg, #f1f5f9)" }}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{s.name}</div>
                          <div className="ap-hint">{s.staff_no || "—"}</div>
                        </td>
                        <td>
                          <div>{s.designation || "—"}</div>
                          <span className={`ap-badge ${s.department === "Non-Academic" ? "neutral" : "info"}`}>
                            {s.department || "Academic"}
                          </span>
                        </td>
                        <td>{assignmentCell(s)}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {s.date_of_appointment ? new Date(s.date_of_appointment).toLocaleDateString() : <span className="ap-hint">not set</span>}
                        </td>
                        <td>
                          <div style={{ fontSize: "0.85rem" }}>{s.email || "—"}</div>
                          <div className="ap-hint">{s.phone || ""}</div>
                        </td>
                        {showPasswords && (
                          <td>
                            {creds[s.id] ? (
                              <>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <code style={{ fontSize: "0.8rem", fontWeight: 800, background: "var(--container-bg, #f1f5f9)", padding: "4px 8px", borderRadius: 7, whiteSpace: "nowrap" }}>
                                    {creds[s.id].password}
                                  </code>
                                  <button className="ap-btn sm ghost" title="Copy this password" onClick={() => copyText(creds[s.id].password, s.name)}>
                                    <RiFileCopyLine />
                                  </button>
                                </div>
                                <div className="ap-hint">
                                  {creds[s.id].set_at ? `issued ${new Date(creds[s.id].set_at).toLocaleDateString()}` : "on record"}
                                  {creds[s.id].set_by ? ` · by ${creds[s.id].set_by}` : ""}
                                </div>
                              </>
                            ) : credsErr ? (
                              <span className="ap-hint" title={credsErr}>unavailable</span>
                            ) : s.auth_user_id ? (
                              <span className="ap-badge neutral" title="They set their own password on the staff portal, so nothing is stored for them">changed by staff</span>
                            ) : (
                              <span className="ap-hint">no portal login</span>
                            )}
                          </td>
                        )}
                        <td>{statusBadge(s.status)}</td>
                        <td>
                          {/* Grid keeps every action on one horizontal row (2 cols)
                              instead of wrapping icons vertically in narrow columns */}
                          <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: 6, justifyContent: "start", alignItems: "center" }}>
                            <button className="ap-btn sm ghost" title="Edit this staff member's profile" onClick={() => openEdit(s)}>
                              <RiEditLine /> Edit
                            </button>
                            <button className="ap-btn sm ghost" title="Generate a new temporary password" onClick={() => handleResetPassword(s)} disabled={!s.auth_user_id}>
                              <RiKeyLine /> Reset Password
                            </button>
                            <button className="ap-btn sm ghost" title="Open the staff portal as this person in a new tab" onClick={() => handleImpersonate(s)} disabled={!s.auth_user_id}>
                              <RiLoginBoxLine /> Sign in as Staff
                            </button>
                            {(s.status || "active") === "active" ? (
                              <>
                                <button className="ap-btn sm ghost" title="Temporarily suspend portal access" onClick={() => handleStatus(s, "suspended")}>
                                  <RiPauseCircleLine /> Suspend
                                </button>
                                <button className="ap-btn sm ghost" style={{ color: "#a13834" }} title="Block portal access and force sign-out" onClick={() => handleStatus(s, "blocked")}>
                                  <RiForbidLine /> Block
                                </button>
                              </>
                            ) : (
                              <button className="ap-btn sm ghost" style={{ color: "#0f5132" }} title="Restore portal access" onClick={() => handleStatus(s, "active")}>
                                <RiPlayCircleLine /> Activate
                              </button>
                            )}
                            <button className="ap-btn sm ghost" style={{ color: "#a13834" }} title="Permanently remove this staff member and their portal login" onClick={() => handleDeleteStaff(s)}>
                              <RiDeleteBinLine /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      <Modal show={formOpen} onHide={() => setFormOpen(false)} centered dialogClassName="ap-modal-lg" contentClassName="ap-modal-content">
        <Modal.Header className="ap-modal-head" closeButton closeVariant="white">
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>
            {editing ? `Edit ${editing.name}` : "New Staff Account"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="ap-modal-body">
          <div className="ap-form-grid">
            <div className="ap-field">
              <label className="ap-label">Full Name *</label>
              <input className="ap-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mrs. Jane Doe" />
            </div>
            <div className="ap-field">
              <label className="ap-label">Sex</label>
              <select className="ap-input" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="ap-field">
              <label className="ap-label">Staff No</label>
              <input className="ap-input" value={editing?.staff_no || ""} readOnly disabled placeholder="Auto-generated (JMI-0001)" />
              <span className="ap-hint">Assigned automatically when the record is saved.</span>
            </div>
            <div className="ap-field">
              <label className="ap-label">Designation</label>
              <input className="ap-input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Class Teacher, Bursar, Security" />
            </div>
            <div className="ap-field">
              <label className="ap-label">Department</label>
              <select className="ap-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="Academic">Academic</option>
                <option value="Non-Academic">Non-Academic</option>
              </select>
            </div>
            <div className="ap-field">
              <label className="ap-label">Date of Appointment</label>
              <input className="ap-input" type="date" value={form.date_of_appointment} onChange={(e) => setForm({ ...form, date_of_appointment: e.target.value })} />
              <span className="ap-hint">When the staff member began service — also shown on their portal Profile page.</span>
            </div>
            <div className="ap-field">
              <label className="ap-label">Class (primary / form-teacher)</label>
              <select className="ap-input" value={form.class_assigned} onChange={(e) => setForm({ ...form, class_assigned: e.target.value })}>
                <option value="">No specific class</option>
                {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="ap-hint">Optional, informational — the authoritative class/subject access is set in &quot;Class &amp; Subjects&quot; below.</span>
            </div>
            <div className="ap-field">
              <label className="ap-label">Email *</label>
              <input className="ap-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staff@BLUEBELL_DOMAIN_PLACEHOLDER" disabled={!!editing} />
              {editing && <span className="ap-hint">Login email is fixed here — the staff member can replace it themselves on their portal Profile page. Staff can also always sign in with their full name.</span>}
            </div>
            <div className="ap-field">
              <label className="ap-label">Phone Number</label>
              <input className="ap-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="080..." />
            </div>
            <div className="ap-field" style={{ gridColumn: "1 / -1" }}>
              <label className="ap-label">Address</label>
              <input className="ap-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Home address" />
            </div>
            <div className="ap-field" style={{ gridColumn: "1 / -1" }}>
              <label className="ap-label">Class &amp; Subjects</label>
              {form.department === "Academic" ? (
                <>
                  <div className="sa-ac-adder">
                    <div>
                      <span className="ap-field-label">Class</span>
                      <select className="ap-input" value={assignDraft.class} onChange={(e) => setAssignDraft((d) => ({ ...d, class: e.target.value, subject: "" }))}>
                        <option value="">Select class…</option>
                        {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className="ap-field-label">Subject</span>
                      <select className="ap-input" value={assignDraft.subject} disabled={assignDraft.formTeacher || !assignDraft.class} onChange={(e) => setAssignDraft((d) => ({ ...d, subject: e.target.value }))}>
                        <option value="">{assignDraft.formTeacher ? "All subjects (form teacher)" : assignDraft.class ? "Select subject…" : "Pick a class first"}</option>
                        {!assignDraft.formTeacher && assignSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <label className="sa-switch" style={{ marginBottom: 6 }} title="A form teacher covers every subject in the class — no subject pick needed">
                      <input
                        type="checkbox"
                        className="sa-switch-input"
                        checked={assignDraft.formTeacher}
                        onChange={(e) => setAssignDraft((d) => ({ ...d, formTeacher: e.target.checked, subject: e.target.checked ? "" : d.subject }))}
                      />
                      <span className="sa-switch-track"><span className="sa-switch-thumb" /></span>
                      <span className={"sa-switch-state" + (assignDraft.formTeacher ? " on" : "")}>
                        {assignDraft.formTeacher ? "Form teacher" : "Subject teacher"}
                      </span>
                    </label>
                    <button type="button" className="ap-btn primary" onClick={addAssignment} style={{ marginBottom: 2 }}>
                      <RiAddLine /> Add assignment
                    </button>
                  </div>
                  <div className="sa-ac-chips">
                    {(form.assignments || []).length === 0 ? (
                      <span className="ap-hint">No class/subject assignments yet — pick a class and subject above and press Add.</span>
                    ) : (form.assignments || []).map((a) => {
                      const isForm = a.assignment_type === "class_teacher";
                      return (
                        <span key={a.key} className={"sa-ac-chip" + (isForm ? " form" : "")}>
                          {isForm && <RiShieldStarLine />}
                          <b>{a.class}</b>
                          <span>{isForm ? "Form teacher · all subjects" : a.subject}</span>
                          <button type="button" className="x" title={isForm ? `Remove form teacher for ${a.class}` : `Remove ${a.subject} · ${a.class}`} onClick={() => removeAssignment(a.key)}>
                            <RiCloseLine />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <span className="ap-hint" style={{ marginTop: 6, display: "block" }}>
                    Each assignment binds a subject to a specific class — different classes can share a subject with different teachers. A <b>Form teacher</b> covers every subject in that class.
                  </span>
                </>
              ) : (
                <span className="ap-hint">Subject/class assignment is only available for <b>Academic</b> staff.</span>
              )}
            </div>
            <div className="ap-field" style={{ gridColumn: "1 / -1" }}>
              <label className="ap-label">Profile Picture</label>
              <div
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!dragOver) setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); applyPicFile(e.dataTransfer?.files?.[0]); }}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: 12, borderRadius: 10, border: `1.5px dashed ${dragOver ? "#011b97" : "#cbd5e1"}`, background: dragOver ? "rgba(1, 27, 151,.06)" : "transparent", transition: "border-color .15s ease, background .15s ease" }}
              >
                <span style={{ position: "relative", width: 56, height: 56, borderRadius: "50%", overflow: "hidden", background: "var(--container-bg, #f1f5f9)", display: "inline-flex", flex: "0 0 auto" }}>
                  <img src={picFile ? URL.createObjectURL(picFile) : picUrl(form.profile_pic)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <RiCameraLine style={{ position: "absolute", right: 4, bottom: 4, background: "rgba(1, 27, 151,.85)", color: "#fff", borderRadius: "50%", padding: 3, width: 18, height: 18 }} />
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <input type="file" accept="image/*" onChange={(e) => applyPicFile(e.target.files?.[0] || null)} style={{ fontSize: "0.85rem" }} />
                  <span className="ap-hint" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <RiUploadLine /> or drag &amp; drop an image here
                  </span>
                </div>
              </div>
            </div>
          </div>
          {!editing && (
            <p className="ap-hint" style={{ marginTop: 12 }}>
              A portal login will be created with a system-generated default password shown after saving.
              {showPasswords && " Developers can read it again in the Password column."}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer className="ap-modal-foot">
          <button className="ap-btn ghost" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
          <button className="ap-btn primary" onClick={handleSave} disabled={saving}>
            {saving ? <><RiLoader4Line className="spin" /> Saving...</> : editing ? "Save Changes" : "Create Account"}
          </button>
        </Modal.Footer>
      </Modal>

      {/* One-time password modal */}
      <Modal show={pwModal.show} onHide={() => setPwModal({ show: false, password: "", title: "" })} centered contentClassName="ap-modal-content">
        <Modal.Header className="ap-modal-head" closeButton closeVariant="white">
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>{pwModal.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="ap-modal-body">
          <p style={{ margin: "0 0 10px" }}>
            Share this temporary password with the staff member.
            {showPasswords
              ? " Developers also see it in the Password column until the staff member sets their own — at which point it is forgotten here."
              : " It is shown here only; use Reset Password to issue a new one later."}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <code style={{ fontSize: "1.15rem", fontWeight: 800, background: "var(--container-bg, #f1f5f9)", padding: "10px 16px", borderRadius: 10, letterSpacing: 1 }}>{pwModal.password}</code>
            <button className="ap-btn ghost" onClick={copyPassword}><RiFileCopyLine /> Copy</button>
          </div>
        </Modal.Body>
        <Modal.Footer className="ap-modal-foot">
          <button className="ap-btn primary" onClick={() => setPwModal({ show: false, password: "", title: "" })}>Done</button>
        </Modal.Footer>
      </Modal>

      {/* Custom confirmation modal — gates save/create/delete/reset/block-type actions */}
      <Modal show={!!confirm} onHide={closeConfirm} centered contentClassName="ap-modal-content">
        {confirm && (
          <>
            <Modal.Header
              className={"ap-modal-head" + (confirm.tone === "red" ? " red" : confirm.tone === "amber" ? " amber" : confirm.tone === "blue" ? " blue" : "")}
              closeButton
              closeVariant="white"
            >
              <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>
                <RiErrorWarningLine /> {confirm.title}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="ap-modal-body">{confirm.message}</Modal.Body>
            <Modal.Footer className="ap-modal-foot">
              <button className="ap-btn ghost" onClick={closeConfirm}><RiCloseLine /> Cancel</button>
              <button className={`ap-btn ${confirm.tone}`} onClick={runConfirm}>{confirm.confirmText}</button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </>
  );
}
