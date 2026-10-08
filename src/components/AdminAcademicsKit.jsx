"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import { supabase } from "../supabaseClient.js";
import { CLASS_OPTIONS, canonClass } from "../utils/classOptions";
import { logAction } from "../api/auditLog.js";
import { schoolSubjects } from "../utils/subjectUtils.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/AdminPages.css";
import {
  RiAddLine,
  RiSearchLine,
  RiRefreshLine,
  RiEditLine,
  RiDeleteBinLine,
  RiUploadCloud2Line,
  RiAttachmentLine,
  RiCloseLine,
} from "react-icons/ri";

// Canonical class list — shared single source of truth (utils/classOptions.js).
const CLASSES = CLASS_OPTIONS;

// Every subject the school teaches (union of all class subject lists).
const ALL_SUBJECTS = Array.from(new Set(Object.values(schoolSubjects).flat())).sort();

const TERMS = ["First Term", "Second Term", "Third Term"];

// Upload an attachment to the shared 'cbt' bucket under academics/<table>/,
// exactly like the staff portal, so files stay in one place for students too.
async function uploadAcademicFile(file, folder = "misc") {
  const ext = file.name.split(".").pop() || "bin";
  const path = `academics/${folder}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const { error } = await supabase.storage.from("cbt").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("cbt").getPublicUrl(path);
  return data.publicUrl;
}

// Theme-aware drag & drop attachment picker that replaces the raw browser
// file input: click (or Enter/Space) opens the native dialog, dropping a file
// runs the same upload. Once attached the file shows as a chip with an open
// link and a remove button; a paste-a-link fallback stays available below.
function FileDrop({ value, name, busy, onFile, onClear }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const fileName = name || (value ? decodeURIComponent(value.split("/").pop().split("?")[0]) : "");
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && !busy) onFile(f);
  };
  if (value && !busy) {
    return (
      <div className="ap-filechip">
        <RiAttachmentLine />
        <a href={value} target="_blank" rel="noopener noreferrer" title={fileName}>
          {fileName || "Attached file"}
        </a>
        <button type="button" className="ap-filechip-x" title="Remove attachment" onClick={onClear}>
          <RiCloseLine />
        </button>
      </div>
    );
  }
  return (
    <>
      <div
        className={`ap-dropzone${drag ? " drag" : ""}${busy ? " busy" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Attach a file"
        onClick={() => { if (!busy) inputRef.current?.click(); }}
        onKeyDown={(e) => { if (!busy && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); inputRef.current?.click(); } }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); if (!busy) setDrag(true); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!busy) setDrag(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDrag(false); }}
        onDrop={handleDrop}
      >
        <RiUploadCloud2Line className="ap-dropzone-ic" />
        <div>
          <div className="ap-dropzone-title">{busy ? "Uploading, please wait…" : "Drag & drop a file here"}</div>
          <div className="ap-dropzone-sub">or click to browse (PDF, DOCX, images, video…)</div>
        </div>
      </div>
      <input
        ref={inputRef} type="file" hidden
        onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value = ""; }}
      />
    </>
  );
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");

/**
 * Config-driven admin management screen for a staff-portal academic table
 * (jmis_notes / jmis_assignments). Unlike the staff version it is NOT scoped
 * to the signed-in user's classes — admins see, filter, add, edit and delete
 * every record across the school.
 *
 * config: {
 *   table, title, icon, blurb, singular,
 *   authorField,               // column that stores the authoring email
 *   fields: [{ key, label, type, required, options, full, rows, placeholder }]
 *   listColumns: [{ key, label, render? }]   // render receives (row)
 * }
 */
