"use client";

// SessionTools — super_admin (developer) operational tools, deliberately split
// into three independent functions the school runs at the start of a year:
//   1. Academic Session  — step the school forward (+1) / back (−1) a session.
//   2. Class Promotion   — move ALL or SELECTED students up one class.
//   3. Student Tokens     — hand out fresh 6-char uppercase alphanumeric tokens
//                           to ALL or SELECTED students (syncs result rows).
// Gated to developers (isDev: DEV_EMAILS + devauth), matching the Data Tools
// hardening pattern — the check runs INSIDE the component, not just in the nav.
// All writes go through the signed-in admin's client (same RLS posture as the
// existing Settings rollover), so no service-role route is needed here.

import React, { useEffect, useState, useMemo } from "react";
import { Modal } from "react-bootstrap";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  RiRocketLine,
  RiCalendarScheduleLine,
  RiGraduationCapLine,
  RiKeyLine,
  RiArrowUpCircleLine,
  RiArrowDownCircleLine,
  RiSearchLine,
  RiErrorWarningLine,
  RiCloseLine,
  RiCheckLine,
  RiLoader4Line,
  RiRefreshLine,
  RiFileCopyLine,
  RiInboxLine,
  RiEditLine,
  RiArrowRightLine,
  RiHistoryLine,
  RiCalendarLine,
  RiStackLine,
} from "react-icons/ri";
import "../styles/AdminPages.css";
import "../styles/settings.css"; // .settings-tabs / .settings-tab for the tab bar
import { fetchAuthRoles, isDev } from "../utils/authUtils";
import { CLASS_OPTIONS, canonClass } from "../utils/classOptions";
import {
  nextClassFor,
  nextSessionLabel,
  previousSessionFromHistory,
  generateUniqueTokens,
} from "../utils/sessionTools";
import { logAction } from "../api/auditLog.js";

const TABS = [
  { key: "session", label: "Academic Session", icon: RiCalendarScheduleLine },
  { key: "promote", label: "Class Promotion", icon: RiGraduationCapLine },
  { key: "tokens", label: "Student Tokens", icon: RiKeyLine },
];

