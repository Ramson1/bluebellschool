"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "../supabaseClient.js";
import { CLASS_OPTIONS } from "../utils/classOptions";
import { logAction } from "../api/auditLog.js";
import "../styles/AdminPages.css";
import {
  RiFileTextLine,
  RiAddLine,
  RiSearchLine,
  RiRefreshLine,
  RiEditLine,
  RiCheckLine,
  RiCloseLine,
  RiEyeLine,
} from "react-icons/ri";

// Canonical class list — shared single source of truth (utils/classOptions.js).
const CLASSES = CLASS_OPTIONS;

// Every subject the school teaches (union of all class subject lists).
const ALL_SUBJECTS = (() => {
  try {
    const { schoolSubjects } = require("../utils/subjectUtils.js");
    return Array.from(new Set(Object.values(schoolSubjects).flat())).sort();
  } catch {
    return [];
  }
})();

const STATUS_OPTIONS = ["pending", "reviewed", "late", "exempt"];
const MAX_VISIBLE_CHARS = 200;

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");

// Join submission rows with their assignment row to surface title/type.
async function loadSubmissions() {
  const { data: subs, error: subErr } = await supabase
    .from("bluebell_assignment_submissions")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(1000);
  if (subErr) return { subs: [], err: subErr };

  const assignmentIds = [...new Set((subs || []).map((s) => s.assignment_id).filter(Boolean))];
  let assignments = {};
  if (assignmentIds.length) {
    const { data: assignRows } = await supabase
      .from("bluebell_assignments")
      .select("id, title, assignment_type")
      .in("id", assignmentIds);
    assignments = Object.fromEntries((assignRows || []).map((a) => [a.id, a]));
  }
  return { subs: subs || [], err: null, assignments };
}

export default function AdminSubmissions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [clsFilter, setClsFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email || "admin@school"));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { subs, err, assignments } = await loadSubmissions();
      if (err) throw err;
      const enriched = (subs || []).map((s) => ({
        ...s,
        assignment: assignments[s.assignment_id] || {},
      }));
      setRows(enriched);
    } catch (e) {
      toast.error("Could not load submissions: " + (e.message || "try again"));
    } finally {
      setLoading(false);
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (clsFilter && r.class !== clsFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = `${r.student_name || ""} ${r.class || ""} ${r.subject || ""} ${r.assignment.title || ""} ${r.submission_text || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, clsFilter, statusFilter]);

  const toggleReview = async (id, currentStatus) => {
    const next = currentStatus === "reviewed" ? "pending" : "reviewed";
    setReviewing(id);
    try {
      const { error } = await supabase
        .from("bluebell_assignment_submissions")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      logAction(supabase, {
        email, role: "admin",
        action: `submission_${next}`,
        targetTable: "bluebell_assignment_submissions",
        recordId: id,
        details: { status: currentStatus, nextStatus: next },
      });
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: next, updated_at: new Date().toISOString() } : r)));
      toast.success(`Marked as ${next}.`);
    } catch (e) {
      toast.error("Review update failed: " + (e.message || "try again"));
    } finally {
      setReviewing(null);
    }
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isExpanded = (id) => expanded.has(id);

  const answerText = (r) => r.submission_text || "—";
  const answerPreview = (r) => {
    const t = answerText(r);
    if (t.length <= MAX_VISIBLE_CHARS) return t;
    return t.slice(0, MAX_VISIBLE_CHARS) + "…";
  };

  const Icon = RiFileTextLine;
  return (
    <div className="ap-page">
      <ToastContainer position="top-center" />
      <div className="ap-head">
        <div>
          <h1 className="ap-title"><span className="ap-title-ic"><Icon /></span>Assignment Submissions</h1>
          <p className="ap-sub">View all student submissions across every class and subject. Search, filter, and mark submissions as reviewed.</p>
        </div>
        <div className="ap-actions">
          <span className="ap-pill blue">{visible.length} submission{visible.length === 1 ? "" : "s"}</span>
          <button className="ap-btn ghost" onClick={load}><RiRefreshLine /> Refresh</button>
        </div>
      </div>

      <div className="ap-toolbar">
        <div className="ap-search">
          <RiSearchLine />
          <input className="ap-input" placeholder="Search student, class, subject, assignment…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="ap-input" value={clsFilter} onChange={(e) => setClsFilter(e.target.value)}>
          <option value="">All classes</option>
          {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="ap-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="ap-btn ghost" onClick={load}><RiRefreshLine /> Refresh</button>
      </div>

      <div className="ap-card">
        {loading ? (
          <div className="ap-loading"><div className="ap-spinner" /> Loading…</div>
        ) : (
          <div className="ap-tablewrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Assignment</th>
                  <th>Type</th>
                  <th>Answer</th>
                  <th>File</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th className="text-end">Review</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={10} className="ap-empty">No submissions yet.</td></tr>
                ) : visible.map((r) => (
                  <tr key={r.id}>
                    <td>{r.student_name || "—"}</td>
                    <td>{r.class || "—"}</td>
                    <td>{r.subject || "—"}</td>
                    <td>{r.assignment?.title || "—"}</td>
                    <td>{r.assignment?.assignment_type || "—"}</td>
                    <td>
                      <span className={isExpanded(r.id) ? "ap-answer-full" : "ap-answer-preview"}>
                        {isExpanded(r.id) ? answerText(r) : answerPreview(r)}
                        {answerText(r).length > MAX_VISIBLE_CHARS && (
                          <button
                            className="ap-toggle"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(r.id); }}
                          >
                            {isExpanded(r.id) ? "Show less" : "Show more"}
                          </button>
                        )}
                      </span>
                    </td>
                    <td>{r.file_url ? (<a href={r.file_url} target="_blank" rel="noopener noreferrer" className="ap-file-link">open</a>) : "—"}</td>
                    <td>{fmtDate(r.submitted_at)}</td>
                    <td><span className={`ap-badge ap-badge-${r.status || "pending"}`}>{r.status || "pending"}</span></td>
                    <td className="text-end">
                      <button
                        className="ap-btn sm"
                        disabled={reviewing === r.id}
                        onClick={() => toggleReview(r.id, r.status)}
                      >
                        {reviewing === r.id ? "…" : (r.status === "reviewed" ? <><RiCheckLine /> Unreview</> : <><RiCheckLine /> Review</>)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
