"use client";

import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Container, Row, Col, Card, Button, Form, Spinner, Modal, Nav } from "react-bootstrap";
import { fetchAuthRoles, isDev, isAdmin } from "../utils/authUtils";

const SCHOOL_NAME = "Bluebell International School";
const PAGE_SIZE = 100; // students fetched per backend chunk
const GRID_SIZE = 12;  // cards displayed per pager page
const DEV_SUPPORT_EMAIL = "rhemaexpertsolutions@gmail.com";

// "Jane Doe Jr." -> "Jane-Doe-Jr" (safe PDF file name from a student name)
const fileSafe = (n) =>
  (n || "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "card";

// CR-80 ID card: 85.6 x 54 mm, printed portrait (54 wide x 85.6 tall)
const CARD_W = "54mm";
const CARD_H = "85.6mm";

// CSS pixels per millimetre (96dpi) — used to size/floor the auto-fit name.
const MM_PX = 96 / 25.4;

// Renders the student name on ONE line. Instead of wrapping onto new lines
// (which eats vertical space and pushes the QR off the fixed-height card, so it
// gets clipped by overflow:hidden), it shrinks the font-size until the whole
// name fits the card width. The size is applied inline so html2canvas captures
// the reduced size in the exported PDF too — not just on screen.
function AutoFitName({ text, maxMm = 3, minMm = 1.7 }) {
  const ref = useRef(null);
  const [px, setPx] = useState(maxMm * MM_PX);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.clientWidth) return;
    const maxPx = maxMm * MM_PX;
    const minPx = minMm * MM_PX;
    let size = maxPx;
    el.style.fontSize = `${size}px`;
    // shrink in small steps until it fits on one line (or we hit the floor)
    while (el.clientWidth > 0 && el.scrollWidth > el.clientWidth && size > minPx) {
      size = Math.max(minPx, size - 0.25);
      el.style.fontSize = `${size}px`;
    }
    setPx(size);
  }, [text, maxMm, minMm]);

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        fontSize: `${px}px`,
        fontWeight: "bold",
        marginTop: "1mm",
        marginBottom: "0.3mm",
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        lineHeight: 1.2,
      }}
    >
      {text}
    </div>
  );
}

const styles = {
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: "3mm",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    fontFamily: "Arial, Helvetica, sans-serif",
    background: "#fff",
    color: "#000", // explicit black — never inherit page/theme colors (PDF looked grey)
    border: "1px solid #ccc",
    position: "relative",
  },
  frontHeader: {
    background: "linear-gradient(135deg, #011b97 0%, #022aa1 100%)",
    color: "#fff",
    padding: "1.5mm 2mm",
    textAlign: "center",
  },
  body: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5mm 2mm 5mm" },
  backFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#011b97",
    color: "#fff",
    padding: "1.5mm 2mm",
    display: "flex",
    alignItems: "center",
    gap: "1.5mm",
  },
};

// Numbered pager rendered above and below the card grid. For students the
// backend still fetches 100-row chunks, so when there is more to load the
// Next control stays enabled and triggers the chunk prefetch via onLoadMore.
function Pager({ page, pageCount, hasMore, loading, onChange, onLoadMore }) {
  if (pageCount <= 1 && !hasMore) return null;
  const items = [];
  for (let p = 0; p < pageCount; p++) {
    if (p === 0 || p === pageCount - 1 || Math.abs(p - page) <= 2) items.push(p);
    else if (items[items.length - 1] !== "…") items.push("…");
  }
  const goto = (p) => {
    onChange(p);
    // stepping past the loaded window pulls the next student chunk first
    if (p + 1 >= pageCount && hasMore && onLoadMore) onLoadMore();
  };
  return (
    <div className="d-flex gap-1 flex-wrap align-items-center justify-content-center my-3">
      <Button size="sm" variant="outline-secondary" disabled={page === 0 || loading} onClick={() => onChange(page - 1)}>
        ‹ Prev
      </Button>
      {items.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="text-muted px-1">…</span>
        ) : (
          <Button key={p} size="sm" variant={p === page ? "success" : "outline-secondary"} disabled={loading} onClick={() => onChange(p)}>
            {p + 1}
          </Button>
        )
      )}
      {/* one virtual page beyond the loaded window when more can be fetched */}
      {hasMore && (
        <Button size="sm" variant="outline-secondary" disabled={loading} onClick={() => goto(pageCount)}>
          {loading ? <Spinner size="sm" animation="border" /> : page + 2}
        </Button>
      )}
      <Button size="sm" variant="outline-secondary" disabled={loading || (page >= pageCount && !hasMore)} onClick={() => (page + 1 >= pageCount && hasMore ? goto(pageCount) : onChange(page + 1))}>
        Next ›
      </Button>
      <span className="text-muted small ms-2">
        Page {page + 1}{pageCount > 1 ? ` of ${pageCount}` : ""}{hasMore ? "+" : ""}
      </span>
    </div>
  );
}

