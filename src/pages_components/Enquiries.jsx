"use client";

// Enquiries — website enquiry follow-up pipeline (Phase 3b). Every contact /
// admissions form on bluebellschool-website lands in jmis_enquiries; this page is
// where admin/dev triage status, log follow-up notes, set the next callback
// date and reply directly to the parent by email (via /api/send-email).
// Only admins/developers may open this page.

import React, { useEffect, useState, useMemo } from "react";
import { Modal } from "react-bootstrap";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  RiCustomerService2Line,
  RiSearchLine,
  RiMailSendLine,
  RiAddLine,
  RiTimeLine,
  RiInboxLine,
  RiUserLine,
  RiStickyNoteLine,
} from "react-icons/ri";
import "../styles/AdminPages.css";
import { fetchAuthRoles, isAdmin, isDev } from "../utils/authUtils";
import { logAction } from "../api/auditLog.js";

const STATUSES = ["new", "in_progress", "resolved", "closed"];
const STATUS_LABELS = { new: "New", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };
const STATUS_TONES = { new: "warn", in_progress: "ok", resolved: "info", closed: "danger" };
const TYPE_LABELS = { admission: "Admission", visit: "School visit", general: "General" };

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const isOverdue = (row) =>
  row.next_follow_up && row.next_follow_up < todayISO() && row.status !== "closed" && row.status !== "resolved";

