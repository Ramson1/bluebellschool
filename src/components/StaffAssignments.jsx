"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import { supabase } from "../supabaseClient.js";
import { CLASS_OPTIONS, canonClass, canonicalizeClasses } from "../utils/classOptions";
import { logAction } from "../api/auditLog.js";
import { schoolSubjects, subjectsForClass } from "../utils/subjectUtils.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/AdminPages.css";
import {
  RiTeamLine,
  RiAddLine,
  RiSearchLine,
  RiRefreshLine,
  RiDeleteBinLine,
  RiCloseLine,
  RiInboxLine,
  RiErrorWarningLine,
  RiGridLine,
  RiLayoutGridLine,
  RiListOrdered,
  RiSave3Line,
  RiInformationLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiUserStarLine,
} from "react-icons/ri";

// Canonical class list — shared single source of truth (utils/classOptions.js).
const CLASSES = CLASS_OPTIONS;

// Every subject the school teaches (union of all class subject lists) — used
// only as a fallback so legacy subject names stay reachable.
const ALL_SUBJECTS = Array.from(new Set(Object.values(schoolSubjects).flat())).sort();

// Subjects and class labels are stored inconsistently ("Mathematics" vs
// "maths", "Year 7" vs "YEAR7"), so every comparison goes through these
// normalizers — same rules as the staff portal scope engine.
const normSub = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");

const VIEWS = [
  { id: "matrix", label: "Teacher Matrix", icon: RiGridLine, hint: "One staff member — which classes and subjects they own" },
  { id: "grid", label: "School Grid", icon: RiLayoutGridLine, hint: "Whole school — who teaches each subject in each class" },
  { id: "records", label: "All Records", icon: RiListOrdered, hint: "Raw assignment rows, one at a time" },
];