export function makeAdminAcademicsPage(config) {
  return function AdminAcademicsPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [session, setSession] = useState("");
    const [search, setSearch] = useState("");
    const [clsFilter, setClsFilter] = useState("");
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({});
    const [fileBusy, setFileBusy] = useState(false);
    const [fileNames, setFileNames] = useState({});
    const [pendingDelete, setPendingDelete] = useState(null);

    useEffect(() => {
      supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email || "admin@school"));
      supabase.from("jmis_settings").select("session").limit(1).then(({ data }) => {
        if (data && data[0]?.session) setSession(data[0].session);
      });
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const load = () => {
      setLoading(true);
      supabase
        .from(config.table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000)
        .then(({ data, error }) => {
          if (error) toast.error(`Could not load ${config.title.toLowerCase()}: ${error.message}`);
          setRows(data || []);
        })
        .finally(() => setLoading(false));
    };

    const openNew = () => {
      const initial = {};
      for (const f of config.fields) {
        if (f.key === "academic_session") initial[f.key] = session || "";
      }
      setForm(initial);
      setEditing(null);
      setShow(true);
    };
    const openEdit = (r) => { setForm({ ...r }); setEditing(r); setShow(true); };
    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const onPickFile = async (key, file) => {
      if (!file) return;
      setFileBusy(true);
      try {
        const url = await uploadAcademicFile(file, config.table);
        setField(key, url);
        setFileNames((n) => ({ ...n, [key]: file.name }));
        toast.success("File uploaded.");
      } catch (e) {
        toast.error("Upload failed: " + (e.message || "try pasting a link instead"));
      } finally {
        setFileBusy(false);
      }
    };

    const validate = () => {
      for (const f of config.fields) {
        if (f.required && !String(form[f.key] ?? "").trim()) return `${f.label} is required.`;
      }
      return null;
    };

    const save = async () => {
      const err = validate();
      if (err) { toast.warn(err); return; }
      setSaving(true);
      const payload = {};
      for (const f of config.fields) {
        let v = form[f.key];
        if (v === undefined) continue;
        if (f.type === "number") v = v === "" ? null : Number(v);
        payload[f.key] = typeof v === "string" ? v : v;
      }
      if (!editing) payload[config.authorField || "created_by"] = email;
      const res = editing
        ? await supabase.from(config.table).update(payload).eq("id", editing.id).select()
        : await supabase.from(config.table).insert([payload]).select();
      setSaving(false);
      if (res.error) { toast.error(res.error.message); return; }
      logAction(supabase, {
        email, role: "admin",
        action: editing ? `${config.table}_update` : `${config.table}_add`,
        targetTable: config.table, recordId: res.data?.[0]?.id,
        details: { class: payload.class, subject: payload.subject, title: payload.title || "" },
      });
      setShow(false);
      if (editing) setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...res.data[0] } : r)));
      else setRows((rs) => [res.data[0], ...rs]);
      toast.success(editing ? "Updated." : "Saved.");
    };

    const confirmDelete = async () => {
      const r = pendingDelete;
      if (!r) return;
      const { error } = await supabase.from(config.table).delete().eq("id", r.id);
      setPendingDelete(null);
      if (error) { toast.error(error.message); return; }
      logAction(supabase, {
        email, role: "admin", action: `${config.table}_delete`,
        targetTable: config.table, recordId: r.id,
        details: { class: r.class, subject: r.subject, title: r.title || "" },
      });
      setRows((rs) => rs.filter((x) => x.id !== r.id));
      toast.success("Deleted.");
    };

    const visible = useMemo(() => {
      const q = search.trim().toLowerCase();
      return rows.filter((r) => {
        if (clsFilter && canonClass(r.class) !== clsFilter) return false;
        if (!q) return true;
        return JSON.stringify(r).toLowerCase().includes(q);
      });
    }, [rows, search, clsFilter]);

    const Icon = config.icon;
    return (
      <div className="ap-page">
        <ToastContainer position="top-center" />
        <div className="ap-head">
          <div>
            <h1 className="ap-title"><span className="ap-title-ic"><Icon /></span>{config.title}</h1>
            <p className="ap-sub">{config.blurb}</p>
          </div>
          <div className="ap-actions">
            <span className="ap-pill blue">{visible.length} record{visible.length === 1 ? "" : "s"}</span>
            <button className="ap-btn primary" onClick={openNew}><RiAddLine /> New</button>
          </div>
        </div>

        <div className="ap-toolbar">
          <div className="ap-search">
            <RiSearchLine />
            <input className="ap-input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="ap-input" value={clsFilter} onChange={(e) => setClsFilter(e.target.value)}>
            <option value="">All classes</option>
            {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
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
                    {(config.listColumns || []).map((c) => <th key={c.key}>{c.label}</th>)}
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr><td colSpan={(config.listColumns || []).length + 1} className="ap-empty">No {config.title.toLowerCase()} yet.</td></tr>
                  ) : visible.map((r) => (
                    <tr key={r.id}>
                      {(config.listColumns || []).map((c) => (
                        <td key={c.key}>{c.render ? c.render(r) : String(r[c.key] ?? "—")}</td>
                      ))}
                      <td className="text-end">
                        <button className="ap-btn sm" onClick={() => openEdit(r)}><RiEditLine /> Edit</button>{" "}
                        <button className="ap-btn sm red" onClick={() => setPendingDelete(r)}><RiDeleteBinLine /> Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add / Edit modal */}
        <Modal show={show} onHide={() => setShow(false)} size="lg" centered>
          <Modal.Header className="ap-modal-head" closeButton closeVariant="white">
            <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>
              {editing ? "Edit" : "New"} {config.singular || config.title.toLowerCase()}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="ap-modal-body">
            <div className="row g-3">
              {config.fields.map((f) => (
                <div className={f.full ? "col-12" : "col-md-6"} key={f.key}>
                  <label className="ap-label">{f.label}{f.required ? " *" : ""}</label>
                  {f.type === "textarea" ? (
                    <textarea className="ap-input" rows={f.rows || 4} value={form[f.key] || ""} placeholder={f.placeholder} onChange={(e) => setField(f.key, e.target.value)} />
                  ) : f.type === "select" ? (
                    <select className="ap-input" value={form[f.key] || ""} onChange={(e) => setField(f.key, e.target.value)}>
                      <option value="">Select…</option>
                      {(f.key === "class" ? CLASSES : f.key === "subject" ? ALL_SUBJECTS : f.options || []).map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.type === "file" ? (
                    <div>
                      <FileDrop
                        value={form[f.key]}
                        name={fileNames[f.key]}
                        busy={fileBusy}
                        onFile={(file) => onPickFile(f.key, file)}
                        onClear={() => { setField(f.key, ""); setFileNames((n) => ({ ...n, [f.key]: "" })); }}
                      />
                      <div className="ap-or">or paste a link</div>
                      <input
                        className="ap-input" placeholder="https://… (file link)"
                        value={form[f.key] || ""} onChange={(e) => setField(f.key, e.target.value)}
                      />
                    </div>
                  ) : (
                    <input
                      className="ap-input"
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={form[f.key] ?? ""} placeholder={f.placeholder}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </Modal.Body>
          <Modal.Footer className="ap-modal-foot">
            <Button variant="light" onClick={() => setShow(false)}>Cancel</Button>
            <Button variant="success" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</Button>
          </Modal.Footer>
        </Modal>

        {/* Custom delete confirmation (admin UI convention: no browser confirm) */}
        <Modal show={!!pendingDelete} onHide={() => setPendingDelete(null)} centered>
          <Modal.Header className="ap-modal-head" closeButton closeVariant="white">
            <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>Delete {config.singular || config.title.toLowerCase()}?</Modal.Title>
          </Modal.Header>
          <Modal.Body className="ap-modal-body">
            {pendingDelete && (
              <p style={{ margin: 0 }}>
                Delete <b>{pendingDelete.title || "this entry"}</b>
                {pendingDelete.class ? <> for <b>{pendingDelete.class}</b></> : null}
                {pendingDelete.subject ? <> · {pendingDelete.subject}</> : null}? This cannot be undone.
              </p>
            )}
          </Modal.Body>
          <Modal.Footer className="ap-modal-foot">
            <Button variant="light" onClick={() => setPendingDelete(null)}><RiCloseLine /> Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}><RiDeleteBinLine /> Delete</Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  };
}
