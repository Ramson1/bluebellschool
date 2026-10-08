"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Table, Button, Form, Spinner, Badge, Col } from "react-bootstrap";
import { fetchAuthRoles, isAdmin, isDev } from "../utils/authUtils";

const PAGE_SIZE = 50;

// small helper col component to keep the filter row tidy
const Col3 = (props) => <Col xs={12} sm={6} md={3} {...props} />;

const AuditLogs = () => {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState({ adminEmails: [], teacherEmails: [], devEmails: [] });
  const [ready, setReady] = useState(false);

  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null); // id of row whose details are shown

  // filters
  const [fEmail, setFEmail] = useState("");
  const [fAction, setFAction] = useState("");
  const [fTable, setFTable] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  // staff drill-down (requirement 6): jump straight to one staff member's activity
  const [fStaff, setFStaff] = useState("");
  const [staffOptions, setStaffOptions] = useState([]);

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
  const allowed = isAdmin(email, roles.adminEmails) || isDev(email, roles.devEmails);

  useEffect(() => {
    if (!allowed) return;
    // never fatal: staff directory may be empty before the SQL migration
    Promise.resolve(supabase.from("jmis_staff").select("name, email").order("name"))
      .then(({ data }) => setStaffOptions((data || []).filter((s) => s.email)))
      .catch(() => setStaffOptions([]));
  }, [allowed]);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      let q = supabase
        .from("jmis_auditlogs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (fEmail) q = q.ilike("email", `%${fEmail}%`);
      if (fStaff) q = q.eq("email", fStaff);
      if (fAction) q = q.eq("action", fAction);
      if (fTable) q = q.eq("target_table", fTable);
      if (fFrom) q = q.gte("created_at", new Date(fFrom).toISOString());
      if (fTo) {
        const d = new Date(fTo); d.setHours(23, 59, 59, 999);
        q = q.lte("created_at", d.toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load audit logs: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [allowed, page, fEmail, fStaff, fAction, fTable, fFrom, fTo]);

  useEffect(() => { load(); }, [load]);

  if (!ready) return <div className="p-5"><Spinner animation="border" /></div>;
  if (!allowed) {
    return (
      <div className="p-5 text-center">
        <h4>Access denied</h4>
        <p className="text-muted">Only administrators can view audit logs.</p>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <ToastContainer />
      <h3 className="mb-3">Audit Logs</h3>

      <Form className="row g-2 mb-3">
        <Form.Group as={Col3} controlId="fStaff">
          <Form.Select size="sm" value={fStaff} onChange={(e) => { setFStaff(e.target.value); setPage(0); }}>
            <option value="">All staff (drill down by person…)</option>
            {staffOptions.map((s) => (
              <option key={s.email} value={s.email}>{s.name} — {s.email}</option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group as={Col3} controlId="fEmail">
          <Form.Control size="sm" placeholder="Filter email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} />
        </Form.Group>
        <Form.Group as={Col3} controlId="fAction">
          <Form.Control size="sm" placeholder="Filter action" value={fAction} onChange={(e) => setFAction(e.target.value)} />
        </Form.Group>
        <Form.Group as={Col3} controlId="fTable">
          <Form.Control size="sm" placeholder="Filter table" value={fTable} onChange={(e) => setFTable(e.target.value)} />
        </Form.Group>
        <Form.Group as={Col3} controlId="fFrom">
          <Form.Control size="sm" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        </Form.Group>
        <Form.Group as={Col3} controlId="fTo">
          <Form.Control size="sm" type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        </Form.Group>
        <Form.Group as={Col3}>
          <Button size="sm" variant="secondary" onClick={() => { setFEmail(""); setFStaff(""); setFAction(""); setFTable(""); setFFrom(""); setFTo(""); setPage(0); }}>Clear</Button>
        </Form.Group>
      </Form>

      <Table striped bordered hover size="sm" responsive>
        <thead>
          <tr>
            <th>Time</th><th>Email</th><th>Role</th><th>Action</th><th>Table</th><th>Record</th><th></th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <React.Fragment key={l.id}>
              <tr>
                <td>{new Date(l.created_at).toLocaleString()}</td>
                <td>{l.email}</td>
                <td><Badge bg="secondary">{l.role}</Badge></td>
                <td><Badge bg="primary">{l.action}</Badge></td>
                <td>{l.target_table}</td>
                <td>{l.record_id}</td>
                <td>
                  <Button size="sm" variant="outline-secondary" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                    {expanded === l.id ? "Hide" : "Details"}
                  </Button>
                </td>
              </tr>
              {expanded === l.id && (
                <tr>
                  <td colSpan={7}>
                    <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: "12px" }}>
                      {JSON.stringify(l.details, null, 2)}
                    </pre>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {logs.length === 0 && (
            <tr><td colSpan={7} className="text-center text-muted py-4">No audit entries found.</td></tr>
          )}
        </tbody>
      </Table>

      <div className="d-flex justify-content-between align-items-center">
        <Button size="sm" variant="outline-primary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
        <span>Page {page + 1}</span>
        <Button size="sm" variant="outline-primary" disabled={logs.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  );
};

export default AuditLogs;
