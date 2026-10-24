"use client";

import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Container, Row, Col, Card, Button, Form, Spinner, Modal, Nav } from "react-bootstrap";
import { fetchAuthRoles, isDev, isAdmin } from "../utils/authUtils";
import {
  computeBox,
  detectFrame,
  isFrameFresh,
  loadFrameJson,
  peekIntrinsic,
  readIntrinsic,
  DEFAULT_FRAME,
  PLACEHOLDER_URL,
} from "../utils/passportFraming";

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

// Border colour of the circular passport window (per-build theme).
const FRAME_BORDER = "#011b97";

// The circular passport window on a card face.
//
// The crop is derived from the photo's own intrinsic size plus a per-photo face
// anchor, rather than one shared background-size/background-position: a
// percentage background-size scales by width only, so photos with different
// aspect ratios end up with different (sometimes zero) vertical overflow, and a
// global vertical position silently does nothing for those. Here the drawn box
// is always >= the window, so the anchor always has something to pan.
//
// Everything is in mm with no CSS transform, so the grid thumbnail, the
// full-size card and the html2canvas PDF export all render the same crop.
function PassportFrame({ url, frame }) {
  const [dims, setDims] = useState(() => peekIntrinsic(url));

  useEffect(() => {
    if (!url || url === PLACEHOLDER_URL || dims) return undefined;
    let alive = true;
    readIntrinsic(url).then((d) => {
      if (alive && d) setDims(d);
    });
    return () => {
      alive = false;
    };
  }, [url, dims]);

  const shell = {
    position: "relative",
    width: "22mm",
    height: "24mm",
    backgroundColor: "#fff",
    overflow: "hidden",
    borderRadius: "50%",
    border: `0.4mm solid ${FRAME_BORDER}`,
  };

  // No photo on the record: show the school logo, unscaled as before.
  if (!url || url === PLACEHOLDER_URL) {
    return <div style={{ ...shell, backgroundImage: `url("${PLACEHOLDER_URL}")`, backgroundSize: "cover", backgroundPosition: "center" }} />;
  }

  // First paint before the size is known: plain cover keeps the photo visible,
  // then the exact box lands as soon as it decodes.
  const box = computeBox(dims ? dims.iw : 0, dims ? dims.ih : 0, frame || DEFAULT_FRAME);
  if (!box) {
    return <div style={{ ...shell, backgroundImage: `url("${url}")`, backgroundSize: "cover", backgroundPosition: "center 30%" }} />;
  }

  return (
    <div style={shell}>
      <div
        style={{
          position: "absolute",
          left: `${box.left}mm`,
          top: `${box.top}mm`,
          width: `${box.dw}mm`,
          height: `${box.dh}mm`,
          backgroundImage: `url("${url}")`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      />
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
  // "kind:id" -> computed passport frame, merged over the stored column so a
  // freshly detected card re-frames immediately without a refetch.
  const [frameMap, setFrameMap] = useState({});
  const framingQueued = useRef(new Set()); // "kind:id" currently being analysed
  const [reframing, setReframing] = useState(false);
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
        .select("id, name, staff_no, sex, designation, department, profile_pic, passport_frame")
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
        .select("id, name, class, sex, passport, passport_frame")
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

  // --- per-photo passport framing ---------------------------------------
  // Student and staff ids can collide, so frames are keyed by kind + id.
  const frameKey = (kind, id) => `${kind}:${id}`;
  const srcFieldFor = (kind) => (kind === "staff" ? "profile_pic" : "passport");
  const urlForKind = (kind, raw) => (kind === "staff" ? staffPicUrl(raw) : passportUrl(raw));

  // The frame a card should render with: the live (just-detected) value wins,
  // then a fresh stored value, otherwise null so PassportFrame uses DEFAULT_FRAME.
  const frameFor = (s, kind) => {
    const live = frameMap[frameKey(kind, s.id)];
    if (live) return live;
    const stored = loadFrameJson(s.passport_frame);
    if (stored && isFrameFresh(stored, s[srcFieldFor(kind)])) return stored;
    return null;
  };

  // Analyse rows that have no valid stored frame, three at a time, persisting
  // each result fire-and-forget. force re-runs the whole set (the retry button).
  const frameRows = useCallback(async (rows, kind, force = false) => {
    if (!rows || rows.length === 0) return;
    const table = kind === "staff" ? "bluebell_staff" : "bluebell_student";
    const srcField = srcFieldFor(kind);
    const todo = rows.filter((s) => {
      const raw = s[srcField];
      if (!raw) return false; // placeholder photo, nothing to frame
      const key = frameKey(kind, s.id);
      if (framingQueued.current.has(key)) return false;
      if (!force) {
        const stored = loadFrameJson(s.passport_frame);
        if (stored && isFrameFresh(stored, raw)) return false; // already framed
      }
      return true;
    });
    if (todo.length === 0) return;
    todo.forEach((s) => framingQueued.current.add(frameKey(kind, s.id)));

    let cursor = 0;
    const worker = async () => {
      while (cursor < todo.length) {
        const s = todo[cursor++];
        const key = frameKey(kind, s.id);
        try {
          const { json, frame } = await detectFrame(urlForKind(kind, s[srcField]), s[srcField]);
          setFrameMap((prev) => ({ ...prev, [key]: frame }));
          supabase
            .from(table)
            .update({ passport_frame: json })
            .eq("id", s.id)
            .then(({ error }) => {
              if (error) console.error("passport_frame persist failed:", error.message);
            });
        } catch (e) {
          console.error("passport framing failed:", e);
        } finally {
          framingQueued.current.delete(key);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, todo.length) }, worker));
  }, []);

  // Frame whatever just loaded; a fully framed data set does zero work here.
  useEffect(() => {
    if (students.length) frameRows(students, "student");
  }, [students, frameRows]);
  useEffect(() => {
    if (staffList.length) frameRows(staffList, "staff");
  }, [staffList, frameRows]);

  // Operator escape hatch: drop local frames and re-detect the active tab's set.
  const reFrameActive = async () => {
    const kind = tab === "staff" ? "staff" : "student";
    const list = kind === "staff" ? staffList : students;
    if (list.length === 0) return;
    setFrameMap((prev) => {
      const next = { ...prev };
      list.forEach((s) => delete next[frameKey(kind, s.id)]);
      return next;
    });
    setReframing(true);
    try {
      await frameRows(list, kind, true);
    } finally {
      setReframing(false);
    }
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
        <img src="/logo.png" alt="logo" crossOrigin="anonymous" style={{ height: "9mm", width: "auto", background: "#fff", padding: "0.4mm", borderRadius: "2mm" }} />
        <div style={{ fontSize: "2.6mm", fontWeight: "bold", marginTop: "0.5mm", lineHeight: 1.2 }}>{SCHOOL_NAME}</div>
        <div style={{ fontSize: "2mm", marginTop: "0.4mm" }}>STUDENT ID CARD</div>
      </div>
      <div style={styles.body}>
        <PassportFrame url={passportUrl(s.passport)} frame={frameFor(s, "student")} />
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
        <img src="/rhema.png" alt="Rhema Expert Solutions" crossOrigin="anonymous" style={{ height: "5mm", background: "#fff", borderRadius: "50%", padding: "0.4mm", objectFit: "cover" }} />
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
        <img src="/logo.png" alt="logo" crossOrigin="anonymous" style={{ height: "9mm", width: "auto", background: "#fff", padding: "0.4mm", borderRadius: "2mm" }} />
        <div style={{ fontSize: "2.6mm", fontWeight: "bold", marginTop: "0.5mm", lineHeight: 1.2 }}>{SCHOOL_NAME}</div>
        <div style={{ fontSize: "2mm", marginTop: "0.4mm" }}>STAFF ID CARD</div>
      </div>
      <div style={styles.body}>
        <PassportFrame url={staffPicUrl(s.profile_pic)} frame={frameFor(s, "staff")} />
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
        <img src="/rhema.png" alt="Rhema Expert Solutions" crossOrigin="anonymous" style={{ height: "5mm", background: "#fff", borderRadius: "50%", padding: "0.4mm", objectFit: "cover" }} />
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
          const canvas = await html2canvas(node, { scale: 4, useCORS: true, backgroundColor: "#ffffff" });
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
          <Button variant="outline-secondary" size="sm" disabled={reframing || tabList.length === 0} onClick={reFrameActive}>
            {reframing ? <Spinner size="sm" animation="border" /> : "Re-frame passports"}
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
