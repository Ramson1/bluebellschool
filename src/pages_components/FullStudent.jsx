import * as XLSX from "xlsx";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Modal } from "react-bootstrap";
import { sendEmailNotification } from "../api/emailNotificationService";
import { logAction } from "../api/auditLog";
import { DEV_EMAILS } from "../utils/authUtils";
import {
  RiSearchLine,
  RiDownloadLine,
  RiEdit2Line,
  RiDeleteBin6Line,
  RiGraduationCapLine,
  RiInboxLine,
  RiCameraLine,
  RiUploadLine,
  RiSaveLine,
  RiCloseLine,
  RiKey2Line,
  RiLoginBoxLine,
} from "react-icons/ri";
import "../styles/FullStudent.css";
// EMAIL FUNCTIONALITY COMMENTED OUT FOR VERCEL DEPLOYMENT

const PASSPORT_PLACEHOLDER = "placeholder.png";
const passportUrl = "https://BLUEBELL_SUPABASE_REF_PLACEHOLDER.supabase.co/storage/v1/object/public/passport/";

const genderBadge = (sex) => {
  const s = (sex || "").toLowerCase();
  if (s.startsWith("m")) return "male";
  if (s.startsWith("f")) return "female";
  return "neutral";
};

export default function FullStudent() {
  const [user, setUser] = useState();
  const [teacherAuth, setTeacherAuth] = useState([]);
  const [students, setStudents] = useState([]);
  const [editingStudent, setEditingStudent] = useState(null); // student row open in the edit modal
  const [impersonateStudent, setImpersonateStudent] = useState(null); // student pending "Sign in as Student" confirm
  const [updatedData, setUpdatedData] = useState({});
  const [filter, setFilter] = useState("");
  const [enlargedImage, setEnlargedImage] = useState(null); // State for enlarged image view
  const [loading, setLoading] = useState(true); // Add loading state
  const [saving, setSaving] = useState(false);
  const [userauth, setUserAuth] = useState([]); // State for userauth
  const [newPassportFile, setNewPassportFile] = useState(null); // F2: new passport image to upload
  const [passportRemoved, setPassportRemoved] = useState(false); // F2: flag to reset passport to placeholder
  const [devAuth, setDevAuth] = useState([]); // State for devauth
  const [studentResults, setStudentResults] = useState([]); // State for student results tokens
  const [exportingDocx, setExportingDocx] = useState(false); // dev-only token DOCX export busy flag
  // Live camera capture (passport photo) — getUserMedia stream shown in a modal
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // Safely initialize router
    let router;
    let isRouterAvailable = false;
    
    try {
      router = useRouter();
      isRouterAvailable = router && router.push;
    } catch (error) {
      console.warn('NextRouter not available in this context');
    }

  // Consolidate all data fetching into a single useEffect
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Get current user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) {
          setLoading(false);
          return;
        }
        
        setUser(currentUser);
        
        // Fetch all required data in parallel
        const results = await Promise.allSettled([
          supabase.from('jmis_userauth').select('email'),
          supabase.from('jmis_teacherauth').select('email'),
          supabase.from('devauth').select('email'),
          supabase.from('jmis_student').select('*'),
          supabase.from('jmis_result').select('studentId, token, tokenCount')
        ]);
        
        const [userData, teacherData, devData, studentData, resultData] = results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason });

        // Handle user auth data
        if (userData.error) {
          console.error('User Auth Error:', userData.error);
        } else {
          setUserAuth(userData.data || []);
        }

        // Handle dev auth data
        if (devData.error) {
          console.error('Dev Auth Error:', devData.error);
        } else {
          setDevAuth(devData.data || []);
        }
        
        // Handle teacher auth data
        if (teacherData.error) {
          console.error('Teacher Auth Error:', teacherData.error);
        } else {
          setTeacherAuth(teacherData.data || []);
        }
        
        // Handle student data
        if (studentData.error) {
          console.error('Student Data Error:', studentData.error);
          throw studentData.error; // Critical
        } else {
          setStudents(studentData.data || []);
        }

        // Handle result data
        if (resultData.error) {
          console.error('Result Data Error (jmis_result):', resultData.error);
        } else {
          setStudentResults(resultData.data || []);
        }
        
        // Check if user is a teacher and redirect if needed
        const currentTeacherData = teacherData.data || [];
        const isTeacher = currentTeacherData.some(auth => auth.email === currentUser?.user_metadata?.email);
        if (isTeacher) {
          if (isRouterAvailable) {
            router.push('/home');
          } else {
            // Fallback to window.location for cases where router is not available
            window.location.href = '/home';
          }
          return;
        }
      } catch (error) {
        console.error('Error initializing data:', error);
        toast.error("Failed to fetch data. Please check your internet connection.");
      } finally {
        // Only set loading to false after all verification is complete
        setLoading(false);
      }
    };
    
    initializeData();
  }, [router]);

  const isAdminUser = !!(userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email));
  // Dev emails are hard-coded fallbacks (authUtils) so token columns work even if devauth is empty
  const isDevUser = !!(
    DEV_EMAILS.includes((user?.user_metadata?.email || "").toLowerCase()) ||
    DEV_EMAILS.includes((user?.email || "").toLowerCase()) ||
    (devAuth && devAuth.some && (
      devAuth.some(auth => auth.email === user?.user_metadata?.email) ||
      devAuth.some(auth => auth.email === user?.email)
    ))
  );

  // Call a service-role API route with the signed-in admin's bearer token.
  const api = async (url, method, body) => {
    const { data: { session: sess } } = await supabase.auth.getSession();
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sess?.access_token || ""}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  };

  const doImpersonate = async (row) => {
    if (!row) return;
    try {
      const { url } = await api(`/api/student-accounts/${row.id}/impersonate`, "POST");
      const w = window.open(url, "_blank");
      if (!w) toast.error("Pop-up blocked — allow pop-ups for this site and try again.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setImpersonateStudent(null);
    }
  };

  const handleEditClick = (student) => {
    setEditingStudent(student);
    setNewPassportFile(null);
    setPassportRemoved(false);
    const studentResult = studentResults.find(r => String(r.studentId) === String(student.id)) || {};
    setUpdatedData({ 
      id: student.id, 
      name: student.name, 
      class: student.class, 
      sex: student.sex, 
      parentcontact: student.parentcontact,
      token: student.token || studentResult.token || "",
      // tokenCount now lives on jmis_student (single source of truth). Fall
      // back to the legacy jmis_result value only if the DB column is missing.
      tokenCount: student.tokenCount ?? studentResult.tokenCount ?? 0
    });
  };

  const closeEditor = () => {
    setEditingStudent(null);
    setNewPassportFile(null);
    setPassportRemoved(false);
    closeCamera();
  };

  // ---- live camera capture (real device camera, not a file picker) ----
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const closeCamera = () => {
    setCameraOpen(false);
    stopCamera();
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Camera not available in this browser — use Upload instead");
      return;
    }
    try {
      // prefers the rear camera on phones, falls back to any available camera
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch (err) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      console.error("Camera start error:", err);
      toast.error("Camera unavailable or permission denied — use Upload instead");
    }
  };

  // attach the stream to the <video> once the modal is rendered
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => { /* autoplay blocked — srcObject still shows */ });
    }
  }, [cameraOpen]);

  // never leave the camera lamp on after leaving the page
  useEffect(() => stopCamera, []);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("Camera is not ready yet — hold on a second");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Could not capture photo");
          return;
        }
        const file = new File([blob], `passport-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        setNewPassportFile(file);
        setPassportRemoved(false);
        toast.success("Photo captured — save to upload");
        closeCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  // F2: upload a new passport image to the 'passport' bucket, returns filename
  const uploadNewPassport = async (file, studentId) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${studentId}.${fileExt}`;
    const { error } = await supabase.storage.from('passport').upload(fileName, file);
    if (error) throw error;
    return fileName; // store filename only (display prepends passportUrl)
  };

  const handleSaveClick = async () => { 
    setSaving(true);
    try {
      // F2: resolve passport value (new upload > removal to placeholder > unchanged)
      let passportValue;
      if (newPassportFile) {
        passportValue = await uploadNewPassport(newPassportFile, updatedData.id);
      } else if (passportRemoved) {
        passportValue = PASSPORT_PLACEHOLDER;
      }

      // Update jmis_student (token + per-student token budget)
      const { error: studentError } = await supabase
        .from('jmis_student')
        .update({ 
          name: updatedData.name, 
          class: updatedData.class, 
          sex: updatedData.sex, 
          parentcontact: updatedData.parentcontact,
          token: updatedData.token,
          tokenCount: updatedData.tokenCount,
          ...(passportValue !== undefined && { passport: passportValue })
        })
        .eq('id', updatedData.id);

      if (studentError) throw studentError;

      // Keep the access token in sync on any existing result row.
      // tokenCount is intentionally NOT written here anymore: it lives on
      // jmis_student, and the old per-result update was a silent 0-row no-op
      // for students without a result row (which left the counter stuck at 0).
      const { error: resultError } = await supabase
        .from('jmis_result')
        .update({ 
          token: updatedData.token
        })
        .eq('studentId', updatedData.id);

      if (resultError) throw resultError;

      // Send email notification for student info update
      try {
        const currentUserEmail = user?.user_metadata?.email || 'Unknown User';
        
        const subject = 'Student Information Updated';
        const message = `Student information has been updated by ${currentUserEmail}:

Student Name: ${updatedData.name}
Class: ${updatedData.class}
Gender: ${updatedData.sex}
Parent Contact: ${updatedData.parentcontact}
Token: ${updatedData.token || 'N/A'}
Token Count: ${updatedData.tokenCount || 0}`;

        await sendEmailNotification(supabase, subject, message);
      } catch (error) {
        console.error('Error sending email notification:', error);
      }

      closeEditor();

      // Audit: student edited (+ optional passport change)
      logAction(supabase, {
        email: user?.user_metadata?.email,
        role: 'admin',
        action: 'student_edit',
        targetTable: 'jmis_student',
        recordId: updatedData.id,
        details: {
          name: updatedData.name,
          class: updatedData.class,
          passportUpdated: !!newPassportFile,
          passportRemoved: !!passportRemoved,
        },
      });

      // Re-fetch data to get updated values
      const [newStudentData, newResultData] = await Promise.all([
        supabase.from('jmis_student').select('*'),
        supabase.from('jmis_result').select('studentId, token, tokenCount')
      ]);
      
      setStudents(newStudentData.data || []);
      setStudentResults(newResultData.data || []);
      toast.success('Student info updated successfully');
    } catch (error) {
      console.error('Error saving student info:', error);
      toast.error('Failed to update student info');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async (id) => {
    // Confirm before removing a student and their results
    const { data: studentData, error: fetchError } = await supabase
      .from('jmis_student')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching student data:', fetchError);
      toast.error('Error fetching student data');
      return;
    }

    if (!window.confirm(`Remove ${studentData.name} (${studentData.class}) from the active student list? Their current results are archived first, so they stay viewable in Result Archive even after the student is removed.`)) {
      return;
    }

    // Archive the student's current results into jmis_result_history BEFORE deleting,
    // so the admin can always access every child's past results even after removal.
    const { data: liveResults, error: liveReadErr } = await supabase
      .from('jmis_result')
      .select('*')
      .eq('studentId', id);

    if (liveReadErr) {
      console.error('Error reading student results:', liveReadErr);
      toast.error('Could not read student results — nothing was deleted');
      return;
    }

    if (liveResults && liveResults.length > 0) {
      // Tag the archive with the current session for provenance.
      const { data: st } = await supabase.from('jmis_settings').select('session').limit(1);
      const sessionLabel = (st && st[0] && st[0].session) || 'unassigned';
      const archiveRows = liveResults.map(({ id: _drop, ...rest }) => ({
        ...rest,
        archived_session: `${sessionLabel} (student departed)`,
      }));
      const { error: insErr } = await supabase.from('jmis_result_history').insert(archiveRows);
      if (insErr) {
        console.error('Error archiving student results:', insErr);
        toast.error('Could not archive results — nothing was deleted');
        return;
      }
    }

    // Delete associated live results only after a verified archive copy
    const { error: resultError } = await supabase
      .from('jmis_result')
      .delete()
      .eq('studentId', id);

    if (resultError) {
      console.error('Error deleting student results:', resultError);
      toast.error('Error deleting student results');
      return;
    }

    // Then delete the student
    const { error: studentError } = await supabase
      .from('jmis_student')
      .delete()
      .eq('id', id);

    if (studentError) {
      console.error(studentError);
      toast.error('Error deleting student');
    } else {
      // Send email notification
      try {
        // Get current user's email for audit trail
        const currentUserEmail = user?.user_metadata?.email || 'Unknown User';
        
        const subject = 'Student Deleted';
        const message = `A student has been deleted by ${currentUserEmail}:

Student Name: ${studentData.name}
Student Class: ${studentData.class}`;
        
        // Send email using our new Gmail service
        await sendEmailNotification(supabase, subject, message);
      } catch (error) {
        console.error('Error sending email notification:', error);
      }

      // Re-fetch students to get updated data
      const { data } = await supabase.from('jmis_student').select('*');
      setStudents(data);
      toast.success(`${studentData.name} removed — their results were archived and remain viewable in Result Archive`);

      logAction(supabase, {
        email: user?.user_metadata?.email,
        role: 'admin',
        action: 'student_delete',
        targetTable: 'jmis_student',
        recordId: id,
        details: { name: studentData.name, class: studentData.class, resultsArchived: (liveResults || []).length },
      });
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(students); // Convert students data to a worksheet
    const wb = XLSX.utils.book_new(); // Create a new workbook
    XLSX.utils.book_append_sheet(wb, ws, "Students"); // Append the worksheet to the workbook
    XLSX.writeFile(wb, "students_data.xlsx"); // Export the workbook as an Excel file
  };

  // Developer-only: export every student's Name, Class and access Token as a
  // Word (.docx) table — used to hand the token list to the school office.
  const exportTokensDocx = async () => {
    if (students.length === 0) { toast.warn("No students to export"); return; }
    setExportingDocx(true);
    try {
      const {
        Document, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, ShadingType, Packer,
      } = await import("docx");

      const headerCell = (text) => new TableCell({
        shading: { type: ShadingType.CLEAR, fill: "1e5128" },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF" })] })],
      });
      const bodyCell = (text, opts = {}) => new TableCell({
        children: [new Paragraph({ alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: text || "—", bold: !!opts.bold })] })],
      });

      const tokenFor = (s) => {
        const r = studentResults.find((x) => String(x.studentId) === String(s.id));
        return s.token || r?.token || "";
      };

      const rows = [
        new TableRow({ tableHeader: true, children: [headerCell("#"), headerCell("Name"), headerCell("Class"), headerCell("Token")] }),
        ...students
          .slice()
          .sort((a, b) => (a.class || "").localeCompare(b.class || "") || (a.name || "").localeCompare(b.name || ""))
          .map((s, i) => new TableRow({
            children: [
              bodyCell(String(i + 1), { center: true }),
              bodyCell(s.name),
              bodyCell(s.class, { center: true }),
              bodyCell(tokenFor(s), { center: true, bold: true }),
            ],
          })),
      ];

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Bluebell International School", bold: true, size: 28 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Student Access Tokens — Name, Class & Token", size: 22 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Generated ${new Date().toLocaleDateString()} · ${students.length} students`, italics: true, size: 18, color: "666666" })] }),
            new Paragraph({ spacing: { after: 120 }, children: [] }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `student-tokens-${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${students.length} student tokens to DOCX`);
    } catch (e) {
      console.error("DOCX export failed:", e);
      toast.error("DOCX export failed: " + e.message);
    } finally {
      setExportingDocx(false);
    }
  };

  const filtered = students.filter(student =>
    (student.name || "").toLowerCase().includes(filter.toLowerCase()) || // Filter by name
    (student.class || "").toLowerCase().includes(filter.toLowerCase()) // Filter by class
  );

  // Passport src shown in the editor, reflecting pending upload/remove
  const editorPassportSrc =
    passportRemoved ? `${passportUrl}${PASSPORT_PLACEHOLDER}`
      : newPassportFile ? URL.createObjectURL(newPassportFile)
        : `${passportUrl}${editingStudent?.passport || PASSPORT_PLACEHOLDER}`;

  if (loading) {
    return (
      <div className="fs-page" style={{ textAlign: "center", padding: "90px 16px", color: "var(--text-secondary, #888)" }}>
        <div className="spinner-border" role="status" style={{ width: "3rem", height: "3rem" }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <div style={{ marginTop: 14, fontSize: 14 }}>Verifying credentials…</div>
      </div>
    );
  }

  // Same access model as before: admins only (dev emails included via fallback)
  if (!isAdminUser && !isDevUser) {
    return (
      <div className="fs-page" style={{ display: "flex", justifyContent: "center", paddingTop: 70 }}>
        <div style={{
          width: "min(560px, 92vw)",
          padding: 36,
          backgroundColor: "var(--card-bg, #fff)",
          border: "1px solid var(--card-border, #eee)",
          borderRadius: 14,
          boxShadow: "0 4px 16px var(--shadow-color, rgba(0,0,0,.1))",
          textAlign: "center",
        }}>
          <h2 style={{ marginBottom: 12, color: "var(--text-primary, #222)", fontWeight: 800 }}>User not authorised</h2>
          <p style={{ marginBottom: 26, color: "#d64550" }}>
            Please login with proper credentials or check your internet connection.
          </p>
          <button
            onClick={() => { isRouterAvailable ? router.push('/login') : (window.location.href = '/login'); }}
            className="fs-export"
            style={{ margin: "0 auto" }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fs-page">
      <ToastContainer />

      {/* Header */}
      <div className="fs-head">
        <div>
          <h1 className="fs-title">Full Student Records</h1>
          <p className="fs-sub">Browse, edit and export every enrolled student.</p>
        </div>
        <div className="fs-pills">
          <span className="fs-pill"><RiGraduationCapLine /> <span className="k">Total</span> {students.length}</span>
          <span className="fs-pill"><span className="k">Showing</span> {filtered.length}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="fs-toolbar">
        <div className="fs-search">
          <span className="fs-search-ic"><RiSearchLine /></span>
          <input
            type="text"
            placeholder="Search by name or class…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter students"
          />
        </div>
        {isAdminUser ? (
          <button onClick={exportToExcel} className="fs-export">
            <RiDownloadLine /> Export to Excel
          </button>
        ) : (
          <button className="fs-export" disabled>Only For Admins</button>
        )}
        {/* Developer-only: names + classes + tokens as a Word document */}
        {isDevUser && (
          <button onClick={exportTokensDocx} className="fs-export" disabled={exportingDocx}>
            <RiKey2Line /> {exportingDocx ? "Exporting…" : "Export Tokens (DOCX)"}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="fs-card">
        <div className="fs-tablewrap">
          <table className="fs-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Passport</th>
                <th>Name</th>
                <th>Class</th>
                <th>Gender</th>
                <th>Parent Contact</th>
                {isDevUser && (
                  <>
                    <th>Token</th>
                    <th>Token Count</th>
                  </>
                )}
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, index) => {
                const studentResult = studentResults.find(r => String(r.studentId) === String(student.id));
                return (
                  <tr key={student.id}>
                    <td>{index + 1}</td>
                    <td>
                      <img
                        src={`${passportUrl}${student.passport || PASSPORT_PLACEHOLDER}`}
                        alt={`${student.name}'s passport`}
                        className="fs-avatar"
                        onClick={() => setEnlargedImage(`${passportUrl}${student.passport || PASSPORT_PLACEHOLDER}`)}
                      />
                    </td>
                    <td className="fs-name">{student.name}</td>
                    <td>{student.class}</td>
                    <td><span className={`fs-badge ${genderBadge(student.sex)}`}>{student.sex || "—"}</span></td>
                    <td className="fs-muted">{student.parentcontact || "—"}</td>
                    {isDevUser && (
                      <>
                        <td>{student.token || studentResult?.token || "N/A"}</td>
                        <td>{student.tokenCount ?? studentResult?.tokenCount ?? 0}</td>
                      </>
                    )}
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {(isAdminUser || isDevUser) && (
                        <button
                          onClick={() => setImpersonateStudent(student)}
                          disabled={!student.token}
                          title={student.token ? "Open the student portal as this student in a new tab" : "This student has no access token yet"}
                          className="fs-btn sign-in"
                        >
                          <RiLoginBoxLine /> Sign in
                        </button>
                      )}{" "}
                      {isAdminUser ? (
                        <>
                          <button onClick={() => handleEditClick(student)} className="fs-btn edit">
                            <RiEdit2Line /> Edit
                          </button>{" "}
                          <button onClick={() => handleDeleteClick(student.id)} className="fs-btn del">
                            <RiDeleteBin6Line />
                          </button>
                        </>
                      ) : (
                        !isDevUser && <span className="fs-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isDevUser ? 9 : 7}>
                    <div className="fs-empty">
                      <span className="fs-empty-ic"><RiInboxLine /></span>
                      {students.length === 0 ? "No students registered yet." : "No students match your search."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Edit student modal (replaces inline row editing, which let fields
              slide behind the fixed sidebar when the row stretched) ---------- */}
      <Modal
        show={!!editingStudent}
        onHide={closeEditor}
        size="lg"
        centered
        scrollable
        contentClassName="fs-modal-content"
      >
        <Modal.Header className="fs-modal-head" closeButton closeVariant="white">
          <Modal.Title>
            <div className="t">Edit Student</div>
            <div className="s">{editingStudent?.name} · {editingStudent?.class}</div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="fs-modal-body">
          {/* Passport block */}
          <div className="fs-passport">
            <img
              src={editorPassportSrc}
              alt="Student passport"
              style={{ cursor: "pointer" }}
              onClick={() => setEnlargedImage(editorPassportSrc)}
            />
            <div>
              <div className="lbl">Passport Photo</div>
              <div className="hint">
                {newPassportFile ? "New photo selected — save to upload." : passportRemoved ? "Will be reset to the default placeholder." : "Upload a new photo or remove the current one."}
              </div>
              <div className="fs-passport-actions">
                <label className="fs-mini-btn" style={{ marginBottom: 0 }}>
                  <RiUploadLine /> Upload
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => { if (e.target.files?.[0]) { setNewPassportFile(e.target.files[0]); setPassportRemoved(false); } }} />
                </label>
                <button type="button" className="fs-mini-btn" style={{ marginBottom: 0 }} onClick={openCamera}>
                  <RiCameraLine /> Camera
                </button>
                <button type="button" className="fs-mini-btn danger"
                  onClick={() => { setPassportRemoved(true); setNewPassportFile(null); }}>
                  <RiDeleteBin6Line /> Remove
                </button>
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="fs-grid">
            <div className="fs-field">
              <label>Full Name</label>
              <input
                type="text"
                className="form-control"
                value={updatedData.name || ""}
                onChange={(e) => setUpdatedData({ ...updatedData, name: e.target.value })}
              />
            </div>
            <div className="fs-field">
              <label>Class</label>
              <input
                type="text"
                className="form-control"
                value={updatedData.class || ""}
                onChange={(e) => setUpdatedData({ ...updatedData, class: e.target.value })}
              />
            </div>
            <div className="fs-field">
              <label>Gender</label>
              <input
                type="text"
                className="form-control"
                list="fs-sex-options"
                value={updatedData.sex || ""}
                onChange={(e) => setUpdatedData({ ...updatedData, sex: e.target.value })}
              />
              <datalist id="fs-sex-options">
                <option value="Male" />
                <option value="Female" />
              </datalist>
            </div>
            <div className="fs-field">
              <label>Parent Contact</label>
              <input
                type="text"
                className="form-control"
                value={updatedData.parentcontact || ""}
                onChange={(e) => setUpdatedData({ ...updatedData, parentcontact: e.target.value })}
              />
            </div>
          </div>

          {/* Dev-only token fields */}
          {isDevUser && (
            <div className="fs-devbox">
              <div className="cap"><RiKey2Line /> Access Token (developer only)</div>
              <div className="fs-grid">
                <div className="fs-field">
                  <label>Token</label>
                  <input
                    type="text"
                    className="form-control"
                    value={updatedData.token || ""}
                    onChange={(e) => setUpdatedData({ ...updatedData, token: e.target.value })}
                  />
                </div>
                <div className="fs-field">
                  <label>Token Count</label>
                  <input
                    type="number"
                    className="form-control"
                    value={updatedData.tokenCount || 0}
                    onChange={(e) => setUpdatedData({ ...updatedData, tokenCount: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="fs-modal-foot">
          <button className="fs-cancel" onClick={closeEditor}>
            <RiCloseLine className="me-1" /> Cancel
          </button>
          <button className="fs-save" onClick={handleSaveClick} disabled={saving}>
            {saving ? <span className="spinner-border spinner-border-sm" role="status" /> : <RiSaveLine />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </Modal.Footer>
      </Modal>

      {/* ---------- "Sign in as Student" confirmation (non-destructive preview) ---------- */}
      <Modal
        show={!!impersonateStudent}
        onHide={() => setImpersonateStudent(null)}
        centered
        contentClassName="fs-modal-content"
      >
        <Modal.Header className="fs-modal-head" closeButton closeVariant="white">
          <Modal.Title>
            <div className="t">Open student portal as {impersonateStudent?.name}</div>
            <div className="s">{impersonateStudent?.class}</div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="fs-modal-body">
          <p style={{ margin: 0 }}>
            This opens the Student Portal in a new browser tab signed in as{" "}
            <b>{impersonateStudent?.name}</b>. Their results, attendance and profile
            open exactly as the student would see them. It is a live view, so actions
            here (e.g. checking a result) affect the student's real record. Their access
            token is unchanged. Close the tab when done.
          </p>
        </Modal.Body>
        <Modal.Footer className="fs-modal-foot">
          <button className="fs-cancel" onClick={() => setImpersonateStudent(null)}>
            <RiCloseLine className="me-1" /> Cancel
          </button>
          <button className="fs-save" onClick={() => doImpersonate(impersonateStudent)}>
            <RiLoginBoxLine /> Open as student
          </button>
        </Modal.Footer>
      </Modal>

      {/* ---------- Live camera capture (stacks above the edit modal) ---------- */}
      <Modal
        show={cameraOpen}
        onHide={closeCamera}
        centered
        scrollable
        contentClassName="fs-modal-content"
        dialogClassName="fs-camera-modal"
      >
        <Modal.Header className="fs-modal-head" closeButton closeVariant="white">
          <Modal.Title>
            <div className="t">Take Photo</div>
            <div className="s">Position the student in frame, then capture</div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="fs-modal-body text-center">
          <video ref={videoRef} autoPlay playsInline muted className="fs-camera-video" />
          <p className="fs-muted" style={{ marginTop: 10, marginBottom: 0 }}>
            The photo is attached to the form — press Save Changes to upload it.
          </p>
        </Modal.Body>
        <Modal.Footer className="fs-modal-foot">
          <button className="fs-cancel" onClick={closeCamera}>
            <RiCloseLine className="me-1" /> Cancel
          </button>
          <button className="fs-save" onClick={capturePhoto}>
            <RiCameraLine /> Capture Photo
          </button>
        </Modal.Footer>
      </Modal>

      {/* Enlarged passport lightbox (kept above the modal) */}
      {enlargedImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
          onClick={() => setEnlargedImage(null)} // Close when clicking outside
        >
          <div 
            style={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the image
          >
            <img
              src={enlargedImage}
              alt="Enlarged student passport"
              style={{
                maxWidth: '550px',
                maxHeight: '550px',
                objectFit: 'contain',
                borderRadius: '12px',
              }}
            />
            <button
              onClick={() => setEnlargedImage(null)}
              style={{
                position: 'absolute',
                top: '-20px',
                right: '0',
                background: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
