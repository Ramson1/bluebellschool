"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { CLASS_OPTIONS, canonClass } from "../utils/classOptions";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  RiCalendarLine,
  RiCalendar2Line,
  RiRefreshLine,
  RiBarChart2Line,
  RiTimeLine,
  RiUserLine,
  RiInboxLine,
  RiErrorWarningLine,
  RiGroupLine,
  RiUser3Line,
  RiFilterLine,
  RiSearchLine,
  RiFilePdfLine,
  RiFileExcelLine,
  RiFileTextLine,
} from 'react-icons/ri';
import '../styles/AdminPages.css';
import { fetchAuthRoles, isAdmin, isDev } from "../utils/authUtils";
import { endOfMonth } from "../utils/dateUtils";

const PAGE_SIZE = 50;

// current month as YYYY-MM for the month filter
const currentMonth = () => new Date().toISOString().slice(0, 7);

const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString() : "—");

const AttendanceRecords = () => {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState({ adminEmails: [], teacherEmails: [], devEmails: [] });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  // which format is currently exporting ("pdf" | "csv" | "docx" | "")
  const [exporting, setExporting] = useState("");

  // which population is being viewed: students (bluebell_attendance) or staff (bluebell_staff_attendance)
  const [who, setWho] = useState("student");
  const [classFilter, setClassFilter] = useState("");
  const [classes, setClasses] = useState([]);

  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(0);
  const [month, setMonth] = useState(currentMonth());
  const [day, setDay] = useState("");
  // name filter: nameQ is what's typed, nameSearch is the debounced value used
  // in the query so we don't hit the server on every keystroke
  const [nameQ, setNameQ] = useState("");
  const [nameSearch, setNameSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setNameSearch(nameQ.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [nameQ]);

  const email = user?.user_metadata?.email || user?.email;
  // admin/dev only (teachers must not access the attendance records view)
  const allowed = isAdmin(email, roles.adminEmails) || isDev(email, roles.devEmails);

  const isStudent = who === "student";
  const table = isStudent ? "bluebell_attendance" : "bluebell_staff_attendance";
  const nameCol = isStudent ? "student_name" : "staff_name";

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

  // raw distinct classes — maps the canonical dropdown labels back onto
  // stored case variants ("YEAR 7" vs "Year 7") for the server-side filter
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.from("bluebell_attendance").select("class").not("class", "is", null);
        if (!active) return;
        const uniq = Array.from(new Set((data || []).map((r) => r.class).filter(Boolean))).sort();
        setClasses(uniq);
      } catch (_) {/* best-effort filter list */}
    })();
    return () => { active = false; };
  }, [allowed]);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      let q = supabase
        .from(table)
        .select("*")
        .order("date", { ascending: false })
        .order("check_in_time", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (day) {
        q = q.eq("date", day);
      } else if (month) {
        // real last day of month — "-31" breaks short months (date out of range)
        q = q.gte("date", `${month}-01`).lte("date", endOfMonth(month));
      }
      if (isStudent && classFilter) {
        // stored rows may use any casing of the label; match all of them
        const variants = classes.filter((c) => canonClass(c) === classFilter);
        q = q.in("class", variants.length ? variants : [classFilter]);
      }
      // filter by student/staff name across all pages (case-insensitive partial match)
      if (nameSearch) q = q.ilike(nameCol, `%${nameSearch.replace(/[%,]/g, "")}%`);
      const { data, error } = await q;
      if (error) throw error;
      setRecords(data || []);
    } catch (e) {
      console.error(e);
      toast.error(`Failed to load ${who} attendance: ` + e.message);
    } finally {
      setLoading(false);
    }
  }, [allowed, who, isStudent, table, nameCol, page, month, day, classFilter, nameSearch, classes]);

  useEffect(() => { load(); }, [load]);

  // summary: distinct days present per person on this page
  const summary = React.useMemo(() => {
    const map = {};
    records.forEach((r) => {
      const name = r[nameCol];
      if (!name) return;
      if (!map[name]) map[name] = { meta: isStudent ? r.class : r.role, days: new Set() };
      if (r.date) map[name].days.add(r.date);
    });
    return Object.entries(map).map(([name, v]) => ({
      name,
      meta: v.meta,
      daysPresent: v.days.size,
    }));
  }, [records, nameCol, isStudent]);

  // ---- export ----------------------------------------------------------
  // Exports run against every row matching the current filters, not just the
  // visible page, so re-run the query without the page window.
  const fetchAllMatching = async () => {
    let q = supabase
      .from(table)
      .select("*")
      .order("date", { ascending: false })
      .order("check_in_time", { ascending: false })
      .range(0, 4999);
    if (day) {
      q = q.eq("date", day);
    } else if (month) {
      q = q.gte("date", `${month}-01`).lte("date", endOfMonth(month));
    }
    if (isStudent && classFilter) {
      const variants = classes.filter((c) => canonClass(c) === classFilter);
      q = q.in("class", variants.length ? variants : [classFilter]);
    }
    if (nameSearch) q = q.ilike(nameCol, `%${nameSearch.replace(/[%,]/g, "")}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  };

  const toExportData = (all) => {
    const headers = isStudent
      ? ["Date", "Name", "Class", "Check In", "Check Out", "Method"]
      : ["Date", "Name", "Role", "Check In", "Check Out"];
    const rows = all.map((r) => [
      r.date,
      r[nameCol],
      (isStudent ? r.class : r.role) || "—",
      fmtTime(r.check_in_time),
      r.check_out_time ? fmtTime(r.check_out_time) : "Still in",
      ...(isStudent ? [r.method || "—"] : []),
    ]);
    return { headers, rows };
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const runExport = async (fmt) => {
    setExporting(fmt);
    try {
      const all = await fetchAllMatching();
      if (all.length === 0) {
        toast.warn("No records to export for this filter");
        return;
      }
      const { headers, rows } = toExportData(all);
      const period = day ? `Day ${day}` : month ? `Month ${month}` : "All time";
      const title = `Attendance Records — ${isStudent ? "Students" : "Staff"}`;
      const base = `attendance-${who}-${day || month || "all"}`;

      if (fmt === "csv") {
        const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const text = "\uFEFF" + [headers, ...rows].map((line) => line.map(esc).join(",")).join("\r\n");
        downloadBlob(new Blob([text], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
      } else if (fmt === "pdf") {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ unit: "mm", orientation: "landscape" });
        const widths = isStudent ? [22, 80, 42, 36, 36, 44] : [22, 100, 60, 46, 46];
        const tableW = widths.reduce((a, b) => a + b, 0);
        const startX = 14;
        let y = 16;
        doc.setFontSize(8);
        const clip = (s, w) => {
          const max = Math.floor(w / 1.7);
          const str = String(s ?? "—");
          return str.length > max ? str.slice(0, max - 1) + "…" : str;
        };
        const drawHeader = () => {
          let x = startX;
          doc.setFont("helvetica", "bold");
          headers.forEach((h, i) => { doc.text(String(h), x + 2, y); x += widths[i]; });
          doc.setFont("helvetica", "normal");
          y += 2;
          doc.setDrawColor(150);
          doc.line(startX, y, startX + tableW, y);
          y += 4.5;
        };
        doc.setFont("helvetica", "bold"); doc.setFontSize(13);
        doc.text(title, startX, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        y += 5.5;
        doc.setTextColor(90);
        doc.text(`${period} · Generated ${new Date().toLocaleString()} · ${rows.length} record(s)`, startX, y);
        doc.setTextColor(0);
        y += 7;
        drawHeader();
        rows.forEach((line, ri) => {
          if (y > 196) { doc.addPage("landscape"); y = 16; drawHeader(); }
          if (ri % 2 === 0) { doc.setFillColor(244); doc.rect(startX, y - 3.4, tableW, 5.4, "F"); }
          let x = startX;
          line.forEach((cell, i) => { doc.text(clip(cell, widths[i]), x + 2, y); x += widths[i]; });
          y += 5.4;
        });
        doc.save(`${base}.pdf`);
      } else {
        const {
          Document, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, ShadingType, Packer,
        } = await import("docx");
        const headerCell = (text) => new TableCell({
          shading: { type: ShadingType.CLEAR, fill: "333333" },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF" })] })],
        });
        const bodyCell = (text, center) => new TableCell({
          children: [new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: String(text ?? "—") })] })],
        });
        const docRows = [
          new TableRow({ tableHeader: true, children: headers.map((h) => headerCell(h)) }),
          ...rows.map((line) => new TableRow({ children: line.map((c, i) => bodyCell(c, i !== 1)) })),
        ];
        const wordDoc = new Document({
          sections: [{
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true, size: 28 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: period, size: 22 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Generated ${new Date().toLocaleString()} · ${rows.length} record(s)`, italics: true, size: 18, color: "666666" })] }),
              new Paragraph({ spacing: { after: 120 }, children: [] }),
              new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: docRows }),
            ],
          }],
        });
        downloadBlob(await Packer.toBlob(wordDoc), `${base}.docx`);
      }
      toast.success(`Exported ${rows.length} record(s) to ${fmt.toUpperCase()}`);
    } catch (e) {
      console.error(`${fmt} export failed:`, e);
      toast.error(`${fmt.toUpperCase()} export failed: ` + e.message);
    } finally {
      setExporting("");
    }
  };

  if (!ready) {
    return (
      <>
        <ToastContainer />
        <div className="ap-loading">
          <div className="ap-spinner" />
          <div>Loading attendance records...</div>
        </div>
      </>
    );
  }
  if (!allowed) {
    return (
      <>
        <ToastContainer />
        <div className="ap-denied">
          <RiErrorWarningLine />
          <h2>Access denied</h2>
          <p>Only administrators can view attendance records.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <ToastContainer />
      <div className="ap-page">
        <div className="ap-head">
          <div>
            <h1 className="ap-title">
              <span className="ap-title-ic blue"><RiCalendar2Line /></span>
              Attendance Records
            </h1>
            <p className="ap-sub">Check-in / check-out history and days present — switch between students and staff, or export the filtered records to PDF, CSV or Word.</p>
          </div>
          <div className="ap-pills">
            <span className="ap-pill"><RiInboxLine /> {records.length} record(s)</span>
            <span className="ap-pill blue">
              <RiUserLine /> {summary.length} {isStudent ? "students" : "staff"} on this page
            </span>
          </div>
        </div>

        {/* students / staff segmented control + export buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className={isStudent ? "ap-btn green" : "ap-btn ghost"}
            onClick={() => { setWho("student"); setPage(0); }}
          >
            <RiGroupLine /> Students
          </button>
          <button
            className={!isStudent ? "ap-btn green" : "ap-btn ghost"}
            onClick={() => { setWho("staff"); setPage(0); }}
          >
            <RiUser3Line /> Staff
          </button>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="ap-btn ghost" disabled={!!exporting || loading} onClick={() => runExport("pdf")} title="Export the filtered records to PDF">
              {exporting === "pdf" ? "Exporting…" : <><RiFilePdfLine /> PDF</>}
            </button>
            <button className="ap-btn ghost" disabled={!!exporting || loading} onClick={() => runExport("csv")} title="Export the filtered records to CSV">
              {exporting === "csv" ? "Exporting…" : <><RiFileExcelLine /> CSV</>}
            </button>
            <button className="ap-btn ghost" disabled={!!exporting || loading} onClick={() => runExport("docx")} title="Export the filtered records to Word">
              {exporting === "docx" ? "Exporting…" : <><RiFileTextLine /> DOCX</>}
            </button>
          </span>
        </div>

        <div className="ap-toolbar">
          <div className="ap-field">
            <span className="ap-label"><RiSearchLine /> {isStudent ? "Student" : "Staff"} Name</span>
            <input
              className="ap-input" placeholder="Search by name…"
              value={nameQ}
              onChange={(e) => setNameQ(e.target.value)}
            />
          </div>
          <div className="ap-field">
            <span className="ap-label"><RiCalendarLine /> Specific Day</span>
            <input type="date" className="ap-input" value={day}
              onChange={(e) => { setDay(e.target.value); setPage(0); }} />
          </div>
          <div className="ap-field">
            <span className="ap-label"><RiCalendar2Line /> Month</span>
            <input type="month" className="ap-input" value={month} disabled={!!day}
              onChange={(e) => { setMonth(e.target.value); setPage(0); }} />
          </div>
          {isStudent && (
            <div className="ap-field">
              <span className="ap-label"><RiFilterLine /> Class</span>
              <select className="ap-input" value={classFilter}
                onChange={(e) => { setClassFilter(e.target.value); setPage(0); }}>
                <option value="">All classes</option>
                {CLASS_OPTIONS.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
          )}
          <button className="ap-btn ghost" onClick={() => { setDay(""); setMonth(currentMonth()); setClassFilter(""); setNameQ(""); setNameSearch(""); setPage(0); }}>
            <RiRefreshLine /> Reset
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start', marginBottom: 16 }}>
          <div className="ap-card" style={{ marginBottom: 0 }}>
            <div className="ap-card-head">
              <span className="ic"><RiBarChart2Line /></span>
              Days Present (this page)
            </div>
            <div className="ap-tablewrap">
              <table className="ap-table">
                <thead><tr><th>{isStudent ? "Student" : "Staff"}</th><th>{isStudent ? "Class" : "Role"}</th><th>Days</th></tr></thead>
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.name}><td>{s.name}</td><td>{s.meta || "—"}</td><td><span className="ap-badge ok">{s.daysPresent}</span></td></tr>
                  ))}
                  {summary.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary, #6b7280)', padding: '22px 12px' }}>No records for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="ap-card" style={{ marginBottom: 0 }}>
            <div className="ap-card-head">
              <span className="ic blue"><RiTimeLine /></span>
              Check-in History
            </div>
            <div className="ap-tablewrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    {isStudent ? <th>Class</th> : null}
                    <th>Check-in</th>
                    <th>Check-out</th>
                    {isStudent ? <th>Method</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="ap-num">{r.date}</td>
                      <td>{r[nameCol]}</td>
                      {isStudent ? <td>{r.class || "—"}</td> : null}
                      <td className="ap-num">{fmtTime(r.check_in_time)}</td>
                      <td className="ap-num">
                        {r.check_out_time
                          ? fmtTime(r.check_out_time)
                          : <span className="ap-badge ok">Still in</span>}
                      </td>
                      {isStudent ? <td>{r.method || "—"}</td> : null}
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={isStudent ? 6 : 4} style={{ textAlign: 'center', color: 'var(--text-secondary, #6b7280)', padding: '22px 12px' }}>No records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="ap-btn ghost sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="ap-sub">{loading ? "Loading..." : `Page ${page + 1}`}</span>
          <button className="ap-btn ghost sm" disabled={records.length < PAGE_SIZE || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </>
  );
};

export default AttendanceRecords;
