"use client";

import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Container, Card, Button, Form, Spinner, Table, Badge, Row, Col, Modal } from "react-bootstrap";
import { fetchAuthRoles, isDev } from "../utils/authUtils";
import { logAction } from "../api/auditLog";

// Auth tables (bluebell_userauth, bluebell_teacherauth, devauth, bluebell_secretaryauth)
// are intentionally excluded from export/import/delete.
const TABLES = [
  "bluebell_student",
  "bluebell_result",
  "bluebell_result_history",
  "bluebell_paymentsinfo",
  "bluebell_settings",
  "bluebell_classfees",
  "bluebell_class_specific_fees",
  // NOTE: bluebell_class_bal is NOT in this list — the table does not exist on this
  // deployment (the midterm result card queries it but fails soft to empty).
  // Re-add here if it is ever created.
  "bluebell_attendance",
  "bluebell_staff_attendance",
  "bluebell_staff",
  "bluebell_cbtQuestions",
  "bluebell_cbt_completion",
  "bluebell_cbt_essay",
  "bluebell_cbt_results",
  // Teaching & learning surfaces (staff portal + admin mirrors)
  "bluebell_lesson_plans",
  "bluebell_notes",
  "bluebell_assignments",
  "bluebell_staff_assignments",
  // Messaging, website enquiries and audit trail
  "bluebell_chat_conversations",
  "bluebell_chat_messages",
  "bluebell_enquiries",
  "bluebell_auditlogs",
];

const PAGE = 1000;      // Supabase default single-request cap
const INSERT_CHUNK = 500;

// jsonb columns hold objects/arrays which XLSX would drop inside object cells —
// flatten them to JSON strings on export.
const cellText = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v);

// With cellDates on read, Excel date cells arrive as Date objects; convert them
// back to plain strings (midnight → YYYY-MM-DD so date columns stay clean,
// otherwise full ISO timestamp) so Supabase accepts them.
const excelDateToIso = (v) => {
  if (!(v instanceof Date)) return v;
  const pad = (n) => String(n).padStart(2, "0");
  const midnight = v.getHours() === 0 && v.getMinutes() === 0 && v.getSeconds() === 0;
  if (midnight) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  return v.toISOString();
};

// Fetch every row of a table via explicit .range() paging (never truncated at 1000)
const fetchAllRows = async (table, onPage) => {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (onPage) onPage(all.length);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
};