// Admin view of every class/subject assignment across all academic staff
// (jmis_staff_assignments). Three ways to work with the same data:
//   Teacher Matrix — stage a whole teaching map for one staff member
//                    (form teacher = all subjects, or specific subjects only)
//   School Grid    — read who owns each class/subject pair school-wide and
//                    click a cell to assign or remove
//   All Records    — the original flat list with single-row add/remove
// The staff portal reads exactly these rows: a class_teacher row unlocks every
// subject of that class, a subject_teacher row unlocks only that subject.
export default function StaffAssignments() {
  const [rows, setRows] = useState([]);
  const [staffMap, setStaffMap] = useState({});   // id -> { name, staff_no, designation }
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [session, setSession] = useState("");

  // shared toolbar filters
  const [search, setSearch] = useState("");
  const [clsFilter, setClsFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");

  // single-record add modal (All Records view)
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ staff_id: "", class: "", subject: "", assignment_type: "subject_teacher", academic_session: "" });
  const [pendingDelete, setPendingDelete] = useState(null);

  // view
  const [view, setView] = useState("matrix");

  // Teacher Matrix
  const [matrixStaff, setMatrixStaff] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [matrixClassQuery, setMatrixClassQuery] = useState("");
  const [matrixSession, setMatrixSession] = useState("");
  const [draft, setDraft] = useState({});          // key -> staged op
  const [expanded, setExpanded] = useState({});
  const [showReview, setShowReview] = useState(false);
  const [pendingClear, setPendingClear] = useState(null);
  const [applying, setApplying] = useState(false);

  // School Grid
  const [gridCls, setGridCls] = useState("");
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [cell, setCell] = useState(null);           // { class, subject, type }
  const [cellStaff, setCellStaff] = useState("");
  const [cellBusy, setCellBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email || "admin@school"));
    supabase.from("jmis_settings").select("session").limit(1).then(({ data }) => {
      if (data && data[0]?.session) {
        setSession(data[0].session);
        setMatrixSession(data[0].session);
      }
    });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [assignRes, staffRes] = await Promise.all([
        supabase.from("jmis_staff_assignments").select("*").order("created_at", { ascending: false }).limit(2000),
        supabase.from("jmis_staff").select("id, name, staff_no, designation").order("name", { ascending: true }),
      ]);
      if (assignRes.error) throw assignRes.error;
      const map = {};
      for (const s of staffRes.data || []) map[s.id] = s;
      setStaffMap(map);
      setRows(assignRes.data || []);
    } catch (e) {
      toast.error("Could not load assignments: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const staffName = (id) => staffMap[id]?.name || "Unknown staff";

  // Only staff who actually appear in assignments drive the filter list, but we
  // show the whole roster so admins can filter to someone with none too.
  const staffOptions = useMemo(
    () => Object.values(staffMap).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [staffMap]
  );

  // ---------------------------------------------------------------- single row
  const openNew = () => {
    setForm({ staff_id: "", class: "", subject: "", assignment_type: "subject_teacher", academic_session: session || "" });
    setShow(true);
  };
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Subjects offered follow the chosen class, so a Year 7 pick never lists
  // Creche-only subjects; unknown/legacy class labels fall back to the full set.
  const formSubjects = useMemo(() => {
    const list = subjectsForClass(form.class);
    return list.length ? list : ALL_SUBJECTS;
  }, [form.class]);

  const save = async () => {
    if (!form.staff_id) { toast.warn("Select the staff member."); return; }
    if (!form.class) { toast.warn("Select a class."); return; }
    const isClassTeacher = form.assignment_type === "class_teacher";
    if (!isClassTeacher && !form.subject) { toast.warn("Select a subject (or switch the type to Class Teacher)."); return; }
    setSaving(true);
    const payload = {
      staff_id: form.staff_id,
      class: canonClass(form.class),
      subject: isClassTeacher ? null : form.subject,
      assignment_type: form.assignment_type,
      academic_session: form.academic_session || null,
    };
    const res = await supabase.from("jmis_staff_assignments").insert([payload]).select();
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message?.includes("unique") ? "That staff member already has this assignment." : res.error.message);
      return;
    }
    logAction(supabase, {
      email, role: "admin", action: "staff_assignment_add",
      targetTable: "jmis_staff_assignments", recordId: res.data?.[0]?.id,
      details: { staff: staffName(form.staff_id), class: payload.class, subject: payload.subject, type: form.assignment_type },
    });
    setShow(false);
    setRows((rs) => [res.data[0], ...rs]);
    toast.success("Assignment added.");
  };

  const confirmDelete = async () => {
    const r = pendingDelete;
    if (!r) return;
    const { error } = await supabase.from("jmis_staff_assignments").delete().eq("id", r.id);
    setPendingDelete(null);
    if (error) { toast.error(error.message); return; }
    logAction(supabase, {
      email, role: "admin", action: "staff_assignment_delete",
      targetTable: "jmis_staff_assignments", recordId: r.id,
      details: { staff: staffName(r.staff_id), class: r.class, subject: r.subject, type: r.assignment_type },
    });
    setRows((rs) => rs.filter((x) => x.id !== r.id));
    toast.success("Assignment removed.");
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (clsFilter && canonClass(r.class) !== clsFilter) return false;
      if (staffFilter && r.staff_id !== staffFilter) return false;
      if (!q) return true;
      const hay = `${staffName(r.staff_id)} ${r.class} ${r.subject || ""} ${r.assignment_type} ${r.academic_session || ""}`.toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, clsFilter, staffFilter, staffMap]);

  const typeBadge = (t) => (
    <span className={`ap-badge ${t === "class_teacher" ? "info" : "neutral"}`}>
      {t === "class_teacher" ? "Class Teacher" : "Subject Teacher"}
    </span>
  );

  // ------------------------------------------------------------- Teacher Matrix
  // Session tolerance mirrors the staff portal: rows with no session (legacy)
  // stay visible so admins are never surprised by "missing" assignments.
  const inMatrixSession = (r) =>
    !r.academic_session || !matrixSession || r.academic_session === matrixSession;

  const staffRows = (cls) =>
    rows.filter((r) => r.staff_id === matrixStaff && canonClass(r.class) === canonClass(cls) && inMatrixSession(r));
  const ctRowOf = (cls) => staffRows(cls).find((r) => r.assignment_type === "class_teacher");
  const subRowsOf = (cls) => staffRows(cls).filter((r) => r.assignment_type === "subject_teacher" && r.subject);
  // A class has one form teacher: any OTHER staff already holding one is the
  // transfer source surfaced in the review modal.
  const otherCtOf = (cls) =>
    rows.find((r) => r.assignment_type === "class_teacher" && canonClass(r.class) === canonClass(cls) && r.staff_id !== matrixStaff);

  const keyOf = (cls, subject) => `${matrixStaff}|${canonClass(cls)}|${subject ? normSub(subject) : "*"}`;

  const setOp = (next) => setDraft((d) => ({ ...d, ...next }));
  const dropOp = (keys) => setDraft((d) => {
    const copy = { ...d };
    for (const k of keys) delete copy[k];
    return copy;
  });

  // Effective state of one class for the selected staff: a staged op always
  // wins over the stored row, so toggling twice is a clean no-op.
  const formTeacherOn = (cls) => {
    const staged = draft[keyOf(cls, null)];
    if (staged) return staged.op === "add";
    return !!ctRowOf(cls);
  };

  const subjectOn = (cls, subject) => {
    if (formTeacherOn(cls)) return true;
    const staged = draft[keyOf(cls, subject)];
    if (staged) return staged.op === "add";
    return subRowsOf(cls).some((r) => normSub(r.subject) === normSub(subject));
  };

  const toggleFormTeacher = (cls, next) => {
    const k = keyOf(cls, null);
    const existing = ctRowOf(cls);
    const sameCls = (c) => canonClass(c.class) === canonClass(cls);
    if (next) {
      setDraft((d) => {
        const copy = { ...d };
        if (existing) delete copy[k];
        else copy[k] = { op: "add", class: cls, subject: null, type: "class_teacher" };
        // Form teacher covers every subject, so the per-subject rows for this
        // class are redundant: queued for deletion, staged adds simply dropped.
        for (const key of Object.keys(copy)) {
          if (!sameCls(copy[key]) || copy[key].type !== "subject_teacher") continue;
          if (copy[key].op === "add") delete copy[key];
        }
        for (const r of subRowsOf(cls)) {
          copy[keyOf(cls, r.subject)] = { op: "remove", class: cls, subject: r.subject, type: "subject_teacher", id: r.id };
        }
        return copy;
      });
      toast.info(`${cls} — form teacher covers all subjects, so the individual subject rows are staged for removal.`);
    } else {
      setDraft((d) => {
        const copy = { ...d };
        if (existing) copy[k] = { op: "remove", class: cls, subject: null, type: "class_teacher", id: existing.id };
        else delete copy[k];
        return copy;
      });
    }
  };

  const toggleSubject = (cls, subject, next) => {
    if (formTeacherOn(cls)) return;
    const k = keyOf(cls, subject);
    const existing = subRowsOf(cls).find((r) => normSub(r.subject) === normSub(subject));
    if (next) {
      if (existing) dropOp([k]);
      else setOp({ [k]: { op: "add", class: cls, subject, type: "subject_teacher" } });
    } else if (existing) {
      setOp({ [k]: { op: "remove", class: cls, subject, type: "subject_teacher", id: existing.id } });
    } else {
      dropOp([k]);
    }
  };

  const stageClearClass = (cls) => {
    const list = staffRows(cls);
    const ops = {};
    for (const r of list) {
      ops[keyOf(cls, r.subject)] = {
        op: "remove", class: cls, subject: r.subject || null,
        type: r.assignment_type, id: r.id,
      };
    }
    setOp(ops);
    setPendingClear(null);
    toast.info(`${list.length} assignment(s) for ${cls} staged for removal — Save Changes to apply.`);
  };

  const changes = useMemo(() => Object.values(draft), [draft]);
  const additions = changes.filter((c) => c.op === "add");
  const stagedRemovals = changes.filter((c) => c.op === "remove");
  const transfers = useMemo(
    () =>
      additions
        .filter((a) => a.type === "class_teacher")
        .map((a) => ({ class: a.class, from: otherCtOf(a.class) }))
        .filter((t) => !!t.from),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [additions, rows, matrixStaff]
  );

  const pickStaff = (id) => {
    if (id === matrixStaff) return;
    if (changes.length) toast.warn(`Discarded ${changes.length} unsaved change(s) for ${staffName(matrixStaff) || "the previous staff member"}.`);
    setMatrixStaff(id);
    setDraft({});
    setExpanded({});
  };

  const applyDraft = async () => {
    if (!matrixStaff) return;
    setApplying(true);
    const errs = [];
    let added = 0;
    let removed = 0;
    let moved = 0;
    for (const c of changes) {
      if (c.op === "add") {
        const payload = {
          staff_id: matrixStaff,
          class: canonClass(c.class),
          subject: c.type === "class_teacher" ? null : c.subject,
          assignment_type: c.type,
          academic_session: matrixSession || null,
        };
        const res = await supabase.from("jmis_staff_assignments").insert([payload]).select();
        if (res.error) {
          errs.push(`${c.type === "class_teacher" ? "Form teacher" : c.subject} · ${c.class}: ${res.error.message}`);
        } else added++;
      } else if (c.id) {
        const { error } = await supabase.from("jmis_staff_assignments").delete().eq("id", c.id);
        if (error) errs.push(`Remove ${c.class}${c.subject ? ` · ${c.subject}` : ""}: ${error.message}`);
        else removed++;
      }
    }
    // one form teacher per class: the previous holder loses only the
    // class_teacher row, their own subject rows stay untouched
    for (const t of transfers) {
      const { error } = await supabase.from("jmis_staff_assignments").delete().eq("id", t.from.id);
      if (error) errs.push(`Transfer from ${staffName(t.from.staff_id)} (${t.class}): ${error.message}`);
      else moved++;
    }
    logAction(supabase, {
      email, role: "admin", action: "staff_assignment_matrix_save",
      targetTable: "jmis_staff_assignments",
      details: {
        staff: staffName(matrixStaff), added, removed, transferred: moved,
        session: matrixSession || null,
        changes: changes.map((c) => `${c.op} ${c.class}${c.subject ? `/${c.subject}` : ""} (${c.type})`),
      },
    });
    setApplying(false);
    setShowReview(false);
    setDraft({});
    await load();
    if (errs.length) toast.error(`${errs.length} change(s) failed: ${errs.slice(0, 2).join(" · ")}`);
    else toast.success(`Saved — ${added} added, ${removed} removed${moved ? `, form teacher transferred for ${moved} class(es)` : ""}.`);
  };

  const matrixClasses = useMemo(() => {
    const q = matrixClassQuery.trim().toLowerCase();
    return CLASSES.filter((c) => !q || c.toLowerCase().includes(q));
  }, [matrixClassQuery]);

  const filteredStaff = useMemo(() => {
    const q = staffQuery.trim().toLowerCase();
    if (!q) return staffOptions;
    return staffOptions.filter((s) =>
      `${s.name || ""} ${s.staff_no || ""} ${s.designation || ""}`.toLowerCase().includes(q)
    );
  }, [staffOptions, staffQuery]);

  // ------------------------------------------------------------------ School Grid
  const gridData = useMemo(() => {
    const byClass = {};
    for (const r of rows) {
      const cls = canonClass(r.class);
      if (!cls) continue;
      byClass[cls] ||= { formTeachers: [], pairs: {} };
      if (r.assignment_type === "class_teacher") {
        byClass[cls].formTeachers.push(r);
      } else if (r.subject) {
        const k = normSub(r.subject);
        byClass[cls].pairs[k] ||= { label: r.subject, rows: [] };
        byClass[cls].pairs[k].rows.push(r);
      }
    }
    return byClass;
  }, [rows]);

  const gridClasses = useMemo(() => {
    if (gridCls) return [gridCls];
    const withData = canonicalizeClasses(rows.map((r) => r.class));
    return showAllClasses ? CLASSES : (withData.length ? withData : CLASSES);
  }, [rows, gridCls, showAllClasses]);

  const openCell = (cls, subject, type) => {
    setCellStaff("");
    setCell({ class: cls, subject, type });
  };

  const cellCurrent = useMemo(() => {
    if (!cell) return [];
    const g = gridData[cell.class] || { formTeachers: [], pairs: {} };
    if (cell.type === "class_teacher") return g.formTeachers;
    return (g.pairs[normSub(cell.subject)] || { rows: [] }).rows;
  }, [cell, gridData]);

  const cellSubjects = useMemo(() => {
    if (!cell) return [];
    const list = subjectsForClass(cell.class);
    const stored = Object.values(gridData[cell.class]?.pairs || {}).map((p) => p.label);
    return [...new Set([...list, ...stored])];
  }, [cell, gridData]);

  const assignCell = async () => {
    if (!cell) return;
    if (!cellStaff) { toast.warn("Select the staff member first."); return; }
    setCellBusy(true);
    const payload = {
      staff_id: cellStaff,
      class: canonClass(cell.class),
      subject: cell.type === "class_teacher" ? null : cell.subject,
      assignment_type: cell.type,
      academic_session: session || null,
    };
    const res = await supabase.from("jmis_staff_assignments").insert([payload]).select();
    if (res.error) {
      toast.error(res.error.message?.includes("unique") ? "That staff member already has this assignment." : res.error.message);
      setCellBusy(false);
      return;
    }
    logAction(supabase, {
      email, role: "admin", action: "staff_assignment_add",
      targetTable: "jmis_staff_assignments", recordId: res.data?.[0]?.id,
      details: { staff: staffName(cellStaff), class: payload.class, subject: payload.subject, type: cell.type },
    });
    // form teacher is a single seat: hand it over from whoever held it
    if (cell.type === "class_teacher") {
      for (const prev of cellCurrent.filter((r) => r.staff_id !== cellStaff)) {
        const { error } = await supabase.from("jmis_staff_assignments").delete().eq("id", prev.id);
        if (!error) {
          logAction(supabase, {
            email, role: "admin", action: "staff_assignment_delete",
            targetTable: "jmis_staff_assignments", recordId: prev.id,
            details: { staff: staffName(prev.staff_id), class: prev.class, type: "class_teacher", note: "form teacher transferred" },
          });
        }
      }
      toast.success(`Form teacher of ${cell.class} is now ${staffName(cellStaff)}.`);
    } else {
      toast.success(`${cell.subject} · ${cell.class} assigned to ${staffName(cellStaff)}.`);
    }
    setCell(null);
    setCellStaff("");
    setCellBusy(false);
    await load();
  };

  const removeCellRow = async (r) => {
    const { error } = await supabase.from("jmis_staff_assignments").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    logAction(supabase, {
      email, role: "admin", action: "staff_assignment_delete",
      targetTable: "jmis_staff_assignments", recordId: r.id,
      details: { staff: staffName(r.staff_id), class: r.class, subject: r.subject, type: r.assignment_type },
    });
    await load();
    toast.success("Removed.");
  };

  const switchView = (id) => {
    if (id !== view && changes.length) toast.warn(`Discarded ${changes.length} unsaved matrix change(s).`);
    setView(id);
    if (id !== "matrix") setDraft({});
  };

  return (
    <div className="ap-page">
      <ToastContainer position="top-center" />
      <div className="ap-head">
        <div>
          <h1 className="ap-title"><span className="ap-title-ic"><RiTeamLine /></span>Staff Assignments</h1>
          <p className="ap-sub">Every class and subject taught across the school, grouped by the academic staff member responsible for it. A staff member made <b>form teacher</b> of a class owns every subject in it; a <b>subject teacher</b> owns only the subjects ticked here.</p>
        </div>
        <div className="ap-actions">
          <span className="ap-pill blue"><RiTeamLine /> {view === "records" ? visible.length : rows.length} assignment{view === "records" ? visible.length : rows.length === 1 ? "" : "s"}</span>
          <button className="ap-btn ghost" onClick={load}><RiRefreshLine /> Refresh</button>
          <button className="ap-btn primary" onClick={openNew}><RiAddLine /> New Assignment</button>
        </div>
      </div>

      <div className="sa-tabs" role="tablist" aria-label="Assignment views">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              className={"sa-tab" + (view === v.id ? " active" : "")}
              onClick={() => switchView(v.id)}
              title={v.hint}
            >
              <Icon /> {v.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="ap-card"><div className="ap-loading"><div className="ap-spinner" /> Loading…</div></div>
      ) : view === "matrix" ? (
        <div className="sa-matrix">
          <div className="sa-matrix-pick">
            <div className="sa-picker">
              <label className="ap-label">Staff member</label>
              <div className="ap-search">
                <RiSearchLine />
                <input
                  className="ap-input"
                  placeholder="Search staff by name, number or role…"
                  value={staffQuery}
                  onChange={(e) => setStaffQuery(e.target.value)}
                />
              </div>
              <div className="sa-picklist">
                {filteredStaff.length === 0 ? (
                  <div className="ap-empty"><RiInboxLine /> No staff member matches that search.</div>
                ) : filteredStaff.map((s) => {
                  const count = rows.filter((r) => r.staff_id === s.id).length;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={"sa-pickitem" + (matrixStaff === s.id ? " active" : "")}
                      onClick={() => pickStaff(s.id)}
                    >
                      <span className="nm">{s.name}{s.staff_no ? <span className="ap-muted"> · {s.staff_no}</span> : null}</span>
                      <span className="ct">{count} assignment{count === 1 ? "" : "s"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sa-picker">
              <label className="ap-label">Academic session</label>
              <input
                className="ap-input"
                placeholder="e.g. 2025/2026"
                value={matrixSession}
                onChange={(e) => setMatrixSession(e.target.value)}
              />
              <p className="ap-hint">
                <RiInformationLine /> New rows are tagged with this session. Leave it as the school session
                so the staff portal picks them up immediately.
              </p>
              {matrixStaff && (
                <button className="ap-btn ghost sm" onClick={() => pickStaff("")} type="button">
                  <RiCloseLine /> Clear selection
                </button>
              )}
            </div>
          </div>

          {!matrixStaff ? (
            <div className="ap-card">
              <div className="ap-card-head"><RiUserStarLine /> Pick a staff member</div>
              <div className="ap-empty pad">
                Choose someone on the left, then mark the classes they are <b>form teacher</b> of and the
                individual subjects they teach. Nothing is saved until you press <b>Save Changes</b>.
              </div>
            </div>
          ) : (
            <>
              <div className="ap-toolbar">
                <div className="ap-search">
                  <RiSearchLine />
                  <input className="ap-input" placeholder="Filter classes…" value={matrixClassQuery} onChange={(e) => setMatrixClassQuery(e.target.value)} />
                </div>
                <span className="ap-pill">Editing <b>{staffName(matrixStaff)}</b></span>
              </div>

              {matrixClasses.map((cls) => {
                const isForm = formTeacherOn(cls);
                const subjects = subjectsForClass(cls);
                const extraStored = subRowsOf(cls)
                  .map((r) => r.subject)
                  .filter((s) => !subjects.some((x) => normSub(x) === normSub(s)));
                const count = staffRows(cls).length;
                const open = expanded[cls] !== undefined ? expanded[cls] : isForm || count > 0;
                const held = ctRowOf(cls);
                const other = otherCtOf(cls);
                const changedHere = changes.some((c) => canonClass(c.class) === canonClass(cls));
                return (
                  <div key={cls} className={"sa-matrix-card" + (changedHere ? " changed" : "")}>
                    <div className="sa-matrix-head">
                      <button type="button" className="sa-expand" onClick={() => setExpanded((e) => ({ ...e, [cls]: !open }))}>
                        {open ? <RiArrowDownSLine /> : <RiArrowRightSLine />}
                      </button>
                      <b className="sa-cls">{cls}</b>
                      {isForm && <span className="ap-badge info">Form teacher</span>}
                      {!isForm && held && <span className="ap-badge warn">Staged: form teacher removed</span>}
                      {isForm && other && (
                        <span className="ap-badge warn">
                          Transfers from {staffName(other.staff_id)}
                        </span>
                      )}
                      {!isForm && count > 0 && (
                        <span className="ap-muted sa-sub-count">{count} stored row(s)</span>
                      )}
                      <label className="sa-switch" title={isForm ? "Form teacher has every subject in this class" : "Mark as form teacher of this class"}>
                        <input
                          type="checkbox"
                          className="sa-switch-input"
                          checked={isForm}
                          disabled={!matrixStaff}
                          onChange={(e) => toggleFormTeacher(cls, e.target.checked)}
                        />
                        <span className="sa-switch-track"><span className="sa-switch-thumb" /></span>
                        <span className={"sa-switch-state" + (isForm ? " on" : "")}>{isForm ? "Form teacher" : "Subjects only"}</span>
                      </label>
                    </div>

                    {open && (
                      <div className="sa-matrix-body">
                        {isForm ? (
                          <p className="sa-note"><RiCheckLine /> Form teacher covers all subjects in {cls} — individual subjects are locked on.</p>
                        ) : (
                          <>
                            <div className="sa-chips">
                              {subjects.map((s) => {
                                const on = subjectOn(cls, s);
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    className={"sa-chip" + (on ? " on" : "")}
                                    onClick={() => toggleSubject(cls, s, !on)}
                                  >
                                    {on ? <RiCheckLine /> : <RiAddLine />} {s}
                                  </button>
                                );
                              })}
                              {extraStored.map((s) => {
                                const on = subjectOn(cls, s);
                                return (
                                  <button
                                    key={`x-${s}`}
                                    type="button"
                                    className="sa-chip legacy on"
                                    title="Stored subject that is not in this class list"
                                    onClick={() => toggleSubject(cls, s, false)}
                                  >
                                    <RiCheckLine /> {s}
                                  </button>
                                );
                              })}
                            </div>
                            {subjects.length === 0 && (
                              <p className="ap-hint"><RiInformationLine /> No subject list is configured for {cls}; use <b>New Assignment</b> in the All Records view for legacy subjects.</p>
                            )}
                            {count > 0 && !changes.some((c) => canonClass(c.class) === canonClass(cls)) && (
                              <button className="ap-btn ghost sm" type="button" onClick={() => setPendingClear(cls)}>
                                <RiDeleteBinLine /> Clear {cls}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {changes.length > 0 && (
                <div className="sa-stickybar">
                  <span className="ap-pill">
                    <RiErrorWarningLine /> {changes.length} unsaved change{changes.length === 1 ? "" : "s"}
                    {additions.length ? ` · ${additions.length} to add` : ""}
                    {stagedRemovals.length ? ` · ${stagedRemovals.length} to remove` : ""}
                    {transfers.length ? ` · ${transfers.length} transfer` : ""}
                  </span>
                  <div className="sa-sticky-actions">
                    <button className="ap-btn ghost" type="button" onClick={() => { setDraft({}); toast.info("Changes discarded."); }}>
                      <RiCloseLine /> Discard
                    </button>
                    <button className="ap-btn primary" type="button" onClick={() => setShowReview(true)}>
                      <RiSave3Line /> Save Changes
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="sa-grid">
          <div className="ap-toolbar">
            <select className="ap-input" value={gridCls} onChange={(e) => setGridCls(e.target.value)}>
              <option value="">All classes with assignments</option>
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="sa-switch inline" title="Show every class, even those with no assignment yet">
              <input type="checkbox" className="sa-switch-input" checked={showAllClasses} onChange={(e) => setShowAllClasses(e.target.checked)} />
              <span className="sa-switch-track"><span className="sa-switch-thumb" /></span>
              <span className={"sa-switch-state" + (showAllClasses ? " on" : "")}>Include empty classes</span>
            </label>
            <span className="ap-pill blue"><RiLayoutGridLine /> {gridClasses.length} class row(s)</span>
          </div>

          <div className="ap-card">
            <div className="ap-tablewrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Class</th><th>Form Teacher</th><th>Subjects &amp; teachers</th><th className="text-end">Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {gridClasses.length === 0 ? (
                    <tr><td colSpan={4} className="ap-empty"><RiInboxLine /> Nothing assigned yet — open the Teacher Matrix to build a teaching map.</td></tr>
                  ) : gridClasses.map((cls) => {
                    const g = gridData[cls] || { formTeachers: [], pairs: {} };
                    const pairs = Object.values(g.pairs);
                    return (
                      <tr key={cls}>
                        <td><b>{cls}</b></td>
                        <td>
                          <button type="button" className="sa-cell-btn" onClick={() => openCell(cls, null, "class_teacher")}>
                            {g.formTeachers.length
                              ? g.formTeachers.map((r) => staffName(r.staff_id)).join(", ")
                              : <span className="ap-muted">Not assigned — click to set</span>}
                          </button>
                        </td>
                        <td>
                          {pairs.length === 0 ? <span className="ap-muted">No individual subjects — only the form teacher covers this class</span> : (
                            <div className="sa-chips tight">
                              {pairs.map((p) => (
                                <button
                                  key={p.label}
                                  type="button"
                                  className="sa-chip link"
                                  onClick={() => openCell(cls, p.label, "subject_teacher")}
                                >
                                  <b>{p.label}</b>
                                  <span className="who">{p.rows.map((r) => staffName(r.staff_id)).join(" / ")}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="text-end">{pairs.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="sa-records">
          <div className="ap-toolbar">
            <div className="ap-search">
              <RiSearchLine />
              <input className="ap-input" placeholder="Search staff, class, subject…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="ap-input" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
              <option value="">All staff</option>
              {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.staff_no ? ` (${s.staff_no})` : ""}</option>)}
            </select>
            <select className="ap-input" value={clsFilter} onChange={(e) => setClsFilter(e.target.value)}>
              <option value="">All classes</option>
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="ap-card">
            <div className="ap-tablewrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Staff</th><th>Class</th><th>Subject</th><th>Type</th><th>Session</th><th>Added</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr><td colSpan={7} className="ap-empty"><RiInboxLine /> No class/subject assignments found.</td></tr>
                  ) : visible.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <b>{staffName(r.staff_id)}</b>
                        {staffMap[r.staff_id]?.staff_no ? <div className="ap-muted" style={{ fontSize: "0.78rem" }}>{staffMap[r.staff_id].staff_no}</div> : null}
                      </td>
                      <td>{r.class || "—"}</td>
                      <td>{r.subject || "All subjects"}</td>
                      <td>{typeBadge(r.assignment_type)}</td>
                      <td>{r.academic_session || "—"}</td>
                      <td>{fmtDate(r.created_at)}</td>
                      <td className="text-end">
                        <button className="ap-btn sm red" onClick={() => setPendingDelete(r)}><RiDeleteBinLine /> Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add assignment modal */}
      <Modal show={show} onHide={() => setShow(false)} centered contentClassName="ap-modal-content">
        <Modal.Header className="ap-modal-head" closeButton closeVariant="white">
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>New Staff Assignment</Modal.Title>
        </Modal.Header>
        <Modal.Body className="ap-modal-body">
          <div className="row g-3">
            <div className="col-12">
              <label className="ap-label">Staff member *</label>
              <select className="ap-input" value={form.staff_id} onChange={(e) => setField("staff_id", e.target.value)}>
                <option value="">Select staff…</option>
                {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.staff_no ? ` (${s.staff_no})` : ""}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="ap-label">Class *</label>
              <select className="ap-input" value={form.class} onChange={(e) => setField("class", e.target.value)}>
                <option value="">Select class…</option>
                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="ap-label">Type *</label>
              <select className="ap-input" value={form.assignment_type} onChange={(e) => setField("assignment_type", e.target.value)}>
                <option value="subject_teacher">Subject Teacher</option>
                <option value="class_teacher">Class Teacher</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="ap-label">Subject {form.assignment_type === "class_teacher" ? "" : "*"}</label>
              <select
                className="ap-input"
                value={form.subject}
                disabled={form.assignment_type === "class_teacher" || !form.class}
                onChange={(e) => setField("subject", e.target.value)}
              >
                <option value="">{form.assignment_type === "class_teacher" ? "Whole class" : form.class ? "Select subject…" : "Pick a class first"}</option>
                {formSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="ap-label">Academic session</label>
              <input className="ap-input" placeholder="e.g. 2025/2026" value={form.academic_session} onChange={(e) => setField("academic_session", e.target.value)} />
            </div>
          </div>
          <p className="ap-hint" style={{ marginTop: 10 }}>
            <RiErrorWarningLine /> Class teachers get the full class in the staff portal; subject teachers only the subjects assigned here.
          </p>
        </Modal.Body>
        <Modal.Footer className="ap-modal-foot">
          <Button variant="light" onClick={() => setShow(false)}><RiCloseLine /> Cancel</Button>
          <Button variant="success" disabled={saving} onClick={save}>{saving ? "Saving…" : "Add Assignment"}</Button>
        </Modal.Footer>
      </Modal>

      {/* Matrix review (staged edits are only written here) */}
      <Modal show={showReview} onHide={() => !applying && setShowReview(false)} centered contentClassName="ap-modal-content">
        <Modal.Header className="ap-modal-head" closeButton closeVariant="white">
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>Save teaching map for {matrixStaff ? staffName(matrixStaff) : ""}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="ap-modal-body">
          <div className="sa-review">
            <div className="sa-review-group">
              <h6><RiAddLine /> Adding ({additions.length})</h6>
              {additions.length === 0 ? <p className="ap-muted">Nothing to add.</p> : additions.map((a) => (
                <p key={`${a.class}-${a.subject}`}>
                  <b>{a.type === "class_teacher" ? "Form teacher" : a.subject}</b> · {a.class}
                  <span className="ap-muted"> ({matrixSession || "no session tag"})</span>
                </p>
              ))}
            </div>
            <div className="sa-review-group">
              <h6><RiDeleteBinLine /> Removing ({stagedRemovals.length})</h6>
              {stagedRemovals.length === 0 ? <p className="ap-muted">Nothing to remove.</p> : stagedRemovals.map((r) => (
                <p key={`${r.class}-${r.subject}-${r.id}`}>
                  <b>{r.type === "class_teacher" ? "Form teacher" : r.subject}</b> · {r.class}
                </p>
              ))}
            </div>
            {transfers.length > 0 && (
              <div className="sa-review-group">
                <h6><RiUserStarLine /> Form teacher transfer ({transfers.length})</h6>
                {transfers.map((t) => (
                  <p key={`t-${t.class}`}>
                    <b>{t.class}</b>: {staffName(t.from.staff_id)} <span className="ap-muted">→</span> <b>{staffName(matrixStaff)}</b>
                    <span className="ap-muted"> (their subject rows are kept)</span>
                  </p>
                ))}
              </div>
            )}
          </div>
          <p className="ap-hint"><RiErrorWarningLine /> These rows drive what {staffName(matrixStaff)} can open in the staff portal — results and CBT follow this scope.</p>
        </Modal.Body>
        <Modal.Footer className="ap-modal-foot">
          <button className="ap-btn ghost" disabled={applying} onClick={() => setShowReview(false)}><RiCloseLine /> Cancel</button>
          <button className="ap-btn primary" disabled={applying} onClick={applyDraft}>
            <RiSave3Line /> {applying ? "Saving…" : `Apply ${changes.length} change${changes.length === 1 ? "" : "s"}`}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Grid cell assign/remove */}
      <Modal show={!!cell} onHide={() => !cellBusy && setCell(null)} centered contentClassName="ap-modal-content">
        <Modal.Header className="ap-modal-head" closeButton closeVariant="white">
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>
            {cell ? (cell.type === "class_teacher" ? `Form teacher · ${cell.class}` : `${cell.subject} · ${cell.class}`) : ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="ap-modal-body">
          {cell && (
            <>
              <label className="ap-label">Currently assigned</label>
              {cellCurrent.length === 0 ? (
                <p className="ap-muted">Nobody yet.</p>
              ) : (
                <div className="sa-cell-list">
                  {cellCurrent.map((r) => (
                    <div key={r.id} className="sa-cell-row">
                      <span>{staffName(r.staff_id)}{r.academic_session ? <span className="ap-muted"> · {r.academic_session}</span> : null}</span>
                      <button className="ap-btn sm red" onClick={() => removeCellRow(r)} disabled={cellBusy}>
                        <RiDeleteBinLine /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {cell.type === "class_teacher" && cellCurrent.length > 0 && (
                <p className="ap-hint"><RiInformationLine /> Assigning a new form teacher hands {cell.class} over and removes the previous class-teacher row only.</p>
              )}
              <label className="ap-label" style={{ marginTop: 12 }}>Assign to</label>
              <select className="ap-input" value={cellStaff} onChange={(e) => setCellStaff(e.target.value)}>
                <option value="">Select staff…</option>
                {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.staff_no ? ` (${s.staff_no})` : ""}</option>)}
              </select>
              {cell.type === "subject_teacher" && (
                <p className="ap-hint">
                  Subject for this class: {cellSubjects.slice(0, 6).join(", ")}
                  {cellSubjects.length > 6 ? ` +${cellSubjects.length - 6} more` : ""}
                </p>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="ap-modal-foot">
          <button className="ap-btn ghost" disabled={cellBusy} onClick={() => setCell(null)}><RiCloseLine /> Close</button>
          <button className="ap-btn primary" disabled={cellBusy || !cellStaff} onClick={assignCell}>
            <RiCheckLine /> {cellBusy ? "Saving…" : cell?.type === "class_teacher" && cellCurrent.length ? "Assign as Form Teacher (transfer)" : "Assign"}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Clear class staging confirmation (admin UI convention: no browser confirm) */}
      <Modal show={!!pendingClear} onHide={() => setPendingClear(null)} centered contentClassName="ap-modal-content">
        <Modal.Header className="ap-modal-head red" closeButton closeVariant="white">
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>Stage {pendingClear} for removal?</Modal.Title>
        </Modal.Header>
        <Modal.Body className="ap-modal-body">
          {pendingClear && (
            <p style={{ margin: 0 }}>
              Queue every assignment of <b>{matrixStaff ? staffName(matrixStaff) : ""}</b> in <b>{pendingClear}</b>
              ({staffRows(pendingClear).length} row(s)) for removal. Nothing is deleted until you press
              <b> Save Changes</b>.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer className="ap-modal-foot">
          <button className="ap-btn ghost" onClick={() => setPendingClear(null)}><RiCloseLine /> Cancel</button>
          <button className="ap-btn red" onClick={() => stageClearClass(pendingClear)}><RiDeleteBinLine /> Stage Removal</button>
        </Modal.Footer>
      </Modal>

      {/* Delete confirmation (admin UI convention: no browser confirm) */}
      <Modal show={!!pendingDelete} onHide={() => setPendingDelete(null)} centered contentClassName="ap-modal-content">
        <Modal.Header className="ap-modal-head red" closeButton closeVariant="white">
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>Remove assignment?</Modal.Title>
        </Modal.Header>
        <Modal.Body className="ap-modal-body">
          {pendingDelete && (
            <p style={{ margin: 0 }}>
              Remove <b>{pendingDelete.subject || "whole class"}</b> for <b>{pendingDelete.class}</b> from <b>{staffName(pendingDelete.staff_id)}</b>?
              This cannot be undone.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer className="ap-modal-foot">
          <button className="ap-btn ghost" onClick={() => setPendingDelete(null)}><RiCloseLine /> Cancel</button>
          <button className="ap-btn red" onClick={confirmDelete}><RiDeleteBinLine /> Remove</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
