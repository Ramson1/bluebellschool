"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { CLASS_OPTIONS, canonClass, canonicalizeClasses } from "../utils/classOptions";
import { Container, Row, Col, Card, Form, Button, Table, Spinner, Badge } from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { RiArchive2Line, RiEyeLine, RiRefreshLine, RiLockLine } from "react-icons/ri";

// Result Archive — every result ever recorded, drawn from jmis_result_history.
// These rows are copies made at each new-session rollover (Settings) and when a
// student is removed from the active list (Full Student Record). Because the
// archive stores the student's NAME and CLASS alongside the scores, a result
// stays viewable here even after the student record itself has been deleted.
export default function ResultHistory() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [sessionLabel, setSessionLabel] = useState("");
  const [includeCurrent, setIncludeCurrent] = useState(true);

  // filters
  const [search, setSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");

  // Has a term column actually been filled in? Stored as an array or object.
  const hasData = (v) => {
    if (!v) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return false;
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const {
          data: { user: cu },
        } = await supabase.auth.getUser();
        setUser(cu);
        if (!cu) {
          setAllowed(false);
          setReady(true);
          setLoading(false);
          return;
        }
        const email = cu?.user_metadata?.email || "";

        // Admin / dev gate (mirrors the Full Student Record guard).
        const [ua, da] = await Promise.all([
          supabase.from("jmis_userauth").select("email"),
          supabase.from("devauth").select("email"),
        ]);
        const admins = (ua.data || []).map((r) => (r.email || "").toLowerCase());
        const devs = (da.data || []).map((r) => (r.email || "").toLowerCase());
        const ok = admins.includes(email.toLowerCase()) || devs.includes(email.toLowerCase());
        setAllowed(ok);
        if (!ok) {
          setReady(true);
          setLoading(false);
          return;
        }

        await loadArchive();
      } catch (e) {
        console.error("Result Archive init error:", e);
        toast.error("Could not load the archive: " + (e.message || e));
      } finally {
        setReady(true);
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (allowed) loadArchive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeCurrent]);

  const loadArchive = async () => {
    setLoading(true);
    try {
      const [hist, cur, st] = await Promise.all([
        supabase
          .from("jmis_result_history")
          .select("*")
          .order("archived_at", { ascending: false }),
        includeCurrent
          ? supabase.from("jmis_result").select("*")
          : Promise.resolve({ data: [] }),
        supabase.from("jmis_settings").select("session, term").limit(1),
      ]);

      if (hist.error) {
        toast.error("Archive read failed — RLS policy may be missing. Run platform_result_history_rls_fix.sql in Supabase.");
        console.error(hist.error);
      }
      if (cur.error) console.error(cur.error);

      const curSession = (st.data && st.data[0] && st.data[0].session) || "";
      setSessionLabel(curSession);

      const mapped = [];
      (hist.data || []).forEach((r) => mapped.push(normalizeRow(r, "Archived")));
      (cur.data || []).forEach((r) => mapped.push(normalizeRow(r, "Current", curSession)));
      setRows(mapped);
    } catch (e) {
      console.error("loadArchive error:", e);
      toast.error("Could not load results: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const normalizeRow = (raw, source, fallbackSession = "") => {
    const terms = [];
    if (hasData(raw.term1Subjects)) terms.push({ label: "1st Term", query: "1st term" });
    if (hasData(raw.term2Subjects)) terms.push({ label: "2nd Term", query: "2nd term" });
    if (hasData(raw.term3Subjects)) terms.push({ label: "3rd Term", query: "3rd term" });
    return {
      key: `${source}-${raw.id ?? raw.studentId}-${raw.archived_at ?? ""}`,
      raw,
      source,
      studentId: raw.studentId,
      studentName: raw.studentName || "—",
      studentClass: raw.studentClass || "—",
      session: raw.archived_session || fallbackSession || "—",
      archivedAt: raw.archived_at || null,
      terms,
    };
  };

  // Open the existing printable result card (same route the public portal uses)
  // sourced from the archived row, so deleted students render too.
  const viewCard = async (row, term) => {
    let passportRow = {};
    try {
      const { data } = await supabase
        .from("jmis_student")
        .select("*")
        .eq("id", row.studentId)
        .maybeSingle();
      if (data) passportRow = data;
    } catch (e) {
      // student may have been deleted — the card falls back to a placeholder
    }
    try {
      localStorage.setItem("studentResultData", JSON.stringify(row.raw));
      localStorage.setItem("studentPassportData", JSON.stringify(passportRow));
    } catch (e) {
      toast.error("Could not open the result card (data too large for storage)");
      return;
    }
    window.location.href = `/resultCardComponent?selectedTerm=${encodeURIComponent(
      term.query
    )}&resultType=general`;
  };

  const sessions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.session).filter(Boolean))).sort(),
    [rows]
  );
  const classes = useMemo(
    // full canonical list (Creche → Year 12) plus any legacy labels in the archive
    () => canonicalizeClasses([...CLASS_OPTIONS, ...rows.map((r) => r.studentClass).filter((c) => c && c !== "—")]),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (sessionFilter && r.session !== sessionFilter) return false;
      if (classFilter && canonClass(r.studentClass) !== classFilter) return false;
      if (q) {
        const hay = `${r.studentName} ${r.studentClass} ${r.studentId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, sessionFilter, classFilter]);

  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  if (!ready || loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <div className="mt-2 text-muted">Loading result archive…</div>
      </Container>
    );
  }

  if (!allowed) {
    return (
      <Container className="py-5">
        <Card className="text-center shadow-sm">
          <Card.Body>
            <RiLockLine size={40} className="text-muted" />
            <h5 className="mt-2">Restricted</h5>
            <p className="text-muted mb-0">
              The Result Archive is only available to administrators. Please sign in with an admin account.
            </p>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      <ToastContainer position="top-right" autoClose={2500} />
      <Row className="align-items-center mb-3">
        <Col>
          <h3 className="mb-0" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RiArchive2Line /> Result Archive
          </h3>
          <div className="text-muted" style={{ fontSize: 14 }}>
            Every archived result, across all terms and sessions — including students who have left the school.
          </div>
        </Col>
        <Col xs="auto">
          <Button variant="outline-secondary" onClick={loadArchive} disabled={loading}>
            <RiRefreshLine /> Refresh
          </Button>
        </Col>
      </Row>

      <Card className="shadow-sm mb-3">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={4}>
              <Form.Label className="mb-1" style={{ fontSize: 13 }}>Search</Form.Label>
              <Form.Control
                placeholder="Student name, class or ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Label className="mb-1" style={{ fontSize: 13 }}>Session</Form.Label>
              <Form.Select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)}>
                <option value="">All sessions</option>
                {sessions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label className="mb-1" style={{ fontSize: 13 }}>Class</Form.Label>
              <Form.Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Check
                type="switch"
                id="include-current"
                label="Include current"
                checked={includeCurrent}
                onChange={(e) => setIncludeCurrent(e.target.checked)}
              />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Body>
          <div className="text-muted mb-2" style={{ fontSize: 13 }}>
            Showing <b>{filtered.length}</b> of <b>{rows.length}</b> archived result record(s).
          </div>
          {filtered.length === 0 ? (
            <div className="text-center text-muted py-4">
              No archived results yet. Results are added here automatically at each new-session
              rollover (Settings) and when a student is removed from the active list (Full Student Record).
            </div>
          ) : (
            <Table responsive hover striped className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Session</th>
                  <th>Source</th>
                  <th>Archived</th>
                  <th style={{ minWidth: 220 }}>Term results</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.studentName}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>ID: {r.studentId ?? "—"}</div>
                    </td>
                    <td>{r.studentClass}</td>
                    <td>{r.session}</td>
                    <td>
                      <Badge bg={r.source === "Current" ? "success" : "secondary"}>{r.source}</Badge>
                    </td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.archivedAt)}</td>
                    <td>
                      {r.terms.length === 0 ? (
                        <span className="text-muted" style={{ fontSize: 12 }}>No term data</span>
                      ) : (
                        r.terms.map((t) => (
                          <Button
                            key={t.query}
                            size="sm"
                            variant="outline-primary"
                            className="me-2 mb-1"
                            onClick={() => viewCard(r, t)}
                          >
                            <RiEyeLine /> {t.label}
                          </Button>
                        ))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