export default function Enquiries() {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState({ adminEmails: [], devEmails: [] });
  const [ready, setReady] = useState(false);

  const [rows, setRows] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // detail modal
  const [selected, setSelected] = useState(null); // live copy of the row being edited
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);

  // reply-by-email modal
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState({ subject: "", message: "" });

  const email = user?.user_metadata?.email;
  const allowed = isAdmin(email, roles.adminEmails) || isDev(email, roles.devEmails);
  const actorRole = "admin"; // audit convention in this codebase (devs are not logged)

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

  const load = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from("jmis_enquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error("Failed to load enquiries:", e);
      toast.error("Could not load enquiries. Is jmis_enquiries created? (Run platform_website_enquiries_setup.sql)");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (typeFilter && r.enquiry_type !== typeFilter) return false;
      if (term) {
        const hay = `${r.name || ""} ${r.email || ""} ${r.phone || ""} ${r.message || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, typeFilter]);

  const counts = useMemo(() => {
    const c = { all: rows.length, overdue: 0 };
    STATUSES.forEach((s) => (c[s] = 0));
    rows.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status] += 1;
      if (isOverdue(r)) c.overdue += 1;
    });
    return c;
  }, [rows]);

  // ---------- mutations ----------

  const patchRow = async (id, patch) => {
    const { data, error } = await supabase
      .from("jmis_enquiries")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...data } : r)));
    setSelected((s) => (s && s.id === id ? { ...s, ...data } : s));
    return data;
  };

  const changeStatus = async (row, status) => {
    try {
      await patchRow(row.id, { status });
      logAction(supabase, {
        email, role: actorRole, action: "enquiry_status",
        targetTable: "jmis_enquiries", recordId: String(row.id),
        details: { status, from: row.status, contact: row.email },
      });
      toast.success(`Marked ${STATUS_LABELS[status] || status}`);
    } catch (e) {
      toast.error(e.message || "Could not update status");
    }
  };

  const setFollowUpDate = async (row, dateStr) => {
    try {
      await patchRow(row.id, { next_follow_up: dateStr || null });
    } catch (e) {
      toast.error(e.message || "Could not save follow-up date");
    }
  };

  const addNote = async () => {
    const text = noteText.trim();
    if (!selected || !text) return;
    setBusy(true);
    try {
      const notes = Array.isArray(selected.follow_up_notes) ? selected.follow_up_notes : [];
      const next = [...notes, { at: new Date().toISOString(), by: email || "admin", note: text }];
      await patchRow(selected.id, { follow_up_notes: next });
      setNoteText("");
      logAction(supabase, {
        email, role: actorRole, action: "enquiry_note",
        targetTable: "jmis_enquiries", recordId: String(selected.id),
        details: { contact: selected.email, chars: text.length },
      });
      toast.success("Follow-up note added");
    } catch (e) {
      toast.error(e.message || "Could not add note");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const sess = await supabase.auth.getSession();
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.data.session?.access_token || ""}`,
        },
        body: JSON.stringify({
          subject: reply.subject || `Re: your enquiry to Bluebell School`,
          message: reply.message,
          recipients: [selected.email],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Email failed (${res.status})`);
      const notes = Array.isArray(selected.follow_up_notes) ? selected.follow_up_notes : [];
      await patchRow(selected.id, {
        follow_up_notes: [...notes, { at: new Date().toISOString(), by: email || "admin", note: `✉ Replied by email — "${reply.subject}"` }],
        status: selected.status === "new" ? "in_progress" : selected.status,
      });
      logAction(supabase, {
        email, role: actorRole, action: "enquiry_reply",
        targetTable: "jmis_enquiries", recordId: String(selected.id),
        details: { to: selected.email, subject: reply.subject },
      });
      setReplyOpen(false);
      setReply({ subject: "", message: "" });
      toast.success("Reply sent");
    } catch (e) {
      toast.error(e.message || "Could not send reply");
    } finally {
      setBusy(false);
    }
  };

  const openDetail = (row) => {
    setSelected(row);
    setNoteText("");
  };

  // ---------- render ----------

  if (!ready) {
    return (
      <div className="ap-loading">
        <div className="ap-spinner" />
        <div>Loading enquiries...</div>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="ap-denied">
        <h4>Access denied</h4>
        <p>Only administrators and the developer account can manage enquiries.</p>
      </div>
    );
  }

  return (
    <div className="ap-page">
      <ToastContainer />
      <div className="ap-head">
        <div>
          <h1 className="ap-title">
            <span className="ap-title-ic"><RiCustomerService2Line /></span>
            Enquiries &amp; Admissions
          </h1>
          <p className="ap-sub">
            Website contact and admissions form submissions — triage status, log follow-ups and reply to parents by email.
            {counts.overdue > 0 && <span className="ap-badge danger ms-2">{counts.overdue} overdue follow-up{counts.overdue > 1 ? "s" : ""}</span>}
          </p>
        </div>
        <div className="ap-actions">
          <span className="ap-pill blue"><RiInboxLine /> {counts.all} total</span>
        </div>
      </div>

      <div className="ap-toolbar">
        <div className="ap-search">
          <RiSearchLine />
          <input
            type="text"
            placeholder="Search name, email, phone or message"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ap-input"
          />
        </div>
        <select className="ap-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* status chips act as quick kanban-ish filters */}
      <div className="enq-chips">
        <button type="button" className={"enq-chip" + (statusFilter === "" ? " on" : "")} onClick={() => setStatusFilter("")}>
          All <b>{counts.all}</b>
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={"enq-chip tone-" + STATUS_TONES[s] + (statusFilter === s ? " on" : "")}
            onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
          >
            {STATUS_LABELS[s]} <b>{counts[s]}</b>
          </button>
        ))}
      </div>

      {loadingData ? (
        <div className="ap-loading">
          <div className="ap-spinner" />
          <div>Loading enquiries...</div>
        </div>
      ) : (
      <div className="ap-card">
        <div className="ap-card-head">
          <span className="ic"><RiCustomerService2Line /></span>
          Enquiry pipeline
          <span className="ap-card-sub">{visible.length} shown of {rows.length} total</span>
        </div>
        <div className="ap-tablewrap">
        <table className="ap-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Type</th>
              <th>Message</th>
              <th>Status</th>
              <th>Next follow-up</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="ap-empty">
                    <RiInboxLine />
                    <p>{rows.length ? "No enquiries match the current filters." : "No enquiries yet — website contact & admissions forms will appear here."}</p>
                  </div>
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.id} className="enq-row" onClick={() => openDetail(r)}>
                  <td>
                    <div className="enq-name">{r.name}</div>
                    {r.child_age_class && <div className="ap-muted">{r.child_age_class}</div>}
                  </td>
                  <td>
                    <div>{r.email}</div>
                    {r.phone && <div className="ap-muted">{r.phone}</div>}
                  </td>
                  <td>
                    <span className="ap-badge info">{TYPE_LABELS[r.enquiry_type] || r.enquiry_type || "General"}</span>
                    {r.source && r.source !== "website" && <div className="ap-muted">{r.source}</div>}
                  </td>
                  <td className="enq-msg">{r.message ? String(r.message).slice(0, 80) + (r.message.length > 80 ? "…" : "") : "—"}</td>
                  <td>
                    <select
                      className={"ap-badge " + (STATUS_TONES[r.status] || "warn")}
                      value={r.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => changeStatus(r, e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className={isOverdue(r) ? "enq-overdue" : ""}>
                    {r.next_follow_up || "—"}
                  </td>
                  <td className="ap-muted">{fmtDateTime(r.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
      )}

      {/* ---------- detail modal ---------- */}
      <Modal show={!!selected} onHide={() => setSelected(null)} centered dialogClassName="ap-modal-lg" contentClassName="ap-modal-content">
        {selected && (
          <>
            <Modal.Header className="ap-modal-head" closeButton closeVariant="white">
              <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>
                <RiUserLine /> {selected.name} — enquiry detail
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="ap-modal-body">
              <div className="enq-detail-grid">
                <div>
                  <p className="ap-muted">Email</p>
                  <p className="fw-bold">{selected.email}</p>
                </div>
                <div>
                  <p className="ap-muted">Phone</p>
                  <p className="fw-bold">{selected.phone || "—"}</p>
                </div>
                <div>
                  <p className="ap-muted">Type</p>
                  <p className="fw-bold">{TYPE_LABELS[selected.enquiry_type] || selected.enquiry_type || "General"}</p>
                </div>
                <div>
                  <p className="ap-muted">Child / class</p>
                  <p className="fw-bold">{selected.child_age_class || "—"}</p>
                </div>
                <div>
                  <p className="ap-muted">Status</p>
                  <select
                    className="ap-input"
                    value={selected.status}
                    onChange={(e) => changeStatus(selected, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="ap-muted">Next follow-up</p>
                  <input
                    type="date"
                    className="ap-input"
                    value={selected.next_follow_up || ""}
                    onChange={(e) => setFollowUpDate(selected, e.target.value)}
                  />
                </div>
              </div>

              <p className="ap-muted mt-3">Message</p>
              <div className="enq-message">{selected.message || "—"}</div>

              <p className="ap-muted mt-4 mb-1">
                <RiStickyNoteLine /> Follow-up notes ({(selected.follow_up_notes || []).length})
              </p>
              <div className="enq-notes">
                {(selected.follow_up_notes || []).length === 0 && (
                  <p className="ap-muted">No notes yet — log every call, visit or reply here.</p>
                )}
                {(selected.follow_up_notes || []).map((n, i) => (
                  <div key={i} className="enq-note">
                    <div className="enq-note-meta">{fmtDateTime(n.at)} · {n.by}</div>
                    <div>{n.note}</div>
                  </div>
                ))}
              </div>
              <div className="d-flex gap-2 mt-2">
                <input
                  className="ap-input grow-1"
                  placeholder="Add a follow-up note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNote()}
                />
                <button type="button" className="ap-btn ghost" onClick={addNote} disabled={busy || !noteText.trim()}>
                  <RiAddLine /> Add
                </button>
              </div>
            </Modal.Body>
            <Modal.Footer className="ap-modal-foot">
              <span className="ap-muted me-auto"><RiTimeLine /> Received {fmtDateTime(selected.created_at)}</span>
              <button
                type="button"
                className="ap-btn primary"
                onClick={() => {
                  setReply({
                    subject: `Re: ${TYPE_LABELS[selected.enquiry_type] || "your enquiry"} — Bluebell School`,
                    message: `Dear ${selected.name},\n\nThank you for reaching out to Bluebell International School.\n\n\n\nKind regards,\nAdmissions Office\n`,
                  });
                  setReplyOpen(true);
                }}
              >
                <RiMailSendLine /> Reply by email
              </button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      {/* ---------- reply modal ---------- */}
      <Modal show={replyOpen} onHide={() => setReplyOpen(false)} centered contentClassName="ap-modal-content">
        <Modal.Header className="ap-modal-head blue" closeButton closeVariant="white">
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>
            <RiMailSendLine /> Reply to {selected?.email}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="ap-modal-body">
          <label className="ap-label">Subject</label>
          <input className="ap-input mb-2" value={reply.subject} onChange={(e) => setReply((r) => ({ ...r, subject: e.target.value }))} />
          <label className="ap-label">Message</label>
          <textarea className="ap-input" rows={8} value={reply.message} onChange={(e) => setReply((r) => ({ ...r, message: e.target.value }))} />
        </Modal.Body>
        <Modal.Footer className="ap-modal-foot">
          <button type="button" className="ap-btn ghost" onClick={() => setReplyOpen(false)}>Cancel</button>
          <button type="button" className="ap-btn primary" onClick={sendReply} disabled={busy || !reply.message.trim()}>
            {busy ? "Sending…" : "Send reply"}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