const DataTools = () => {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState({ adminEmails: [], teacherEmails: [], devEmails: [] });
  const [ready, setReady] = useState(false);

  // export state
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");

  // import state
  const [importWb, setImportWb] = useState(null);      // parsed workbook
  const [mappings, setMappings] = useState([]);        // [{sheet, table, rows}]
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [preview, setPreview] = useState(null);        // {sheet, table, rows}

  // delete-all state
  const [delTable, setDelTable] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user: cu } } = await supabase.auth.getUser();
      setUser(cu);
      const r = await fetchAuthRoles(supabase);
      setRoles(r);
      setReady(true);
    };
    init();
  }, []);

  const email = user?.user_metadata?.email;
  // Developer-only surface — matches the sidebar/bottom-nav gating (isDev
  // covers both the built-in DEV_EMAILS list and the devauth table).
  const allowed = isDev(email, roles.devEmails);
  const role = "developer";

  // ---------- EXPORT ALL ----------
  const handleExportAll = async () => {
    setExporting(true);
    setExportStatus("Starting…");
    try {
      const wb = XLSX.utils.book_new();
      for (const table of TABLES) {
        setExportStatus(`Exporting ${table}…`);
        let rows = [];
        try {
          rows = await fetchAllRows(table, (n) => setExportStatus(`Exporting ${table}… ${n} rows`));
          rows = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cellText(v)])));
        } catch (e) {
          // table may not exist on this deployment – record and continue
          rows = [{ note: `Export failed: ${e.message}` }];
        }
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ note: "empty table" }]);
        XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31));
      }
      setExportStatus("Writing file…");
      XLSX.writeFile(wb, `bluebell_full_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Full database export downloaded");
      logAction(supabase, { email, role, action: "data_export_all", targetTable: "ALL", details: { tables: TABLES.length } });
    } catch (e) {
      console.error(e);
      toast.error("Export failed: " + e.message);
    } finally {
      setExporting(false);
      setExportStatus("");
    }
  };

  // ---------- IMPORT ----------
  const handleFile = async (file) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      setImportWb(wb);
      setImportResults(null);
      // auto-match sheet names to tables
      setMappings(
        wb.SheetNames.map((sheet) => ({
          sheet,
          table: TABLES.includes(sheet) ? sheet : "",
          rows: XLSX.utils.sheet_to_json(wb.Sheets[sheet]),
        }))
      );
      toast.success(`Workbook loaded: ${wb.SheetNames.length} sheet(s)`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to read file: " + e.message);
    }
  };

  const setMappingTable = (sheet, table) =>
    setMappings((prev) => prev.map((m) => (m.sheet === sheet ? { ...m, table } : m)));

  const cleanRows = (rows, columns) => {
    // drop unknown columns; drop id when it looks auto-generated (uuid/number) so Supabase
    // assigns new ones; drop rows that end up with no columns at all — this is what keeps the
    // "note" placeholder rows the exporter writes for empty/failed tables from being inserted
    return rows
      .map((r) => {
        const out = {};
        Object.keys(r).forEach((k) => {
          if (!columns || columns.includes(k)) out[k] = excelDateToIso(r[k]);
        });
        if (out.id !== undefined && columns && columns.includes("id")) {
          const looksAuto = /^[\w-]{30,}$/.test(String(out.id)) || !Number.isNaN(Number(out.id));
          if (looksAuto) delete out.id;
        }
        return out;
      })
      .filter((r) => Object.keys(r).length > 0);
  };

  const handleImport = async () => {
    const active = mappings.filter((m) => m.table && m.rows.length > 0);
    if (active.length === 0) {
      toast.warn("No mapped sheets with data to import");
      return;
    }
    setImporting(true);
    const results = [];
    try {
      for (const m of active) {
        // derive valid columns from a one-row sample (skip sanitization when table is empty)
        const { data: sample } = await supabase.from(m.table).select("*").limit(1);
        const columns = sample && sample[0] ? Object.keys(sample[0]) : null;
        const rows = cleanRows(m.rows, columns);
        let inserted = 0;
        let failed = 0;
        let lastError = "";
        for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
          const chunk = rows.slice(i, i + INSERT_CHUNK);
          const { error } = await supabase.from(m.table).insert(chunk);
          if (error) {
            // fall back to per-row inserts so one bad row doesn't kill the chunk
            for (const row of chunk) {
              const { error: rowErr } = await supabase.from(m.table).insert([row]);
              if (rowErr) { failed++; lastError = rowErr.message; }
              else inserted++;
            }
          } else {
            inserted += chunk.length;
          }
          setImportResults([...results, { table: m.table, sheet: m.sheet, inserted, failed, lastError }]);
        }
        results.push({ table: m.table, sheet: m.sheet, inserted, failed, lastError });
        logAction(supabase, { email, role, action: "data_import", targetTable: m.table, details: { sheet: m.sheet, inserted, failed } });
      }
      setImportResults(results);
      toast.success("Import finished");
    } catch (e) {
      console.error(e);
      toast.error("Import failed: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  // ---------- DELETE ALL ----------
  const handleDeleteAll = async () => {
    if (!delTable || confirmText !== delTable) {
      toast.error("Type the exact table name to confirm");
      return;
    }
    setDeleting(true);
    try {
      // .select("id") returns the deleted rows so we can report an actual count
      // instead of a silent success when nothing matched
      const { data: deleted, error } = await supabase
        .from(delTable)
        .delete()
        .not("id", "is", null)
        .select("id");
      if (error) throw error;
      const n = (deleted || []).length;
      toast.success(`${n}${n === PAGE ? "+" : ""} row(s) deleted from ${delTable}`);
      logAction(supabase, { email, role, action: "data_delete_all", targetTable: delTable, details: { table: delTable, deleted: n } });
      setShowConfirm(false);
      setConfirmText("");
      setDelTable("");
    } catch (e) {
      console.error(e);
      toast.error("Delete failed: " + e.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!ready) return <div className="p-5 text-center"><Spinner animation="border" /></div>;
  if (!allowed) {
    return (
      <div className="p-5 text-center">
        <h4>Access denied</h4>
        <p className="text-muted">Only developers can use data tools.</p>
      </div>
    );
  }

  return (
    <Container className="py-4" style={{ maxWidth: 1000 }}>
      <ToastContainer />
      <h3 className="mb-3">Data Tools</h3>

      {/* Export */}
      <Card className="mb-4">
        <Card.Header>Export All Data to Excel</Card.Header>
        <Card.Body>
          <p className="text-muted mb-2">
            Downloads every table ({TABLES.length} tables) as one workbook with one sheet per table.
            Recommended as a backup before starting a new session.
          </p>
          <Button variant="success" onClick={handleExportAll} disabled={exporting}>
            {exporting ? <span><Spinner size="sm" animation="border" /> {exportStatus}</span> : "Export All to Excel"}
          </Button>
        </Card.Body>
      </Card>

      {/* Import */}
      <Card className="mb-4">
        <Card.Header>Import Data from Excel</Card.Header>
        <Card.Body>
          <Form.Control
            type="file"
            accept=".xlsx,.xls,.csv"
            className="mb-3"
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
          />
          {importWb && (
            <>
              <Table size="sm" bordered responsive>
                <thead>
                  <tr><th>Sheet</th><th>Target Table</th><th>Rows</th><th>Preview</th></tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.sheet}>
                      <td>{m.sheet}</td>
                      <td>
                        <Form.Select size="sm" value={m.table} onChange={(e) => setMappingTable(m.sheet, e.target.value)}>
                          <option value="">— skip —</option>
                          {TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </Form.Select>
                      </td>
                      <td>{m.rows.length}</td>
                      <td>
                        <Button size="sm" variant="outline-secondary" disabled={m.rows.length === 0}
                          onClick={() => setPreview(m)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Button variant="primary" onClick={handleImport} disabled={importing}>
                {importing ? <Spinner size="sm" animation="border" /> : "Import Mapped Sheets"}
              </Button>
              {importResults && (
                <div className="mt-3">
                  {importResults.map((r, i) => (
                    <div key={i}>
                      <Badge bg={r.failed ? "warning" : "success"}>{r.table}</Badge>{" "}
                      {r.inserted} inserted, {r.failed} failed{r.lastError ? ` (${r.lastError})` : ""}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Delete all */}
      <Card className="mb-4" border="danger">
        <Card.Header className="text-danger">Delete All Rows From a Table</Card.Header>
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={7}>
              <Form.Group controlId="delTable">
                <Form.Label>Table</Form.Label>
                <Form.Select value={delTable} onChange={(e) => setDelTable(e.target.value)}>
                  <option value="">Select table…</option>
                  {TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={5}>
              <Button variant="danger" disabled={!delTable} onClick={() => setShowConfirm(true)}>
                Delete All…
              </Button>
            </Col>
          </Row>
          <p className="text-muted small mt-2 mb-0">
            Authentication tables (bluebell_userauth, bluebell_teacherauth, devauth, bluebell_secretaryauth) can never be deleted here.
          </p>
        </Card.Body>
      </Card>

      {/* Preview modal */}
      <Modal show={!!preview} onHide={() => setPreview(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">Preview: {preview?.sheet} → {preview?.table || "unmapped"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {preview && (
            <Table size="sm" bordered responsive>
              <thead>
                <tr>{Array.from(new Set(preview.rows.slice(0, 10).flatMap((r) => Object.keys(r)))).map((k) => <th key={k}>{k}</th>)}</tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 10).map((r, i) => (
                  <tr key={i}>{Array.from(new Set(preview.rows.slice(0, 10).flatMap((x) => Object.keys(x)))).map((k) => <td key={k}>{String(r[k] ?? "")}</td>)}</tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
      </Modal>

      {/* Typed-name delete confirmation */}
      <Modal show={showConfirm} onHide={() => { setShowConfirm(false); setConfirmText(""); }} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5 text-danger">Confirm destructive delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>You are about to permanently delete <b>all rows</b> from <code>{delTable}</code>.</p>
          <p className="mb-2">Type the table name below to confirm:</p>
          <Form.Control type="text" value={confirmText} placeholder={delTable}
            onChange={(e) => setConfirmText(e.target.value)} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowConfirm(false); setConfirmText(""); }}>Cancel</Button>
          <Button variant="danger" disabled={confirmText !== delTable || deleting} onClick={handleDeleteAll}>
            {deleting ? <Spinner size="sm" animation="border" /> : `Delete all from ${delTable}`}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default DataTools;
