import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { toast } from "react-toastify";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import { CLASS_OPTIONS, canonicalizeClasses, canonClass } from "../utils/classOptions";
import { logAction } from "../api/auditLog";
import {
  RiEyeLine,
  RiCheckLine,
  RiCloseLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiRocketLine,
} from "react-icons/ri";

// ALL RESULTS REVIEW — a full-screen grid of every pupil in one class,
// rendered as their result will look in the student portal, so the admin can
// eyeball a whole class at a time (Creche -> Year 12), hold back the ones
// that are not ready, and publish the rest in one click. Publish state is
// per term + per type (jmis_result.publish_state JSONB keys like
// term1_midterm / term2_general — see jmis_result_publish_state.sql); the
// table names arrive as props so this file mirrors verbatim into every
// build. Published cards are hidden by default; the sliding "Show published"
// toggle reveals them with an Unpublish action. No bulk e-mails here — the
// legacy whole-row "Finish & Publish Result" flow keeps that job; this grid
// only flips the per-term flags and writes an audit entry.

// ---- publish-state helpers (kept in sync with the student app's
// ---- src/utils/resultPublish.js; the admin app cannot import across apps)
const termKeyFor = (termLabel) => {
  const t = (termLabel || "").toLowerCase();
  if (t.includes("1st")) return "term1";
  if (t.includes("2nd")) return "term2";
  return "term3";
};

const publishKeyFor = (termLabel, resultType) =>
  `${termKeyFor(termLabel)}_${resultType === "midterm" ? "midterm" : "general"}`;

function isResultPublished(row, termLabel, resultType) {
  const key = publishKeyFor(termLabel, resultType);
  const ps = row && row.publish_state;
  if (ps && typeof ps === "object" && Object.prototype.hasOwnProperty.call(ps, key)) {
    return ps[key] === true;
  }
  // No per-term decision yet: legacy "Finish & Publish Result" flag.
  return !!(row && row.uploadResult === true);
}

// ---- grading scales, identical thresholds to Result.jsx (the page that
// ---- produces the stored values), so the preview matches the real card
const determineGrade = (total) => {
  if (total >= 96) return "A+";
  if (total >= 86) return "A";
  if (total >= 80) return "B+";
  if (total >= 70) return "B";
  if (total >= 66) return "C+";
  if (total >= 56) return "C";
  if (total >= 46) return "D";
  return "E";
};

const calculateMidtermGrade = (score) => {
  score = parseFloat(score || 0);
  if (score >= 29) return "A+";
  if (score >= 26) return "A";
  if (score >= 24) return "B+";
  if (score >= 21) return "B";
  if (score >= 20) return "C+";
  if (score >= 17) return "C";
  if (score >= 14) return "D";
  return "E";
};

// Mirrors resultEntryHasScore in Result.jsx: a stored entry only counts when
// it actually carries a score for the viewed type.
function entryHasScore(entry, isMidterm) {
  if (!entry) return false;
  if (isMidterm) {
    const has = (v) => v !== undefined && v !== null && v !== "";
    return has(entry.midtermScore) || has(entry.test);
  }
  const has = (v) => v !== undefined && v !== null && v !== "";
  return has(entry.test) || has(entry.project) || has(entry.examination);
}