const IdCards = () => {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState({ adminEmails: [], teacherEmails: [], devEmails: [] });
  const [ready, setReady] = useState(false);

  const [students, setStudents] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [tab, setTab] = useState("students"); // students | staff
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [gridPage, setGridPage] = useState(0); // display pager (students/staff)
  const [schoolSettings, setSchoolSettings] = useState({ session: "", contact: {} });
  const [searchTerm, setSearchTerm] = useState("");

  // id -> QR data URL (separate maps so student and staff ids never collide)
  const [qrMap, setQrMap] = useState({});
  const [staffQrMap, setStaffQrMap] = useState({});
  const [selected, setSelected] = useState({}); // student id -> true
  const [preview, setPreview] = useState(null); // student for full-screen preview
  const [busyPdf, setBusyPdf] = useState(false);

  const exportRefs = useRef({}); // student id -> { front, back } DOM nodes

  const email = user?.user_metadata?.email;
  // Requirement 6: admins see everything — ID cards open to admin OR dev
  const allowed = isAdmin(email, roles.adminEmails) || isDev(email, roles.devEmails);

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
    const loadSettings = async () => {
      const { data } = await supabase
        .from("bluebell_settings")
        .select("session, contactContent")
        .limit(1);
      const row = (data && data[0]) || {};
      setSchoolSettings({
        session: row.session || "",
        contact: row.contactContent && typeof row.contactContent === "object" ? row.contactContent : {},
      });
    };
    loadSettings();
    loadPage(0);
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  // kind: "student" (default) or "staff" — picks which QR map the URLs land in
  const generateQrs = useCallback(async (rows, kind = "student") => {
    try {
      const QRCode = (await import("qrcode")).default || (await import("qrcode"));
      const entries = await Promise.all(
        rows.map(async (s) => {
          const payload = JSON.stringify({ sid: s.id, name: s.name });
          // 1000px + 1-module quiet zone — scannable at the printed 24mm size
          const url = await QRCode.toDataURL(payload, { margin: 1, width: 1000 });
          return [String(s.id), url];
        })
      );
      const setMap = kind === "staff" ? setStaffQrMap : setQrMap;
      setMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    } catch (e) {
      console.error("QR generation failed:", e);
      toast.error("Failed to generate QR codes");
    }
  }, []);

  // Staff are fewer than students — one shot is enough (no pagination here)
  const loadStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("bluebell_staff")
        .select("id, name, staff_no, sex, designation, department, profile_pic")
        .neq("status", "blocked")
        .order("name");
      if (error) throw error;
      const rows = data || [];
      setStaffList(rows);
      if (rows.length > 0) await generateQrs(rows, "staff");
    } catch (e) {
      console.error(e);
      toast.error("Failed to load staff: " + e.message);
    }
  };

  const loadPage = async (p) => {
    setLoadingMore(true);
    try {
      const { data, error } = await supabase
        .from("bluebell_student")
        .select("id, name, class, sex, passport")
        .order("id")
        .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = data || [];
      setStudents((prev) => (p === 0 ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
      setPage(p);
      if (rows.length > 0) await generateQrs(rows);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load students: " + e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const passportUrl = (file) =>
    file ? supabase.storage.from("passport").getPublicUrl(file).data.publicUrl : "/logo.png";

  // Staff pics may be stored as full URLs (staff_passport bucket) or bare paths
  const staffPicUrl = (file) => {
    if (!file) return "/logo.png";
    if (file.startsWith("http")) return file;
    return supabase.storage.from("staff_passport").getPublicUrl(file).data.publicUrl;
  };

  const toggle = (id) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  // Select-all acts on the cards of the active tab
  const tabList = tab === "staff" ? staffList : students;
  const allChecked = tabList.length > 0 && tabList.every((s) => selected[s.id]);
  const toggleAll = () => {
    if (allChecked) setSelected({});
    else setSelected(Object.fromEntries(tabList.map((s) => [s.id, true])));
  };

  const CardFront = ({ s, innerRef }) => (
    <div style={styles.card} ref={innerRef}>
      <div style={styles.frontHeader}>
        <img src="/logo.jpg" alt="logo" crossOrigin="anonymous" style={{ height: "7.5mm", borderRadius: "50%", objectFit: "cover", background: "#fff" }} />
        <div style={{ fontSize: "2.6mm", fontWeight: "bold", marginTop: "0.5mm", lineHeight: 1.2 }}>{SCHOOL_NAME}</div>
        <div style={{ fontSize: "2mm", marginTop: "0.4mm" }}>STUDENT ID CARD</div>
      </div>
      <div style={styles.body}>
        <img
          src={passportUrl(s.passport)}
          alt={s.name}
          crossOrigin="anonymous"
          style={{ width: "22mm", height: "24mm", objectFit: "cover", borderRadius: "1.5mm", border: "0.4mm solid #011b97" }}
        />
        <AutoFitName text={s.name} />
        <div style={{ fontSize: "2.4mm" }}>Gender: {s.sex || "—"}</div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "1.5mm", width: "100%", justifyContent: "center" }}>
          {qrMap[String(s.id)] ? (
            <img src={qrMap[String(s.id)]} alt="QR" style={{ width: "24mm", height: "24mm" }} />
          ) : (
            <div style={{ width: "24mm", height: "24mm", border: "1px dashed #999" }} />
          )}
        </div>
      </div>
    </div>
  );

  const CardBack = ({ s, innerRef }) => (
    <div style={styles.card} ref={innerRef}>
      <div style={{ padding: "3mm", fontSize: "2.2mm", lineHeight: 1.5 }}>
        <div style={{ fontWeight: "bold", fontSize: "2.6mm", marginBottom: "1.5mm" }}>{SCHOOL_NAME}</div>
        {schoolSettings.contact.address && <div>{schoolSettings.contact.address}</div>}
        {schoolSettings.contact.phone && <div>Tel: {schoolSettings.contact.phone}</div>}
        {schoolSettings.contact.email && <div>Email: {schoolSettings.contact.email}</div>}
        <div style={{ marginTop: "2mm", fontStyle: "italic", fontSize: "2mm" }}>
          If found, please return to the school office.
        </div>
      </div>
      <div style={styles.backFooter}>
        <img src="/logo.png" alt="logo" crossOrigin="anonymous" style={{ height: "5mm", background: "#fff", borderRadius: "50%", padding: "0.4mm", objectFit: "cover" }} />
        <div style={{ fontSize: "1.8mm", lineHeight: 1.35 }}>
          <div>Developed by Rhema Expert Solutions</div>
          <div>{DEV_SUPPORT_EMAIL}</div>
        </div>
      </div>
    </div>
  );

  // Staff cards mirror the student layout: designation/department replace the
  // class row, and the QR carries only { sid, name } — no class information.
  const StaffFront = ({ s, innerRef }) => (
    <div style={styles.card} ref={innerRef}>
      <div style={styles.frontHeader}>
        <img src="/logo.jpg" alt="logo" crossOrigin="anonymous" style={{ height: "7.5mm", borderRadius: "50%", objectFit: "cover", background: "#fff" }} />
        <div style={{ fontSize: "2.6mm", fontWeight: "bold", marginTop: "0.5mm", lineHeight: 1.2 }}>{SCHOOL_NAME}</div>
        <div style={{ fontSize: "2mm", marginTop: "0.4mm" }}>STAFF ID CARD</div>
      </div>
      <div style={styles.body}>
        <img
          src={staffPicUrl(s.profile_pic)}
          alt={s.name}
          crossOrigin="anonymous"
          style={{ width: "22mm", height: "24mm", objectFit: "cover", objectPosition: "center -8mm", borderRadius: "1.5mm", border: "0.4mm solid #011b97", background: "#fff" }}
        />
        <AutoFitName text={s.name} />
        <div style={{ fontSize: "2.2mm", textAlign: "center" }}>{s.designation || "Staff"}</div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "1.5mm", width: "100%", justifyContent: "center" }}>
          {staffQrMap[String(s.id)] ? (
            <img src={staffQrMap[String(s.id)]} alt="QR" style={{ width: "24mm", height: "24mm" }} />
          ) : (
            <div style={{ width: "24mm", height: "24mm", border: "1px dashed #999" }} />
          )}
        </div>
      </div>
    </div>
  );

  const StaffBack = ({ s, innerRef }) => (
    <div style={styles.card} ref={innerRef}>
      <div style={{ padding: "3mm", fontSize: "2.2mm", lineHeight: 1.5 }}>
        <div style={{ fontWeight: "bold", fontSize: "2.6mm", marginBottom: "1.5mm" }}>{SCHOOL_NAME}</div>
        {schoolSettings.contact.address && <div>{schoolSettings.contact.address}</div>}
        {schoolSettings.contact.phone && <div>Tel: {schoolSettings.contact.phone}</div>}
        {schoolSettings.contact.email && <div>Email: {schoolSettings.contact.email}</div>}
        <div style={{ marginTop: "2mm", fontStyle: "italic", fontSize: "2mm" }}>
          If found, please return to the school office.
        </div>
      </div>
      <div style={styles.backFooter}>
        <img src="/logo.png" alt="logo" crossOrigin="anonymous" style={{ height: "5mm", background: "#fff", borderRadius: "50%", padding: "0.4mm", objectFit: "cover" }} />
        <div style={{ fontSize: "1.8mm", lineHeight: 1.35 }}>
          <div>Developed by Rhema Expert Solutions</div>
          <div>{DEV_SUPPORT_EMAIL}</div>
        </div>
      </div>
    </div>
  );

  // Build a single PDF (one page per card side) for the given students/staff
  const downloadPdf = async (list, label, kind = "student") => {
    if (list.length === 0) {
      toast.warn("No cards selected");
      return;
    }
    setBusyPdf(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const doc = new jsPDF({ unit: "mm", format: [54, 85.6], orientation: "portrait" });
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const nodes = exportRefs.current[String(s.id)];
        if (!nodes || !nodes.front || !nodes.back) continue;
        if (i > 0) doc.addPage([54, 85.6], "portrait");
        for (const [sideIdx, node] of [nodes.front, nodes.back].entries()) {
          const canvas = await html2canvas(node, { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
          const img = canvas.toDataURL("image/png");
          if (sideIdx === 1) doc.addPage([54, 85.6], "portrait");
          doc.addImage(img, "PNG", 0, 0, 54, 85.6);
        }
      }
      // Single card → name the file after the person; batches keep a generic name
      const fname = list.length === 1 ? `IDCard-${label}.pdf` : `${kind === "staff" ? "staff" : "id"}-cards-${label}.pdf`;
      doc.save(fname);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("PDF generation failed: " + e.message);
    } finally {
      setBusyPdf(false);
    }
  };

  const selectedList = tabList.filter((s) => selected[s.id]);

  // Client-side name search over the loaded pages (load-more pagination unchanged)
  const visibleStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return q ? students.filter((s) => (s.name || "").toLowerCase().includes(q)) : students;
  }, [students, searchTerm]);

  const visibleStaff = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.staff_no || "").toLowerCase().includes(q) ||
        (s.designation || "").toLowerCase().includes(q)
    );
  }, [staffList, searchTerm]);

  // Display pager: slices the active tab's (already searched) list into
  // GRID_SIZE-card pages; students keep chunk-fetching behind the scenes.
  const visibleForPager = tab === "staff" ? visibleStaff : visibleStudents;
  const gPageCount = Math.max(1, Math.ceil(visibleForPager.length / GRID_SIZE));
  const gPage = Math.min(gridPage, gPageCount - 1);
  const pagedList = visibleForPager.slice(gPage * GRID_SIZE, gPage * GRID_SIZE + GRID_SIZE);
  const loadNextChunk = () => { if (hasMore && !loadingMore) loadPage(page + 1); };
  const goGridPage = (p) => {
    setGridPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const pagerProps = {
    page: gPage,
    pageCount: gPageCount,
    hasMore: tab === "students" ? hasMore : false,
    loading: tab === "students" ? loadingMore : false,
    onChange: goGridPage,
    onLoadMore: loadNextChunk,
  };

  if (!ready) return <div className="p-5 text-center"><Spinner animation="border" /></div>;
  if (!allowed) {
    return (
      <div className="p-5 text-center">
        <h4>Access denied</h4>
        <p className="text-muted">This page is reserved for administrators and the developer account.</p>
      </div>
    );
  }

  // Which card set the grid/toolbar/preview operate on
  const FrontComp = tab === "staff" ? StaffFront : CardFront;
  const BackComp = tab === "staff" ? StaffBack : CardBack;

  return (
    <Container className="py-4" style={{ maxWidth: 1100 }}>
      <ToastContainer />
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h3 className="mb-0">{tab === "staff" ? "Staff ID Cards" : "Student ID Cards"}</h3>
          <span className="text-muted">
            {tab === "staff"
              ? `${staffList.length} staff`
              : `${students.length} students${hasMore ? " (more available)" : ""}`}
          </span>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <Form.Control
            type="text"
            size="sm"
            placeholder={tab === "staff" ? "Search staff by name / staff no..." : "Search student by name..."}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setGridPage(0); }}
            style={{ width: 220 }}
          />
          <Button variant="outline-primary" size="sm" onClick={toggleAll}>
            {allChecked ? "Deselect All" : "Select All"}
          </Button>
          <Button variant="success" size="sm" disabled={busyPdf || selectedList.length === 0} onClick={() => downloadPdf(selectedList, "selected", tab)}>
            {busyPdf ? <Spinner size="sm" animation="border" /> : `Download Selected (${selectedList.length})`}
          </Button>
          <Button variant="primary" size="sm" disabled={busyPdf || tabList.length === 0} onClick={() => downloadPdf(tabList, "all", tab)}>
            Download All ({tabList.length})
          </Button>
        </div>
      </div>

      {/* Students / Staff tabs */}
      <Nav variant="tabs" activeKey={tab} onSelect={(k) => { setTab(k); setGridPage(0); }} className="mb-3">
        <Nav.Item>
          <Nav.Link eventKey="students">Students ({students.length})</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="staff">Staff ({staffList.length})</Nav.Link>
        </Nav.Item>
      </Nav>

      {/* Pagination — top */}
      <Pager {...pagerProps} />

      <Row xs={2} md={3} lg={4} className="g-3">
        {pagedList.map((s) => (
          <Col key={s.id}>
            <Card
              className="text-center"
              style={
                selected[s.id]
                  ? { borderColor: "#198754", boxShadow: "0 0 0 2px rgba(25, 135, 84, 0.25)" }
                  : undefined
              }
            >
              <Card.Body style={{ padding: 10 }}>
                <div
                  style={{ position: "relative", cursor: "pointer" }}
                  onClick={() => setPreview(s)}
                >
                  {/* Crop to the scaled visual size (transform doesn't shrink the layout box,
                      which left a tall empty area under each card pair):
                      (54+54+3)mm × 0.55 ≈ 61.1mm wide, 85.6mm × 0.55 ≈ 47.1mm tall */}
                  <div style={{ width: "61.1mm", height: "47.1mm", overflow: "hidden", margin: "0 auto", pointerEvents: "none" }}>
                    <div style={{ transform: "scale(0.55)", transformOrigin: "top left" }}>
                      <div style={{ display: "flex", gap: "3mm" }}>
                        <FrontComp s={s} />
                        <BackComp s={s} />
                      </div>
                    </div>
                  </div>
                  {/* Select pill overlaid on the card itself (top-left corner) */}
                  <Form.Check
                    type="checkbox"
                    className={"idcard-select-check" + (selected[s.id] ? " checked" : "")}
                    checked={!!selected[s.id]}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggle(s.id)}
                    label="Select"
                  />
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* next student chunk is fetching but not on screen yet */}
      {pagedList.length === 0 && loadingMore && (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      )}

      {/* Pagination — bottom */}
      <Pager {...pagerProps} />

      {visibleForPager.length === 0 && (
        <div className="text-center text-muted py-5">
          No loaded {tab === "staff" ? "staff" : "student"} matches “{searchTerm}”.
          {tab === "students" && " Keep typing or use the pager to load more."}
        </div>
      )}

      {/* Preview: natural card size (fits the modal, nothing clipped) + close button */}
      <Modal show={!!preview} onHide={() => setPreview(null)} size="xl" centered>
        {preview && (() => {
          const pIsStaff = !!staffList.find((x) => String(x.id) === String(preview.id));
          const PF = pIsStaff ? StaffFront : CardFront;
          const PB = pIsStaff ? StaffBack : CardBack;
          return (
          <>
            <Modal.Header closeButton>
              <Modal.Title style={{ fontSize: 18 }}>
                {pIsStaff ? "Staff" : "Student"} ID Card Preview — {preview.name}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body
              className="d-flex justify-content-center align-items-start flex-wrap gap-4"
              style={{ background: "#f0f2f5", overflowX: "auto" }}
            >
              <PF s={preview} />
              <PB s={preview} />
            </Modal.Body>
            <Modal.Footer className="justify-content-between">
              <span className="text-muted small">Front and back · actual print size</span>
              <Button variant="success" size="sm" disabled={busyPdf} onClick={() => downloadPdf([preview], fileSafe(preview.name), pIsStaff ? "staff" : "student")}>
                {busyPdf ? <Spinner size="sm" animation="border" /> : `Download PDF — ${preview.name}`}
              </Button>
            </Modal.Footer>
          </>
          );
        })()}
      </Modal>

      {/* Hidden full-size nodes used by html2canvas (never scaled by CSS transforms) */}
      <div style={{ position: "fixed", left: -9999, top: 0 }} aria-hidden="true">
        {students.map((s) => (
          <div key={s.id}>
            <CardFront s={s} innerRef={(el) => { exportRefs.current[String(s.id)] = { ...(exportRefs.current[String(s.id)] || {}), front: el }; }} />
            <CardBack s={s} innerRef={(el) => { exportRefs.current[String(s.id)] = { ...(exportRefs.current[String(s.id)] || {}), back: el }; }} />
          </div>
        ))}
        {staffList.map((s) => (
          <div key={`staff-${s.id}`}>
            <StaffFront s={s} innerRef={(el) => { exportRefs.current[String(s.id)] = { ...(exportRefs.current[String(s.id)] || {}), front: el }; }} />
            <StaffBack s={s} innerRef={(el) => { exportRefs.current[String(s.id)] = { ...(exportRefs.current[String(s.id)] || {}), back: el }; }} />
          </div>
        ))}
      </div>
    </Container>
  );
};

export default IdCards;