export default function SessionTools() {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState({ devEmails: [] });
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState("session");

  const [settingsRow, setSettingsRow] = useState(null); // the single jmis_settings row
  const [session, setSession] = useState("");
  const [term, setTerm] = useState("");
  const [sessionHistory, setSessionHistory] = useState([]);

  // Session label correction + make-current (ported from the Settings page).
  const [editCurrent, setEditCurrent] = useState(false);
  const [currentDraft, setCurrentDraft] = useState("");
  const [editingIdx, setEditingIdx] = useState(-1);
  const [editDraft, setEditDraft] = useState("");
  // One-click rollover: archive results + optional promote + optional token rotation.
  const [rollover, setRollover] = useState({ show: false, newLabel: "", promote: true, rotateTokens: true, preview: [] });
  const [rolloverBusy, setRolloverBusy] = useState(false);

  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // shared student-selection scope (used by Promote + Tokens tabs)
  const [scope, setScope] = useState("all"); // 'all' | 'class' | 'selected'
  const [scopeClass, setScopeClass] = useState("");
  const [selectedIds, setSelectedIds] = useState({});
  const [search, setSearch] = useState("");

  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { title, message, confirmText, tone, action }
  const [tokenResult, setTokenResult] = useState(null); // { show, rows:[{name,token}] }

  const email = user?.user_metadata?.email || user?.email;
  const allowed = isDev(email, roles.devEmails);

  const askConfirm = ({ title, message, confirmText, tone = "green", action }) =>
    setConfirm({ title, message, confirmText, tone, action });
  const runConfirm = async () => {
    if (!confirm) return;
    const action = confirm.action;
    setConfirm(null);
    await action();
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user: cu } } = await supabase.auth.getUser();
        setUser(cu);
        setRoles(await fetchAuthRoles(supabase));
      } catch (e) {
        console.error(e);
      } finally {
        setReady(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (allowed) {
      loadSettings();
      loadStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  const loadSettings = async () => {
    const { data, error } = await supabase.from("jmis_settings").select("*").single();
    if (error) {
      if (error.code !== "PGRST116") toast.error("Failed to load settings: " + error.message);
      return;
    }
    setSettingsRow(data);
    setSession(data?.session || "");
    setTerm(data?.term || "");
    setSessionHistory(Array.isArray(data?.session_history) ? data.session_history : []);
  };

  const loadStudents = async () => {
    setLoadingStudents(true);
    const { data, error } = await supabase
      .from("jmis_student")
      .select("id, name, class")
      .order("name", { ascending: true });
    if (error) toast.error("Failed to load students: " + error.message);
    else setStudents(data || []);
    setLoadingStudents(false);
  };

  // ---- target resolution for Promote / Tokens ----
  const selectedList = useMemo(
    () => students.filter((s) => selectedIds[s.id]),
    [students, selectedIds]
  );
  const targets = useMemo(() => {
    if (scope === "all") return students;
    if (scope === "all-except") return students.filter((s) => !selectedIds[s.id]);
    if (scope === "class") return students.filter((s) => canonClass(s.class) === canonClass(scopeClass));
    return selectedList;
  }, [scope, students, scopeClass, selectedIds, selectedList]);

  const classCounts = useMemo(() => {
    const m = {};
    for (const s of students) {
      const c = canonClass(s.class) || "—";
      m[c] = (m[c] || 0) + 1;
    }
    return m;
  }, [students]);

  // ------------------------------------------------------------------
  // Tab 1 — Academic Session step forward / back (label + history only)
  // ------------------------------------------------------------------
  const updateSettingsRow = async (payload) => {
    if (!settingsRow) throw new Error("No settings row found — open Settings once first");
    const col = settingsRow.id != null ? "id" : "user_id";
    const val = settingsRow.id != null ? settingsRow.id : settingsRow.user_id;
    const { error } = await supabase.from("jmis_settings").update(payload).eq(col, val);
    if (error) throw error;
  };

  const doIncrementSession = async () => {
    setBusy(true);
    try {
      const next = nextSessionLabel(session);
      const history = [...sessionHistory, { session, endedAt: new Date().toISOString() }];
      await updateSettingsRow({ session: next, term: "1st Term", session_history: history });
      setSession(next);
      setTerm("1st Term");
      setSessionHistory(history);
      logAction(supabase, { email, role: "admin", action: "session_increment", targetTable: "jmis_settings", details: { from: session, to: next } });
      toast.success(`Academic session moved forward to ${next}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doDecrementSession = async () => {
    setBusy(true);
    try {
      const prev = previousSessionFromHistory(sessionHistory, session);
      // drop the last history entry that we are stepping back into
      const history = sessionHistory.slice(0, -1);
      await updateSettingsRow({ session: prev, session_history: history });
      setSession(prev);
      setSessionHistory(history);
      logAction(supabase, { email, role: "admin", action: "session_decrement", targetTable: "jmis_settings", details: { from: session, to: prev } });
      toast.success(`Academic session reverted to ${prev}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleIncrement = () => {
    const next = nextSessionLabel(session);
    if (!next) {
      toast.error(`Cannot compute the next session from "${session || "(empty)"}". Use Settings to set a "YYYY/YYYY" session label first.`);
      return;
    }
    askConfirm({
      title: "Move to next session",
      message: `Change the academic session from ${session} to ${next} and reset the term to 1st Term? This only updates the session label and history — it does NOT promote students, rotate tokens or archive results (use the other tabs for those).`,
      confirmText: "Yes, move forward",
      tone: "green",
      action: doIncrementSession,
    });
  };

  const handleDecrement = () => {
    const prev = previousSessionFromHistory(sessionHistory, session);
    if (!prev) {
      toast.error("There is no previous session in the history to revert to.");
      return;
    }
    askConfirm({
      title: "Revert to previous session",
      message: `Step the academic session back from ${session} to ${prev}? This restores the previous session label recorded in the history and removes that entry.`,
      confirmText: "Yes, revert",
      tone: "amber",
      action: doDecrementSession,
    });
  };

  const doChangeTerm = async (newTerm) => {
    setBusy(true);
    try {
      await updateSettingsRow({ term: newTerm });
      setTerm(newTerm);
      logAction(supabase, { email, role: "admin", action: "term_change", targetTable: "jmis_settings", details: { from: term, to: newTerm } });
      toast.success(`Current term set to ${newTerm}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleChangeTerm = (newTerm) => {
    if (newTerm === term) return;
    askConfirm({
      title: "Change current term",
      message: `Set the current term from ${term || "—"} to ${newTerm}? This only updates the term label on the settings row — it does not promote students, reissue tokens or archive results.`,
      confirmText: `Yes, set ${newTerm}`,
      tone: "blue",
      action: () => doChangeTerm(newTerm),
    });
  };

  // ---- Session label correction + make-current (ported from Settings) ----
  const formatDate = (iso) => { try { return iso ? new Date(iso).toLocaleDateString() : ""; } catch { return ""; } };

  // Re-tag archived result rows so grouping follows a corrected session label.
  const retagArchivedSession = async (fromLabel, toLabel) => {
    if (!fromLabel || fromLabel === toLabel) return;
    const { error } = await supabase.from("jmis_result_history").update({ archived_session: toLabel }).eq("archived_session", fromLabel);
    if (error) throw error;
  };

  // Correct the label of the CURRENT (active) session + re-tag its archived results.
  const saveCurrentSession = async () => {
    const next = currentDraft.trim();
    if (!next) { toast.warn("Session label cannot be empty"); return; }
    if (next === session) { setEditCurrent(false); return; }
    setBusy(true);
    try {
      await retagArchivedSession(session, next);
      await updateSettingsRow({ session: next });
      setSession(next);
      setEditCurrent(false);
      logAction(supabase, { email, role: "admin", action: "session_label_corrected", targetTable: "jmis_settings", details: { from: session, to: next, scope: "current" } });
      toast.success(`Current session corrected to ${next}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Correct the label of a PAST session in history + re-tag its archived results.
  const saveHistoryCorrection = async (idx) => {
    const next = editDraft.trim();
    const old = sessionHistory[idx]?.session;
    if (!next) { toast.warn("Session label cannot be empty"); return; }
    if (next === old) { setEditingIdx(-1); return; }
    const updated = sessionHistory.map((h, i) => (i === idx ? { ...h, session: next } : h));
    setBusy(true);
    try {
      await retagArchivedSession(old, next);
      await updateSettingsRow({ session_history: updated });
      setSessionHistory(updated);
      setEditingIdx(-1);
      logAction(supabase, { email, role: "admin", action: "session_label_corrected", targetTable: "jmis_settings", details: { from: old, to: next, scope: "history" } });
      toast.success(`Session corrected to ${next} — archived results re-tagged`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Make a past session the active one (label + term only — no re-promotion /
  // token rotation / result restore). The previously active session goes back
  // into history so nothing is lost.
  const doMakeSessionCurrent = async (target) => {
    const withoutTarget = sessionHistory.filter((h) => h.session !== target);
    const nextHistory = session ? [...withoutTarget, { session, endedAt: new Date().toISOString(), resultsArchived: 0 }] : withoutTarget;
    const previous = session;
    setBusy(true);
    try {
      await updateSettingsRow({ session: target, term: "1st Term", session_history: nextHistory });
      setSession(target);
      setTerm("1st Term");
      setSessionHistory(nextHistory);
      logAction(supabase, { email, role: "admin", action: "session_activated", targetTable: "jmis_settings", details: { activated: target, previous } });
      toast.success(`Current session switched to ${target}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleMakeCurrent = (target) => {
    if (!target || target === session) { toast.warn("That session is already current."); return; }
    askConfirm({
      title: "Make session current",
      message: `Set ${target} as the current session and reset the term to 1st Term? The current session ${session || "(none)"} moves back into history. This only switches the label and term — it does NOT re-run promotion, token rotation or restore archived results.`,
      confirmText: "Yes, switch session",
      tone: "amber",
      action: () => doMakeSessionCurrent(target),
    });
  };

  // ---- One-click rollover: archive results + optional promote + optional tokens ----
  const openRollover = () => {
    const preview = students.map((s) => { const to = nextClassFor(s.class); return { id: s.id, name: s.name, from: s.class, to: to || s.class, held: !to }; });
    setRollover({ show: true, newLabel: "", promote: true, rotateTokens: true, preview });
  };

  // Copy all jmis_result rows into jmis_result_history (paged, raw passthrough).
  // Deletes the source rows ONLY after the inserted count matches the source count.
  const archiveResultsToHistory = async () => {
    let from = 0, sourceCount = 0, insertedOk = 0;
    for (;;) {
      const { data, error } = await supabase.from("jmis_result").select("*").range(from, from + 999);
      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) break;
      sourceCount += rows.length;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500).map(({ id, ...rest }) => ({ ...rest, archived_session: session }));
        const { error: insErr } = await supabase.from("jmis_result_history").insert(chunk);
        if (insErr) throw insErr;
        insertedOk += chunk.length;
      }
      if (rows.length < 1000) break;
      from += 1000;
    }
    if (insertedOk !== sourceCount) throw new Error(`Archive verification failed (${insertedOk}/${sourceCount} rows copied) — nothing was deleted`);
    if (sourceCount > 0) {
      const { error: delErr } = await supabase.from("jmis_result").delete().not("id", "is", null);
      if (delErr) throw delErr;
    }
    return sourceCount;
  };

  const rotateAllTokens = async () => {
    const tokens = generateUniqueTokens(students.length);
    let count = 0;
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const t = tokens[i];
      const { error } = await supabase.from("jmis_student").update({ token: t }).eq("id", s.id);
      if (error) throw error;
      const { error: rErr } = await supabase.from("jmis_result").update({ token: t, tokenCount: 5 }).eq("studentId", s.id);
      if (rErr) throw rErr;
      count++;
    }
    const { error: bulkErr } = await supabase.from("jmis_result").update({ tokenCount: 5 }).neq("tokenCount", 5);
    if (bulkErr) throw bulkErr;
    return count;
  };

  const promoteAllBulk = async () => {
    let moved = 0;
    for (const r of rollover.preview.filter((x) => !x.held)) {
      const { error } = await supabase.from("jmis_student").update({ class: r.to }).eq("id", r.id);
      if (error) throw error;
      moved++;
    }
    return moved;
  };

  const doRollover = async () => {
    const newLabel = rollover.newLabel.trim();
    if (!newLabel) { toast.warn("Enter the new session label first"); return; }
    const previousSession = session;
    setRolloverBusy(true);
    try {
      let rotated = 0;
      if (rollover.rotateTokens) {
        rotated = await rotateAllTokens();
        logAction(supabase, { email, role: "admin", action: "student_token_rotation", targetTable: "jmis_student", details: { previousSession, studentsRotated: rotated, via: "rollover" } });
      }
      const archived = await archiveResultsToHistory();
      logAction(supabase, { email, role: "admin", action: "results_archive", targetTable: "jmis_result_history", details: { previousSession, rowsArchived: archived } });
      let moved = 0;
      if (rollover.promote) {
        moved = await promoteAllBulk();
        logAction(supabase, { email, role: "admin", action: "student_promotion", targetTable: "jmis_student", details: { previousSession, studentsPromoted: moved, via: "rollover" } });
      }
      const history = [...sessionHistory, { session: previousSession, endedAt: new Date().toISOString(), resultsArchived: archived }];
      await updateSettingsRow({ session: newLabel, term: "1st Term", session_history: history });
      setSession(newLabel);
      setTerm("1st Term");
      setSessionHistory(history);
      await loadStudents();
      setRollover({ show: false, newLabel: "", promote: true, rotateTokens: true, preview: [] });
      toast.success(`New session started — ${rotated} tokens rotated, ${archived} result rows archived, ${moved} students promoted`);
    } catch (e) {
      console.error("Rollover failed:", e);
      toast.error("Rollover failed: " + e.message);
    } finally {
      setRolloverBusy(false);
    }
  };

  // ------------------------------------------------------------------
  // Tab 2 — Class promotion (all / class / selected)
  // ------------------------------------------------------------------
  const promotionRows = useMemo(
    () => targets.map((s) => ({ ...s, to: nextClassFor(s.class), held: !nextClassFor(s.class) })),
    [targets]
  );
  const promotable = promotionRows.filter((r) => !r.held);

  const doPromote = async () => {
    setBusy(true);
    let moved = 0;
    try {
      for (const r of promotable) {
        const { error } = await supabase.from("jmis_student").update({ class: r.to }).eq("id", r.id);
        if (error) throw error;
        moved++;
      }
      await loadStudents();
      logAction(supabase, { email, role: "admin", action: "student_promotion", targetTable: "jmis_student", details: { scope, studentsPromoted: moved } });
      toast.success(`${moved} student${moved === 1 ? "" : "s"} promoted${promotionRows.length - moved > 0 ? `, ${promotionRows.length - moved} held back (top class)` : ""}`);
      setScope("all"); setScopeClass(""); setSelectedIds({});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePromote = () => {
    if (targets.length === 0) { toast.error("No students selected for this scope."); return; }
    if (promotable.length === 0) { toast.warn("Every selected student is already in the top class — nothing to promote."); return; }
    askConfirm({
      title: "Promote students",
      message: `Move ${promotable.length} student(s) up one class? Students already in the top class (${promotionRows.length - promotable.length}) are held back. This changes only the class field.`,
      confirmText: "Yes, promote",
      tone: "green",
      action: doPromote,
    });
  };

  // ------------------------------------------------------------------
  // Tab 3 — Student tokens (all / class / selected)
  // ------------------------------------------------------------------
  const doRotate = async () => {
    setBusy(true);
    try {
      const tokens = generateUniqueTokens(targets.length);
      const out = [];
      for (let i = 0; i < targets.length; i++) {
        const s = targets[i];
        const t = tokens[i];
        const { error } = await supabase.from("jmis_student").update({ token: t }).eq("id", s.id);
        if (error) throw error;
        // sync existing result rows to the new token + reset its view counter
        const { error: rErr } = await supabase
          .from("jmis_result")
          .update({ token: t, tokenCount: 5 })
          .eq("studentId", s.id);
        if (rErr) throw rErr;
        out.push({ name: s.name, token: t });
      }
      await loadStudents();
      logAction(supabase, { email, role: "admin", action: "student_token_rotation", targetTable: "jmis_student", details: { scope, studentsRotated: out.length } });
      setTokenResult({ show: true, rows: out });
      setScope("all"); setScopeClass(""); setSelectedIds({});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRotate = () => {
    if (targets.length === 0) { toast.error("No students selected for this scope."); return; }
    askConfirm({
      title: "Generate new tokens",
      message: `Give ${targets.length} student(s) a brand-new 6-character token (uppercase letters + numbers)? Their linked result rows are synced and each result-view counter is reset to 5. Old tokens stop working immediately.`,
      confirmText: "Yes, generate tokens",
      tone: "blue",
      action: doRotate,
    });
  };

  const copyTokens = () => {
    const text = (tokenResult?.rows || []).map((r) => `${r.name}\t${r.token}`).join("\n");
    navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard")).catch(() => toast.error("Copy failed"));
  };

  // Shared students-scope filter — defined before the render guards so the
  // hook order stays identical on every render (Rules of Hooks).
  const filteredPicker = useMemo(() => {
    const q = search.toLowerCase();
    let list = students;
    if (scope === "class" && scopeClass) list = students.filter((s) => canonClass(s.class) === canonClass(scopeClass));
    if (q) list = list.filter((s) => (s.name || "").toLowerCase().includes(q) || (s.class || "").toLowerCase().includes(q));
    return list;
  }, [students, scope, scopeClass, search]);

  // ---- render guards ----
  if (!ready) {
    return (
      <>
        <ToastContainer />
        <div className="ap-loading"><div className="ap-spinner" /><div>Verifying credentials...</div></div>
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
          <p>Session tools are limited to super administrators (developers).</p>
          <button className="ap-btn ghost" onClick={() => (window.location.href = "/home")}>Back to Dashboard</button>
        </div>
      </>
    );
  }

  // ---- shared students-scope controls ----
  const toggleSelected = (id) =>
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const StudentScopeControls = () => (
    <div className="ap-card" style={{ marginBottom: 14 }}>
      <div className="ap-card-head"><span className="ic"><RiSearchLine /></span> Choose students</div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {[
            { v: "all", label: `All students (${students.length})` },
            { v: "all-except", label: `All except selected (${students.length - selectedList.length})` },
            { v: "class", label: "By class" },
            { v: "selected", label: `Selected (${selectedList.length})` },
          ].map((o) => (
            <button
              key={o.v}
              className={"ap-btn sm " + (scope === o.v ? "primary" : "ghost")}
              onClick={() => setScope(o.v)}
            >
              {o.label}
            </button>
          ))}
        </div>

        {scope === "class" && (
          <select className="ap-input" style={{ maxWidth: 260 }} value={scopeClass} onChange={(e) => setScopeClass(e.target.value)}>
            <option value="">Select a class…</option>
            {CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>{c} ({classCounts[c] || 0})</option>
            ))}
          </select>
        )}

        {(scope === "selected" || scope === "all-except") && (
          <>
            {scope === "all-except" && (
              <div className="ap-hint" style={{ color: "#b45309" }}>Tick the students to <b>skip</b> — e.g. new admissions already placed in the correct class. The action applies to <b>everyone else</b>.</div>
            )}
            <div className="ap-search" style={{ maxWidth: 360, width: "100%", alignSelf: "flex-start", flex: "0 0 auto" }}>
              <RiSearchLine />
              <input className="ap-input" placeholder="Search name or class" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ap-btn sm ghost" onClick={() => setSelectedIds(Object.fromEntries(filteredPicker.map((s) => [s.id, true])))}>Select all shown</button>
              <button className="ap-btn sm ghost" onClick={() => setSelectedIds({})}>Clear</button>
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--card-border,#e5e7eb)", borderRadius: 10 }}>
              {filteredPicker.length === 0 ? (
                <div className="ap-empty"><RiInboxLine /> No students found.</div>
              ) : (
                filteredPicker.map((s) => (
                  <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <input type="checkbox" checked={!!selectedIds[s.id]} onChange={() => toggleSelected(s.id)} />
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <span className="ap-hint">{canonClass(s.class) || "—"}</span>
                  </label>
                ))
              )}
            </div>
          </>
        )}

        <div className="ap-hint">
          Applying to <b>{targets.length}</b> student(s).
        </div>
      </div>
    </div>
  );

  return (
    <>
      <ToastContainer />
      <div className="ap-page">
        <div className="ap-head">
          <div>
            <h1 className="ap-title"><span className="ap-title-ic"><RiRocketLine /></span> Session Tools</h1>
            <p className="ap-sub">Start-of-year operations for super administrators: move the academic session, promote students and reissue result tokens.</p>
          </div>
          <div className="ap-actions">
            <button className="ap-btn ghost" onClick={() => { loadSettings(); loadStudents(); }} disabled={busy}>
              <RiRefreshLine /> Refresh
            </button>
          </div>
        </div>

        <div className="settings-tabs" role="tablist">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={activeTab === t.key}
                className={"settings-tab" + (activeTab === t.key ? " active" : "")}
                onClick={() => setActiveTab(t.key)}
              >
                <Icon /> {t.label}
              </button>
            );
          })}
        </div>

        {/* ---- TAB: Academic Session ---- */}
        {activeTab === "session" && (
          <div className="ap-card">
            <div className="ap-card-head"><span className="ic"><RiCalendarScheduleLine /></span> Academic Session</div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                <div>
                  <div className="ap-hint">Current session</div>
                  {editCurrent ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                      <input className="ap-input" style={{ width: 160 }} value={currentDraft} onChange={(e) => setCurrentDraft(e.target.value)} placeholder="e.g. 2026/2027" disabled={busy} />
                      <button className="ap-btn sm green" onClick={saveCurrentSession} disabled={busy}><RiCheckLine /> Save</button>
                      <button className="ap-btn sm ghost" onClick={() => setEditCurrent(false)} disabled={busy}><RiCloseLine /></button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{session || "—"}</div>
                      <button className="ap-btn sm ghost" title="Correct current session" onClick={() => { setCurrentDraft(session); setEditCurrent(true); }} disabled={busy}><RiEditLine /></button>
                    </div>
                  )}
                </div>
                <div>
                  <div className="ap-hint">Current term</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{term || "—"}</div>
                </div>
                <div>
                  <div className="ap-hint">Next session</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#011b97" }}>{nextSessionLabel(session) || "—"}</div>
                </div>
              </div>

              <div>
                <div className="ap-hint" style={{ marginBottom: 6 }}>Current term</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {["1st Term", "2nd Term", "3rd Term"].map((t) => (
                    <button key={t} className={"ap-btn sm " + (term === t ? "primary" : "ghost")} onClick={() => handleChangeTerm(t)} disabled={busy}>
                      {t}
                    </button>
                  ))}
                </div>
                <p className="ap-hint" style={{ margin: "6px 0 0" }}>Highlights the active term. Click another term to switch to it.</p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="ap-btn green" onClick={handleIncrement} disabled={busy}>
                  <RiArrowUpCircleLine /> Move to next session (+1)
                </button>
                <button className="ap-btn amber" onClick={handleDecrement} disabled={busy}>
                  <RiArrowDownCircleLine /> Revert to previous (−1)
                </button>
                <button className="ap-btn primary" onClick={openRollover} disabled={busy}>
                  <RiRocketLine /> Start New Session (rollover)…
                </button>
              </div>

              <p className="ap-hint" style={{ margin: 0 }}>
                <b>Move ±1</b> only changes the session label / term / history trail. <b>Start New Session (rollover)</b> is the full start-of-year run: it archives all current results into history, then optionally promotes every student one class and rotates their access tokens before opening the new session. Download a backup from Data Tools first.
              </p>

              <div>
                <div className="ap-hint" style={{ marginBottom: 6 }}><RiHistoryLine /> Session history</div>
                {sessionHistory.length === 0 ? (
                  <p className="ap-hint" style={{ margin: 0 }}>No previous sessions recorded yet. Past sessions will appear here once you start a new one.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sessionHistory.slice().reverse().map((h, revIdx) => {
                      const idx = sessionHistory.length - 1 - revIdx;
                      return (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--card-border,#e5e7eb)", borderRadius: 10 }}>
                          {editingIdx === idx ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <input className="ap-input" style={{ width: 160 }} value={editDraft} onChange={(e) => setEditDraft(e.target.value)} placeholder="e.g. 2025/2026" disabled={busy} />
                              <button className="ap-btn sm green" onClick={() => saveHistoryCorrection(idx)} disabled={busy}><RiCheckLine /> Save</button>
                              <button className="ap-btn sm ghost" onClick={() => setEditingIdx(-1)} disabled={busy}><RiCloseLine /></button>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                                <strong style={{ fontWeight: 800 }}>{h.session || "(unnamed)"}</strong>
                                <span className="ap-hint" style={{ display: "inline-flex", gap: 12 }}>
                                  {h.endedAt ? <span><RiCalendarLine /> {formatDate(h.endedAt)}</span> : null}
                                  <span><RiStackLine /> {h.resultsArchived ?? 0} archived</span>
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="ap-btn sm ghost" title="Correct session name" onClick={() => { setEditingIdx(idx); setEditDraft(h.session || ""); }} disabled={busy}><RiEditLine /></button>
                                <button className="ap-btn sm ghost" title="Make this the current session" onClick={() => handleMakeCurrent(h.session)} disabled={busy}><RiArrowRightLine /></button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---- TAB: Class Promotion ---- */}
        {activeTab === "promote" && (
          <>
            {StudentScopeControls()}
            <div className="ap-card">
              <div className="ap-card-head">
                <span className="ic"><RiGraduationCapLine /></span> Promotion preview
                <span className="ap-card-sub">{promotable.length} to move · {promotionRows.length - promotable.length} held back</span>
              </div>
              {loadingStudents ? (
                <div className="ap-loading"><div className="ap-spinner" /><div>Loading students...</div></div>
              ) : targets.length === 0 ? (
                <div className="ap-empty"><RiInboxLine /> Choose students above to see their promotion preview.</div>
              ) : (
                <div className="ap-tablewrap" style={{ maxHeight: 360, overflowY: "auto" }}>
                  <table className="ap-table">
                    <thead><tr><th>Name</th><th>From</th><th>To</th></tr></thead>
                    <tbody>
                      {promotionRows.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>{r.name}</td>
                          <td>{canonClass(r.from) || r.from}</td>
                          <td>
                            {r.held ? <span className="ap-badge warn">Held back ({canonClass(r.from)})</span> : <span style={{ fontWeight: 700, color: "#011b97" }}>{r.to}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ padding: 14 }}>
                <button className="ap-btn green" onClick={handlePromote} disabled={busy || targets.length === 0}>
                  {busy ? <><RiLoader4Line className="spin" /> Promoting…</> : <><RiCheckLine /> Promote {promotable.length} student(s)</>}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ---- TAB: Student Tokens ---- */}
        {activeTab === "tokens" && (
          <>
            {StudentScopeControls()}
            <div className="ap-card">
              <div className="ap-card-head"><span className="ic"><RiKeyLine /></span> Reissue tokens</div>
              <div style={{ padding: 16 }}>
                <p className="ap-hint" style={{ marginTop: 0 }}>
                  Each student receives a new 6-character token (uppercase letters and numbers). Their linked result rows are synced to the new token and the result-view counter resets to 5.
                </p>
                <button className="ap-btn blue" onClick={handleRotate} disabled={busy || targets.length === 0}>
                  {busy ? <><RiLoader4Line className="spin" /> Generating…</> : <><RiKeyLine /> Generate tokens for {targets.length} student(s)</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* rollover (Start New Session) modal */}
      <Modal show={rollover.show} onHide={() => !rolloverBusy && setRollover((r) => ({ ...r, show: false }))} centered contentClassName="ap-modal-content">
        <>
          <Modal.Header className="ap-modal-head blue" closeButton closeVariant="white">
            <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}><RiRocketLine /> Start New Session (rollover)</Modal.Title>
          </Modal.Header>
          <Modal.Body className="ap-modal-body">
            <div style={{ marginBottom: 12 }}>
              <div className="ap-hint" style={{ marginBottom: 4 }}>New session label</div>
              <input className="ap-input" style={{ width: "100%" }} placeholder="e.g. 2026/2027" value={rollover.newLabel} onChange={(e) => setRollover((r) => ({ ...r, newLabel: e.target.value }))} disabled={rolloverBusy} />
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input type="checkbox" checked={rollover.promote} onChange={(e) => setRollover((r) => ({ ...r, promote: e.target.checked }))} disabled={rolloverBusy} />
              <span>Promote all students to the next class (top class held back)</span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <input type="checkbox" checked={rollover.rotateTokens} onChange={(e) => setRollover((r) => ({ ...r, rotateTokens: e.target.checked }))} disabled={rolloverBusy} />
              <span>Regenerate all student tokens (random 6-char uppercase) and reset Token Count to 5</span>
            </label>

            <div style={{ fontWeight: 700, marginBottom: 4 }}>This will:</div>
            <ul style={{ marginTop: 0, marginBottom: 10, paddingLeft: 20 }}>
              <li>Archive all current results for session <b>{session || "(current)"}</b> into history</li>
              {rollover.promote && <li>Upgrade every student one class (preview below)</li>}
              {rollover.rotateTokens && <li>Give every student a <b>new token</b> and set every <b>Token Count to 5</b></li>}
              <li>Set session to <b>{rollover.newLabel.trim() || "(new label)"}</b> and term to <b>1st Term</b></li>
            </ul>

            {rollover.promote && rollover.preview.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--card-border,#e5e7eb)", borderRadius: 10, padding: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Promotion preview ({rollover.preview.length} students):</div>
                {rollover.preview.slice(0, 50).map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                    <span>{p.name}</span>
                    <span>{p.from} → {p.to}{p.held ? " (held back — top class)" : ""}</span>
                  </div>
                ))}
                {rollover.preview.length > 50 && <div className="ap-hint">…and {rollover.preview.length - 50} more</div>}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="ap-modal-foot">
            <button className="ap-btn ghost" onClick={() => setRollover((r) => ({ ...r, show: false }))} disabled={rolloverBusy}><RiCloseLine /> Cancel</button>
            <button className="ap-btn primary" onClick={doRollover} disabled={rolloverBusy || !rollover.newLabel.trim()}>
              {rolloverBusy ? "Running… (do not close this page)" : "Confirm & Start New Session"}
            </button>
          </Modal.Footer>
        </>
      </Modal>

      {/* confirmation modal */}
      <Modal show={!!confirm} onHide={() => setConfirm(null)} centered contentClassName="ap-modal-content">
        {confirm && (
          <>
            <Modal.Header className={"ap-modal-head" + (confirm.tone === "red" ? " red" : confirm.tone === "amber" ? " amber" : confirm.tone === "blue" ? " blue" : "")} closeButton closeVariant="white">
              <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}><RiErrorWarningLine /> {confirm.title}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="ap-modal-body">{confirm.message}</Modal.Body>
            <Modal.Footer className="ap-modal-foot">
              <button className="ap-btn ghost" onClick={() => setConfirm(null)}><RiCloseLine /> Cancel</button>
              <button className={`ap-btn ${confirm.tone}`} onClick={runConfirm}>{confirm.confirmText}</button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      {/* token result modal */}
      <Modal show={!!tokenResult?.show} onHide={() => setTokenResult(null)} centered contentClassName="ap-modal-content">
        {tokenResult && (
          <>
            <Modal.Header className="ap-modal-head blue" closeButton closeVariant="white">
              <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}><RiKeyLine /> New tokens issued</Modal.Title>
            </Modal.Header>
            <Modal.Body className="ap-modal-body">
              <p style={{ marginTop: 0 }}>Record these now — they are shown once here. Each student's result-view counter was reset to 5.</p>
              <div style={{ maxHeight: 340, overflowY: "auto", border: "1px solid var(--card-border,#e5e7eb)", borderRadius: 10 }}>
                {tokenResult.rows.map((r) => (
                  <div key={r.name + r.token} style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", borderBottom: "1px solid rgba(0,0,0,.05)" }}>
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                    <code style={{ fontWeight: 800, letterSpacing: 1 }}>{r.token}</code>
                  </div>
                ))}
              </div>
            </Modal.Body>
            <Modal.Footer className="ap-modal-foot">
              <button className="ap-btn ghost" onClick={copyTokens}><RiFileCopyLine /> Copy all</button>
              <button className="ap-btn primary" onClick={() => setTokenResult(null)}><RiCheckLine /> Done</button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </>
  );
}