const num = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// Display-only subject-name tidy (lower-case first letter fix-ups like
// "maths" -> "Maths"); stored names are already normalized at save time.
const prettySubject = (name) => {
  const s = (name || "").trim().replace(/\s+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const TERM_OPTIONS = ["1st term", "2nd term", "3rd term"];

const styles = {
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12 },
  label: { fontSize: "0.78rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 },
  select: { padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", minWidth: 150 },
  navBtn: { padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 14,
    overflowY: "auto",
    maxHeight: "70vh",
    paddingRight: 6,
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "12px 14px",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    breakInside: "avoid",
  },
  cardPublished: { borderColor: "#a3d9a5", background: "#f4fbf4" },
  cardEmpty: { opacity: 0.65 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  name: { fontWeight: 700, fontSize: "0.92rem", lineHeight: 1.2 },
  cls: { fontSize: "0.75rem", color: "#64748b" },
  badge: {
    fontSize: "0.68rem", fontWeight: 700, color: "#1d7a34", background: "#e3f6e6",
    border: "1px solid #a3d9a5", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap",
  },
  rows: { fontSize: "0.78rem", maxHeight: 168, overflowY: "auto", borderTop: "1px solid #eef1f5", paddingTop: 6 },
  row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "2px 0" },
  subj: { flex: 1, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  foot: { display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#334155", borderTop: "1px solid #eef1f5", paddingTop: 6 },
  readyRow: { display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "#475569" },
  btn: {
    border: "none", borderRadius: 8, padding: "6px 12px", fontSize: "0.8rem",
    fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
  },
  btnPublish: { background: "#28a745", color: "#fff" },
  btnUnpublish: { background: "#dc3545", color: "#fff" },
  btnPrimary: { background: "#4e9f38", color: "#fff" },
  btnGhost: { background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" },
  emptyNote: { color: "#94a3b8", fontSize: "0.8rem", fontStyle: "italic", padding: "8px 0" },
};

// Sliding toggle — the project rule is that boolean settings never render as
// a bare checkbox.
function SlideToggle({ checked, onChange, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
      <div
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 999, cursor: "pointer", position: "relative",
          background: checked ? "#4e9f38" : "#cbd5e1", transition: "background 0.15s ease",
        }}
      >
        <div
          style={{
            position: "absolute", top: 2, left: checked ? 20 : 2, width: 18, height: 18,
            borderRadius: "50%", background: "#fff", transition: "left 0.15s ease",
            boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          }}
        />
      </div>
      <span style={{ fontSize: "0.82rem", color: "#334155", cursor: "pointer" }} onClick={() => onChange(!checked)}>{label}</span>
    </div>
  );
}

function ResultCard({
  entry,
  isMidterm,
  published,
  notReady,
  busy,
  onToggleReady,
  onPublish,
  onUnpublish,
}) {
  const rows = useMemo(() => {
    const subjects = entry[isMidterm ? "midterm" : "general"] || [];
    let total = 0;
    const view = subjects.map((s) => {
      let score;
      let grade;
      if (isMidterm) {
        score = num(s.midtermScore !== "" && s.midtermScore != null ? s.midtermScore : s.test);
        grade = s.midtermGrade || calculateMidtermGrade(score);
      } else {
        score = num(s.total) || num(s.test) + num(s.project) + num(s.examination);
        grade = s.grade || determineGrade(score);
      }
      total += score;
      return { name: prettySubject(s.subjectName), score, grade };
    });
    return { view, total };
  }, [entry, isMidterm]);

  const average = rows.view.length > 0 ? Math.round(rows.total / rows.view.length) : 0;
  const overallGrade = rows.view.length > 0
    ? (isMidterm ? calculateMidtermGrade(average) : determineGrade(average))
    : "N/A";

  return (
    <div
      style={{
        ...styles.card,
        ...(published ? styles.cardPublished : {}),
        ...(!entry.scored ? styles.cardEmpty : {}),
      }}
    >
      <div style={styles.cardHead}>
        <div>
          <div style={styles.name}>{entry.name}</div>
          <div style={styles.cls}>{entry.cls}</div>
        </div>
        {published && <span style={styles.badge}>Published</span>}
      </div>

      {entry.scored ? (
        <div style={styles.rows}>
          {rows.view.map((r, i) => (
            <div key={i} style={styles.row}>
              <span style={styles.subj} title={r.name}>{r.name}</span>
              <span style={{ fontWeight: 600 }}>{isMidterm ? `${r.score}/30` : `${r.score}/100`}</span>
              <span style={{ minWidth: 30, textAlign: "right", fontWeight: 700 }}>{r.grade}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.emptyNote}>No result recorded for this term/type</div>
      )}

      {entry.scored && (
        <div style={styles.foot}>
          <span>Total: <strong>{rows.total}</strong></span>
          <span>Avg: <strong>{average}</strong></span>
          <span>Overall: <strong>{overallGrade}</strong></span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        {!published ? (
          entry.scored ? (
            <label style={{ ...styles.readyRow, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={notReady}
                disabled={busy}
                onChange={(e) => onToggleReady(e.target.checked)}
              />
              Not ready
            </label>
          ) : (
            <span style={{ ...styles.emptyNote, margin: 0 }}>Cannot publish</span>
          )
        ) : (
          <span />
        )}
        {published ? (
          <button
            type="button"
            style={{ ...styles.btn, ...styles.btnUnpublish, opacity: busy ? 0.6 : 1 }}
            disabled={busy}
            onClick={() => onUnpublish(entry)}
          >
            {busy ? <Spinner animation="border" size="sm" /> : <RiCloseLine />} Unpublish
          </button>
        ) : entry.scored ? (
          <button
            type="button"
            style={{ ...styles.btn, ...styles.btnGhost, opacity: busy ? 0.6 : 1 }}
            disabled={busy}
            onClick={() => onPublish(entry)}
          >
            {busy ? <Spinner animation="border" size="sm" /> : <RiCheckLine />} Publish
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function AllResultsReview({
  show,
  onHide,
  resultTable,
  studentTable,
  defaultTerm,
  defaultPurpose,
  email,
  actorRole,
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);          // deduped result rows + derived view data
  const [classList, setClassList] = useState([]); // canonical roster classes, lowest -> highest
  const [activeClass, setActiveClass] = useState("");
  const [term, setTerm] = useState(defaultTerm && TERM_OPTIONS.includes(defaultTerm) ? defaultTerm : "1st term");
  const [resultType, setResultType] = useState(defaultPurpose === "midterm" ? "midterm" : "general");
  const [showPublished, setShowPublished] = useState(false);
  const [notReady, setNotReady] = useState({});  // `${pubKey}::${id}` -> true
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);    // single-card publish/unpublish in flight
  const [bulkBusy, setBulkBusy] = useState(false);

  const isMidterm = resultType === "midterm";
  const pubKey = publishKeyFor(term, resultType);

  // Load everything once per open (bulk fetch + client grouping, the same
  // approach as fetchClassStats on the parent page). The newest row wins per
  // normalized student name: legacy duplicate rows exist in jmis_result.
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setRows([]);
      setClassList([]);
      const wanted = [
        "id", "studentId", "studentName", "studentClass",
        "term1Subjects", "term2Subjects", "term3Subjects",
        "uploadResult", "publish_state",
      ];
      try {
        let res = await supabase.from(resultTable).select(wanted.join(", ")).order("id", { ascending: false });
        if (res.error) {
          // publish_state not migrated yet in this project — retry without it
          // and tell the operator which SQL file to run.
          if (/publish_state/i.test(res.error.message || "")) {
            toast.error(`Column publish_state is missing — run ${resultTable}_publish_state.sql in Supabase first. Showing the legacy publish flag instead.`);
            res = await supabase
              .from(resultTable)
              .select(wanted.filter((c) => c !== "publish_state").join(", "))
              .order("id", { ascending: false });
          }
          if (res.error) throw new Error(res.error.message);
        }
        const resultRows = res.data || [];

        const roster = await supabase.from(studentTable).select("name, class");
        if (roster.error) throw new Error(roster.error.message);

        // Newest-first ordering means the LAST write into the map must win —
        // iterate reversed so the newest row overwrites older duplicates.
        const byName = {};
        for (let i = resultRows.length - 1; i >= 0; i--) {
          const r = resultRows[i];
          const key = (r.studentName || "").trim().toLowerCase();
          if (key) byName[key] = r;
        }

        const entries = (roster.data || [])
          .filter((s) => s?.name && s?.class)
          .map((s) => {
            const r = byName[(s.name || "").trim().toLowerCase()];
            const termKey = termKeyFor(term) + "Subjects";
            const subjects = (r && r[termKey]) || [];
            return {
              id: r ? r.id : `roster-${s.name}`,
              row: r,
              name: s.name,
              cls: canonClass(s.class),
              midterm: subjects.filter((e) => entryHasScore(e, true)),
              general: subjects,
              scored: !!r && subjects.some((e) => entryHasScore(e, isMidterm)),
            };
          });

        if (cancelled) return;
        setRows(entries);
        setClassList(canonicalizeClasses((roster.data || []).map((s) => s.class)));
        setActiveClass((prev) => {
          const opts = canonicalizeClasses((roster.data || []).map((s) => s.class));
          if (prev && opts.includes(prev)) return prev;
          return opts[0] || "";
        });
      } catch (err) {
        if (!cancelled) toast.error("Error loading results for review: " + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // term/resultType intentionally excluded: cards derive their slice from the
    // already-loaded rows client-side; one bulk fetch per open is the design.
  }, [show, resultTable, studentTable]);

  // Entries for the active class, split by publish state for the current key
  const classEntries = useMemo(
    () => rows.filter((e) => e.cls === activeClass),
    [rows, activeClass]
  );
  const visibleEntries = useMemo(
    () => classEntries.filter((e) => showPublished || !isResultPublished(e.row, term, resultType)),
    [classEntries, showPublished, term, resultType]
  );

  // Bulk selection: scored + unpublished cards of the active class that the
  // admin has NOT flagged "Not ready"
  const readyEntries = useMemo(
    () =>
      classEntries.filter(
        (e) =>
          e.scored &&
          !isResultPublished(e.row, term, resultType) &&
          !notReady[`${pubKey}::${e.id}`]
      ),
    [classEntries, notReady, pubKey, term, resultType]
  );
  const heldCount = useMemo(
    () =>
      classEntries.filter(
        (e) =>
          e.scored &&
          !isResultPublished(e.row, term, resultType) &&
          notReady[`${pubKey}::${e.id}`]
      ).length,
    [classEntries, notReady, pubKey, term, resultType]
  );

  const classIndex = classList.indexOf(activeClass);
  const gotoClass = (delta) => {
    const next = classList[classIndex + delta];
    if (next) setActiveClass(next);
  };

  // Read-merge-write one key of publish_state. Admin is the only writer of
  // this column, so a per-row merge from the freshly loaded row is safe.
  const setPublished = async (entry, wantPublished) => {
    if (!entry.row) return;
    setBusyId(entry.id);
    try {
      const merged = { ...(entry.row.publish_state || {}), [pubKey]: wantPublished };
      const { data, error } = await supabase
        .from(resultTable)
        .update({ publish_state: merged })
        .eq("id", entry.row.id)
        .select("id, publish_state")
        .single();
      if (error) {
        if (/publish_state/i.test(error.message || "")) {
          toast.error(`Column publish_state is missing — run ${resultTable}_publish_state.sql in Supabase first.`);
        } else {
          throw new Error(error.message);
        }
        return;
      }
      setRows((prev) =>
        prev.map((e) =>
          e.row && e.row.id === entry.row.id ? { ...e, row: { ...e.row, publish_state: data.publish_state || merged } } : e
        )
      );
      logAction(supabase, {
        email,
        role: actorRole,
        action: wantPublished ? "result_publish" : "result_unpublish",
        targetTable: resultTable,
        recordId: entry.row.id,
        details: { key: pubKey, studentName: entry.name },
      });
      toast.success(wantPublished ? `Published ${entry.name}'s ${term} ${resultType} result.` : `Unpublished ${entry.name}'s ${term} ${resultType} result.`);
    } catch (err) {
      toast.error("Could not update publish state: " + err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkPublish = async () => {
    const targets = readyEntries;
    setConfirmOpen(false);
    if (targets.length === 0) return;
    setBulkBusy(true);
    let failures = 0;
    let missingColumn = false;
    try {
      await Promise.all(
        targets.map(async (entry) => {
          const merged = { ...(entry.row.publish_state || {}), [pubKey]: true };
          const { error } = await supabase
            .from(resultTable)
            .update({ publish_state: merged })
            .eq("id", entry.row.id);
          if (error) {
            if (/publish_state/i.test(error.message || "")) missingColumn = true;
            failures += 1;
            return;
          }
          setRows((prev) =>
            prev.map((e) => (e.row && e.row.id === entry.row.id ? { ...e, row: { ...e.row, publish_state: merged } } : e))
          );
        })
      );
      if (missingColumn) {
        toast.error(`publish_state column is missing — run ${resultTable}_publish_state.sql in Supabase, then retry.`);
      } else if (failures > 0) {
        toast.error(`${failures} of ${targets.length} results could not be published. Try again for the rest.`);
      } else {
        toast.success(`Published ${targets.length} result${targets.length === 1 ? "" : "s"} for ${activeClass}.`);
      }
      logAction(supabase, {
        email,
        role: actorRole,
        action: "result_bulk_publish",
        targetTable: resultTable,
        details: {
          key: pubKey,
          className: activeClass,
          publishedIds: targets.map((t) => t.row.id),
          held: targets.length ? 0 : heldCount,
        },
      });
    } catch (err) {
      toast.error("Bulk publish failed: " + err.message);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <>
      <Modal show={show} onHide={onHide} size="xl" centered dialogStyle={{ maxWidth: "94vw" }} contentClassName="res-modal-content">
        <div className="res-modal-head">
          <div className="t"><RiEyeLine /> All Results Review</div>
          <div className="s">
            Every pupil in one class at a time, exactly as their report will appear.
            Flag the ones that are not ready, then publish the rest.
          </div>
        </div>
        <Modal.Body className="res-modal-body">
          <div style={styles.head}>
            <div>
              <span style={styles.label}>Class</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button type="button" style={styles.navBtn} onClick={() => gotoClass(-1)} disabled={classIndex <= 0} aria-label="Previous class">
                  <RiArrowLeftSLine />
                </button>
                <select
                  style={styles.select}
                  value={activeClass}
                  onChange={(e) => setActiveClass(e.target.value)}
                >
                  {classList.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button type="button" style={styles.navBtn} onClick={() => gotoClass(1)} disabled={classIndex < 0 || classIndex >= classList.length - 1} aria-label="Next class">
                  <RiArrowRightSLine />
                </button>
              </div>
            </div>

            <div>
              <span style={styles.label}>Term</span>
              <select style={styles.select} value={term} onChange={(e) => setTerm(e.target.value)}>
                {TERM_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <span style={styles.label}>Result Type</span>
              <div className="res-seg" role="group" aria-label="Result type">
                <button
                  type="button"
                  className={`res-seg-btn${!isMidterm ? " active" : ""}`}
                  onClick={() => setResultType("general")}
                >
                  Full Term
                </button>
                <button
                  type="button"
                  className={`res-seg-btn${isMidterm ? " active" : ""}`}
                  onClick={() => setResultType("midterm")}
                >
                  Midterm
                </button>
              </div>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
              <SlideToggle
                checked={showPublished}
                onChange={setShowPublished}
                label="Show published"
              />
              <button
                type="button"
                style={{ ...styles.btn, ...styles.btnPrimary, opacity: readyEntries.length === 0 || bulkBusy ? 0.55 : 1 }}
                disabled={bulkBusy || readyEntries.length === 0}
                onClick={() => setConfirmOpen(true)}
              >
                {bulkBusy ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <RiRocketLine />
                )}{" "}
                Publish Ready Results ({readyEntries.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <Spinner animation="border" />
              <div style={{ marginTop: 10, color: "#64748b" }}>Loading {activeClass || "class"} results…</div>
            </div>
          ) : !activeClass ? (
            <div style={styles.emptyNote}>No pupils found in the roster.</div>
          ) : visibleEntries.length === 0 ? (
            <div style={styles.emptyNote}>
              {classEntries.length === 0
                ? `No pupils listed in ${activeClass}.`
                : `All ${isMidterm ? "midterm" : "general"} results for ${activeClass} are published — flip "Show published" to see them.`}
            </div>
          ) : (
            <div style={styles.grid}>
              {visibleEntries.map((entry) => (
                <ResultCard
                  key={`${pubKey}-${entry.id}`}
                  entry={entry}
                  isMidterm={isMidterm}
                  published={isResultPublished(entry.row, term, resultType)}
                  notReady={!!notReady[`${pubKey}::${entry.id}`]}
                  busy={busyId === entry.id || bulkBusy}
                  onToggleReady={(checked) =>
                    setNotReady((prev) => {
                      const k = `${pubKey}::${entry.id}`;
                      if (checked) return { ...prev, [k]: true };
                      const next = { ...prev };
                      delete next[k];
                      return next;
                    })
                  }
                  onPublish={(e) => setPublished(e, true)}
                  onUnpublish={(e) => setPublished(e, false)}
                />
              ))}
            </div>
          )}
        </Modal.Body>
        <div className="res-modal-foot">
          <button className="res-cancel" onClick={onHide}>
            Close
          </button>
        </div>
      </Modal>

      {/* Confirmation modal for the bulk action (project rule) */}
      <Modal show={confirmOpen} onHide={() => setConfirmOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Publish ready results?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            This publishes <strong>{readyEntries.length}</strong> ready result{readyEntries.length === 1 ? "" : "s"} for{" "}
            <strong>{activeClass}</strong> ({term} • {isMidterm ? "Midterm" : "Full Term"}) so pupils can view them.
          </p>
          <p className="mb-0">
            <strong>{heldCount}</strong> result{heldCount === 1 ? "" : "s"} flagged &quot;Not ready&quot; will stay unpublished.
            Published results disappear from this grid until you turn on &quot;Show published&quot;.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <button className="res-cancel" onClick={() => setConfirmOpen(false)}>
            Cancel
          </button>
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleBulkPublish}>
            <RiCheckLine /> Publish {readyEntries.length} Result{readyEntries.length === 1 ? "" : "s"}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
