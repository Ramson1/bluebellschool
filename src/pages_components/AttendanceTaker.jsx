"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient.js";
import { CLASS_OPTIONS, canonClass, canonicalizeClasses } from "../utils/classOptions";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Button, Form, Spinner } from "react-bootstrap";
import { fetchAuthRoles, isAdmin, isTeacher, isDev, isSecretary } from "../utils/authUtils";
import { logAction } from "../api/auditLog";
import {
  RiScan2Line,
  RiUserSearchLine,
  RiCalendarCheckLine,
  RiGraduationCapLine,
  RiTeamLine,
  RiUserSettingsLine,
  RiUserReceivedLine,
  RiAddLine,
  RiDeleteBin6Line,
  RiTimeLine,
  RiInboxLine,
  RiArrowLeftRightLine,
  RiLogoutBoxRLine,
  RiLoginBoxLine,
  RiCloseLine,
  RiVolumeUpLine,
  RiVolumeMuteLine,
} from "react-icons/ri";
import "../styles/Attendance.css";

const todayISO = () => new Date().toISOString().slice(0, 10);

// Every ID card (student AND staff) is printed with the compact payload
// {sid,name}; older cards may also carry class. Accept a name with an
// optional class/sid, plus the tolerant pipe form "sid|name[|class]". The
// class is resolved from the roster by sid at scan time when it is absent.
const parseQrPayload = (text) => {
  try {
    const obj = JSON.parse(text);
    if (obj && obj.name) {
      const sid = obj.sid != null ? obj.sid : obj.staffId;
      return { sid, name: String(obj.name), class: obj.class != null ? String(obj.class) : undefined };
    }
  } catch (e) {
    /* not JSON – try pipe format */
  }
  const parts = (text || "").split("|");
  if (parts.length >= 2) {
    return { sid: parts[0], name: parts[1], class: parts.slice(2).join("|") || undefined };
  }
  return null;
};

// Resolve a stored photo to a viewable URL. Students keep a bare filename (or
// legacy full URL) in the public "passport" bucket; staff pics live in
// "staff_passport" with a fallback to "passport" (mirrors StaffAccounts.jsx).
const bucketFileUrl = (bucket, file) => {
  try {
    return supabase.storage.from(bucket).getPublicUrl(file).data.publicUrl || null;
  } catch {
    return null;
  }
};
const studentPicUrl = (p) => {
  const v = String(p ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return bucketFileUrl("passport", v);
};
const staffPicUrl = (p) => {
  const v = String(p ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return bucketFileUrl("staff_passport", v) || bucketFileUrl("passport", v);
};

const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—");

// Section card with an iconed header
const Card = ({ icon, tone, title, right, children, className = "", style }) => (
  <div className={`attnd-card ${className}`} style={style}>
    <div className="attnd-card-head">
      <span className={`attnd-card-ic tone-${tone || "green"}`}>{icon}</span>
      <span className="grow">{title}</span>
      {right}
    </div>
    <div className={title === undefined ? "" : "attnd-card-body"} style={title === undefined ? { padding: 0 } : undefined}>
      {children}
    </div>
  </div>
);

const Stat = ({ icon, tone, value, label }) => (
  <div className="attnd-stat">
    <span className={`attnd-stat-ic tone-${tone}`}>{icon}</span>
    <div>
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  </div>
);

const EmptyRow = ({ cols, children }) => (
  <tr>
    <td colSpan={cols}>
      <div className="attnd-empty">
        <span className="attnd-empty-ic"><RiInboxLine /></span>
        {children}
      </div>
    </td>
  </tr>
);

// Round passport thumbnail; clicking it opens the full-screen viewer.
const PicThumb = ({ src, name, onZoom }) => {
  if (!src) return <span className="attnd-pic-empty" title="No passport on record" />;
  return (
    <img
      src={src}
      alt={name}
      title="Click to view passport photo"
      onClick={() => onZoom(src, name)}
      className="attnd-pic zoomable"
    />
  );
};

// Short, loud two-tone chirp synthesised with WebAudio (no asset to fetch) so
// a successful scan is audible even when the operator isn't looking at screen.
let beepCtx = null;
const playBeep = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    beepCtx = beepCtx || new Ctx();
    if (beepCtx.state === "suspended") beepCtx.resume();
    [[880, 0, 0.12], [1318.5, 0.16, 0.16]].forEach(([f, at, dur]) => {
      const osc = beepCtx.createOscillator();
      const gain = beepCtx.createGain();
      osc.type = "square";
      osc.frequency.value = f;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(beepCtx.destination);
      osc.start(beepCtx.currentTime + at);
      osc.stop(beepCtx.currentTime + at + dur);
    });
  } catch { /* audio unavailable */ }
};

const AttendanceTaker = () => {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState({ adminEmails: [], teacherEmails: [], devEmails: [], secretaryEmails: [] });
  const [ready, setReady] = useState(false);

  const [tab, setTab] = useState("student"); // student | staff
  const [settings, setSettings] = useState({ session: "", term: "" });

  // student check-in state
  const [studentNames, setStudentNames] = useState([]);
  const [manualName, setManualName] = useState("");
  const [manualClass, setManualClass] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [todayList, setTodayList] = useState([]);

  // qr scanner state
  const [qrActive, setQrActive] = useState(false);
  const [qrStarting, setQrStarting] = useState(false);
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ text: "", at: 0 });

  // staff check-in + directory state
  const [staffList, setStaffList] = useState([]); // all staff (active + inactive)
  const [selectedStaff, setSelectedStaff] = useState("");
  const [todayStaff, setTodayStaff] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: "", role: "Staff", email: "", phone: "" });
  const [addingStaff, setAddingStaff] = useState(false);

  // Full-screen passport viewer: clicking a thumbnail in the attendance
  // tables enlarges it over the page with a close button at the top right.
  const [picViewer, setPicViewer] = useState({ open: false, src: "", name: "" });

  // Attendance type chosen by the operator: scans and manual marks only ever
  // perform the selected action, so a check-in can never sign someone out.
  const [direction, setDirection] = useState("in");
  // The live scanner callback is registered once on start, so it reads the
  // current selection through this ref instead of a stale closure value.
  const directionRef = useRef("in");
  directionRef.current = direction;

  // Loud success chirp toggle, remembered in this browser.
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return typeof window === "undefined" ? true : window.localStorage.getItem("attnd_sound") !== "off";
    } catch {
      return true;
    }
  });
  const toggleSound = () => {
    const v = !soundOn;
    setSoundOn(v);
    try {
      window.localStorage.setItem("attnd_sound", v ? "on" : "off");
    } catch { /* private mode etc. */ }
    if (v) playBeep(); // audible proof that sound is back on
  };
  const chime = () => { if (soundOn) playBeep(); };


  const email = user?.user_metadata?.email;
  const canWrite = isAdmin(email, roles.adminEmails) || isTeacher(email, roles.teacherEmails) || isDev(email, roles.devEmails);
  // Secretary: read-only attendance view (requirement 7) — no check-in/record buttons
  const allowed = canWrite || isSecretary(email, roles.secretaryEmails);
  const canSeeStaffTab = (isAdmin(email, roles.adminEmails) || isDev(email, roles.devEmails)) && canWrite;
  const roleLabel = isAdmin(email, roles.adminEmails) ? "admin" : isDev(email, roles.devEmails) ? "developer" : isSecretary(email, roles.secretaryEmails) ? "secretary" : "teacher";

  const refreshStaff = useCallback(async () => {
    // Directory shows every staff member; the check-in dropdown filters to active client-side
    const { data } = await supabase.from("bluebell_staff").select("id, name, role, email, phone, status, profile_pic").order("name");
    setStaffList(data || []);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user: cu } } = await supabase.auth.getUser();
        setUser(cu);
        const r = await fetchAuthRoles(supabase);
        setRoles(r);

        const [{ data: settingsData }, { data: studentsData }] = await Promise.all([
          supabase.from("bluebell_settings").select("session, term").limit(1),
          supabase.from("bluebell_student").select("id, name, class, passport").order("name"),
        ]);
        if (settingsData && settingsData[0]) {
          setSettings({ session: settingsData[0].session || "", term: settingsData[0].term || "" });
        }
        setStudentNames(studentsData || []);
        await refreshStaff();
      } catch (e) {
        console.error("Attendance init error:", e);
        toast.error("Failed to load attendance data");
      } finally {
        setReady(true);
      }
    };
    init();
  }, [refreshStaff]);

  const refreshToday = useCallback(async () => {
    const today = todayISO();
    const [{ data: att }, { data: staffAtt }] = await Promise.all([
      supabase.from("bluebell_attendance").select("*").eq("date", today).order("check_in_time", { ascending: false }),
      supabase.from("bluebell_staff_attendance").select("*").eq("date", today).order("check_in_time", { ascending: false }),
    ]);
    setTodayList(att || []);
    setTodayStaff(staffAtt || []);
  }, []);

  useEffect(() => {
    if (allowed) refreshToday();
  }, [allowed, refreshToday]);

  // Sign a student in OR out depending on the selected attendance type
  // (never both): in → insert / re-open; out → close an open row only.
  const markStudentPresent = async ({ id, name, className }, method, opts = {}) => {
    const today = todayISO();
    const dir = opts.direction || "in";
    const { data: existing } = await supabase
      .from("bluebell_attendance")
      .select("id, check_out_time")
      .eq("student_name", name)
      // class labels are stored with inconsistent casing; ilike without
      // wildcards is a case-insensitive equality match
      .ilike("class", String(className || "").replace(/[%,]/g, ""))
      .eq("date", today)
      .maybeSingle();

    if (existing && !existing.check_out_time) {
      if (dir === "in") {
        toast.info(`${name} is already checked in`);
        return true; // check-in mode never flips an inside student back out
      }
      const { error } = await supabase
        .from("bluebell_attendance")
        .update({ check_out_time: new Date().toISOString(), sign_out_method: method })
        .eq("id", existing.id);
      if (error) throw error;
      toast.info(`${name} signed out (${method})`);
      chime();
      if (opts.audit) {
        logAction(supabase, {
          email, role: roleLabel, action: "attendance_signout", targetTable: "bluebell_attendance",
          recordId: existing.id,
          details: { studentName: name, class: className, date: today, method },
        });
      }
      await refreshToday();
      return true;
    }

    if (existing) {
      if (dir === "out") {
        toast.error(`${name} already signed out — nothing to check out`);
        return false;
      }
      const { error } = await supabase
        .from("bluebell_attendance")
        .update({ check_in_time: new Date().toISOString(), method, check_out_time: null, sign_out_method: null })
        .eq("id", existing.id);
      if (error) throw error;
      toast.success(`${name} signed in again (${method})`);
      chime();
      if (opts.audit) {
        logAction(supabase, {
          email, role: roleLabel, action: "attendance_checkin", targetTable: "bluebell_attendance",
          recordId: existing.id,
          details: { studentName: name, class: className, date: today, method, recheckIn: true },
        });
      }
      await refreshToday();
      return true;
    }

    if (dir === "out") {
      toast.error(`${name} was not checked in today — cannot check out`);
      return false;
    }

    const { data, error } = await supabase
      .from("bluebell_attendance")
      .insert([{
        student_id: id || null,
        student_name: name,
        class: className,
        date: today,
        session: settings.session,
        term: settings.term,
        method,
      }])
      .select();

    if (error) {
      if (error.code === "23505" || /duplicate/i.test(error.message || "")) {
        toast.info(`${name} is already marked present today`);
        return true; // not a failure
      }
      throw error;
    }
    toast.success(`${name} checked in (${method})`);
    chime();
    if (opts.audit) {
      logAction(supabase, {
        email,
        role: roleLabel,
        action: "attendance_manual_checkin",
        targetTable: "bluebell_attendance",
        recordId: data?.[0]?.id,
        details: { studentName: name, class: className, date: today, method },
      });
    }
    await refreshToday();
    return true;
  };

  // Table-row quick action: sign out a student still inside (requirement 11)
  const signOutStudentRow = async (r) => {
    try {
      const { error } = await supabase
        .from("bluebell_attendance")
        .update({ check_out_time: new Date().toISOString(), sign_out_method: "manual" })
        .eq("id", r.id);
      if (error) throw error;
      toast.info(`${r.student_name} signed out`);
      logAction(supabase, {
        email, role: roleLabel, action: "attendance_signout", targetTable: "bluebell_attendance",
        recordId: r.id, details: { studentName: r.student_name, class: r.class, date: r.date, method: "manual" },
      });
      await refreshToday();
    } catch (err) {
      console.error(err);
      toast.error("Sign-out failed: " + err.message);
    }
  };

  // ---- QR scanner ----
  const stopScanner = useCallback(async () => {
    try {
      const scanner = scannerRef.current;
      if (scanner) {
        await scanner.stop();
        scannerRef.current = null;
      }
    } catch (e) {
      scannerRef.current = null; // already stopped / not running
    }
    setQrActive(false);
  }, []);

  const startScanner = async () => {
    setQrStarting(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      setQrActive(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          // debounce duplicate consecutive scans of the same code
          const now = Date.now();
          if (decodedText === lastScanRef.current.text && now - lastScanRef.current.at < 3000) return;
          lastScanRef.current = { text: decodedText, at: now };

          const parsed = parseQrPayload(decodedText);
          if (!parsed) {
            toast.error("Unrecognized QR code");
            return;
          }
          // verify the student exists before recording. The printed card may
          // carry only {sid,name}, so prefer the numeric id and fall back to
          // the name (class is only compared when the card supplies it).
          let match = null;
          if (parsed.sid != null && parsed.sid !== "") {
            const { data: byId } = await supabase
              .from("bluebell_student")
              .select("id, name, class")
              .eq("id", parsed.sid)
              .maybeSingle();
            match = byId;
          }
          if (!match) {
            let byNameQ = supabase
              .from("bluebell_student")
              .select("id, name, class")
              .eq("name", parsed.name);
            if (parsed.class) {
              byNameQ = byNameQ.ilike("class", String(parsed.class).replace(/[%,]/g, ""));
            }
            const { data: byName } = await byNameQ.maybeSingle();
            match = byName;
          }
          if (!match) {
            toast.error(`Student ${parsed.name} not found`);
            return;
          }
          await markStudentPresent(
            { id: match.id, name: match.name, className: match.class },
            "qr",
            { direction: directionRef.current }
          );
        },
        () => { /* per-frame scan failures are normal; ignore */ }
      ).catch(() => {
        toast.error("Unable to start camera. Use manual check-in instead.");
        setQrActive(false);
      });
    } catch (e) {
      console.error("Scanner start error:", e);
      toast.error("Camera unavailable. Use manual check-in instead.");
    } finally {
      setQrStarting(false);
    }
  };

  // stop camera when leaving the tab / unmounting
  useEffect(() => {
    if (tab !== "student" && qrActive) stopScanner();
    return () => { stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ---- handlers ----
  const handleManualCheckIn = async (e) => {
    e.preventDefault();
    if (!manualName || !manualClass) {
      toast.error("Select a class and student name first");
      return;
    }
    setSubmitting(true);
    try {
      const match = studentNames.find((s) => s.name === manualName && canonClass(s.class) === canonClass(manualClass));
      await markStudentPresent(
        { id: match?.id, name: manualName, className: manualClass },
        "manual",
        { audit: true, direction }
      );
      setManualName("");
      setManualClass("");
    } catch (err) {
      console.error(err);
      toast.error("Check-in failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Staff check-in mirrors the student sign-in/sign-out toggle (requirement 11)
  const handleStaffCheckIn = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      toast.error("Select a staff member first");
      return;
    }
    setSubmitting(true);
    try {
      const staff = staffList.find((s) => s.id === selectedStaff);
      const today = todayISO();
      const { data: existing } = await supabase
        .from("bluebell_staff_attendance")
        .select("id, check_out_time")
        .eq("staff_id", staff.id)
        .eq("date", today)
        .maybeSingle();

      if (existing && !existing.check_out_time) {
        if (direction === "in") {
          toast.info(`${staff.name} is already checked in`);
          return; // check-in mode never signs an inside staff member out
        }
        const { error } = await supabase
          .from("bluebell_staff_attendance")
          .update({ check_out_time: new Date().toISOString(), sign_out_method: "manual" })
          .eq("id", existing.id);
        if (error) throw error;
        toast.info(`${staff.name} signed out`);
        chime();
        logAction(supabase, {
          email, role: roleLabel, action: "staff_attendance_signout", targetTable: "bluebell_staff_attendance",
          recordId: existing.id, details: { staffName: staff.name, date: today },
        });
      } else if (existing) {
        if (direction === "out") {
          toast.error(`${staff.name} already signed out — nothing to check out`);
          return;
        }
        const { error } = await supabase
          .from("bluebell_staff_attendance")
          .update({ check_in_time: new Date().toISOString(), check_out_time: null, sign_out_method: null })
          .eq("id", existing.id);
        if (error) throw error;
        toast.success(`${staff.name} signed in again`);
        chime();
        logAction(supabase, {
          email, role: roleLabel, action: "staff_attendance_checkin", targetTable: "bluebell_staff_attendance",
          recordId: existing.id, details: { staffName: staff.name, date: today, recheckIn: true },
        });
      } else {
        if (direction === "out") {
          toast.error(`${staff.name} was not checked in today — cannot check out`);
          return;
        }
        const { data, error } = await supabase
          .from("bluebell_staff_attendance")
          .insert([{ staff_id: staff.id, staff_name: staff.name, role: staff.role || "Staff", date: today }])
          .select();
        if (error && !(error.code === "23505" || /duplicate/i.test(error.message || ""))) throw error;
        if (error) {
          toast.info(`${staff.name} is already marked present today`);
        } else {
          toast.success(`${staff.name} checked in`);
          chime();
          logAction(supabase, {
            email,
            role: roleLabel,
            action: "staff_attendance_checkin",
            targetTable: "bluebell_staff_attendance",
            recordId: data?.[0]?.id,
            details: { staffName: staff.name, date: today },
          });
        }
      }
      setSelectedStaff("");
      await refreshToday();
    } catch (err) {
      console.error(err);
      toast.error("Staff check-in failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const signOutStaffRow = async (r) => {
    try {
      const { error } = await supabase
        .from("bluebell_staff_attendance")
        .update({ check_out_time: new Date().toISOString(), sign_out_method: "manual" })
        .eq("id", r.id);
      if (error) throw error;
      toast.info(`${r.staff_name} signed out`);
      logAction(supabase, {
        email, role: roleLabel, action: "staff_attendance_signout", targetTable: "bluebell_staff_attendance",
        recordId: r.id, details: { staffName: r.staff_name, date: r.date },
      });
      await refreshToday();
    } catch (err) {
      console.error(err);
      toast.error("Sign-out failed: " + err.message);
    }
  };

  // ---- staff directory (bluebell_staff) ----
  const handleAddStaff = async (e) => {
    e.preventDefault();
    const name = staffForm.name.trim();
    if (!name) {
      toast.error("Staff name is required");
      return;
    }
    setAddingStaff(true);
    try {
      const { data, error } = await supabase
        .from("bluebell_staff")
        .insert([{
          name,
          role: staffForm.role.trim() || "Staff",
          email: staffForm.email.trim() || null,
          phone: staffForm.phone.trim() || null,
          status: "active",
        }])
        .select();
      if (error) throw error;
      toast.success(`${name} added to staff directory`);
      logAction(supabase, {
        email,
        role: roleLabel,
        action: "staff_add",
        targetTable: "bluebell_staff",
        recordId: data?.[0]?.id,
        details: { staffName: name, role: staffForm.role },
      });
      setStaffForm({ name: "", role: "Staff", email: "", phone: "" });
      await refreshStaff();
    } catch (err) {
      console.error(err);
      toast.error("Could not add staff: " + err.message);
    } finally {
      setAddingStaff(false);
    }
  };

  const toggleStaffStatus = async (s) => {
    const next = (s.status || "active") === "active" ? "inactive" : "active";
    try {
      const { error } = await supabase.from("bluebell_staff").update({ status: next }).eq("id", s.id);
      if (error) throw error;
      toast.info(`${s.name} marked ${next}`);
      logAction(supabase, {
        email,
        role: roleLabel,
        action: "staff_status_change",
        targetTable: "bluebell_staff",
        recordId: s.id,
        details: { staffName: s.name, status: next },
      });
      await refreshStaff();
    } catch (err) {
      console.error(err);
      toast.error("Status update failed: " + err.message);
    }
  };

  const deleteStaff = async (s) => {
    if (!window.confirm(`Remove ${s.name} from the staff directory? Past attendance records are kept.`)) return;
    try {
      const { error } = await supabase.from("bluebell_staff").delete().eq("id", s.id);
      if (error) throw error;
      toast.success(`${s.name} removed`);
      logAction(supabase, {
        email,
        role: roleLabel,
        action: "staff_delete",
        targetTable: "bluebell_staff",
        recordId: s.id,
        details: { staffName: s.name },
      });
      if (selectedStaff === s.id) setSelectedStaff("");
      await refreshStaff();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed: " + err.message);
    }
  };

  if (!ready) {
    return (
      <div className="p-5 text-center" style={{ color: "var(--text-secondary, #888)" }}>
        <Spinner animation="border" />
        <div style={{ marginTop: 10, fontSize: 14 }}>Loading attendance…</div>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="p-5 text-center">
        <h4 style={{ color: "var(--text-primary, #222)" }}>Access denied</h4>
        <p className="text-muted">Only administrators, teachers and the secretary (read-only) can view attendance.</p>
      </div>
    );
  }

  // full canonical list (Creche → Year 12) plus any legacy labels in the data
  const classesList = canonicalizeClasses([...CLASS_OPTIONS, ...studentNames.map((s) => s.class)]);
  const namesForClass = manualClass ? studentNames.filter((s) => canonClass(s.class) === canonClass(manualClass)) : studentNames;
  const activeStaff = staffList.filter((s) => (s.status || "active") === "active");
  // name|class -> "in" (still inside) | "out" (signed out) for today's rows
  const studentState = {};
  todayList.forEach((r) => { studentState[`${r.student_name}|${canonClass(r.class)}`] = r.check_out_time ? "out" : "in"; });
  const staffState = {};
  todayStaff.forEach((r) => { staffState[r.staff_name] = r.check_out_time ? "out" : "in"; });

  // Passport lookups so attendance rows can show the child's photo. Attendance
  // rows only carry the name/class strings that were recorded, so match back to
  // the roster on the canonicalised pair (exact class first, then by name).
  const studentPicMap = {};
  studentNames.forEach((s) => {
    if (!s.passport) return;
    studentPicMap[`${s.name}|${canonClass(s.class)}`] = studentPicUrl(s.passport);
    if (!studentPicMap[s.name]) studentPicMap[s.name] = studentPicUrl(s.passport);
  });
  const studentRowPic = (r) => studentPicMap[`${r.student_name}|${canonClass(r.class)}`] || studentPicMap[r.student_name] || null;
  const staffPicMap = {};
  staffList.forEach((s) => {
    const url = staffPicUrl(s.profile_pic);
    if (url && !staffPicMap[s.name]) staffPicMap[s.name] = url;
  });

  return (
    <div className="attnd-page">
      <ToastContainer />

      {/* Header: title + session/term/date pills */}
      <div className="attnd-head">
        <div>
          <h1 className="attnd-title">Attendance</h1>
          <p className="attnd-sub">Daily sign-in / sign-out for students and staff — QR or manual. Pick the attendance type below; a scan only performs the selected action.</p>
        </div>
        <div className="attnd-pills">
          <span className="attnd-pill"><span className="k">Session</span>{settings.session || "—"}</span>
          <span className="attnd-pill"><span className="k">Term</span>{settings.term || "—"}</span>
          <span className="attnd-pill"><span className="k">Date</span>{new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>

      {/* Pill tabs */}
      <div className="attnd-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "student"} className={"attnd-tab" + (tab === "student" ? " active" : "")} onClick={() => setTab("student")}>
          <RiGraduationCapLine /> Student Attendance
        </button>
        {canSeeStaffTab && (
          <button type="button" role="tab" aria-selected={tab === "staff"} className={"attnd-tab" + (tab === "staff" ? " active" : "")} onClick={() => setTab("staff")}>
            <RiTeamLine /> Staff Attendance
          </button>
        )}
      </div>

      {/* Attendance type + sound toggle (writers only) */}
      {canWrite && (
        <div className="attnd-dirbar">
          <span className="attnd-dirbar-label">Attendance type</span>
          <button type="button" className={"attnd-dirbtn" + (direction === "in" ? " active in" : "")} onClick={() => setDirection("in")}>
            <RiLoginBoxLine /> Check In to School
          </button>
          <button type="button" className={"attnd-dirbtn" + (direction === "out" ? " active out" : "")} onClick={() => setDirection("out")}>
            <RiLogoutBoxRLine /> Check Out from School
          </button>
          <button
            type="button"
            className="attnd-soundbtn"
            onClick={toggleSound}
            title={soundOn ? "Mute the success sound" : "Unmute the success sound"}
          >
            {soundOn ? <RiVolumeUpLine /> : <RiVolumeMuteLine />} Sound {soundOn ? "on" : "off"}
          </button>
        </div>
      )}

      {tab === "student" && (
        <>
          <div className="attnd-stats">
            <Stat icon={<RiGraduationCapLine />} tone="blue" value={studentNames.length} label="Students enrolled" />
            <Stat icon={<RiCalendarCheckLine />} tone="teal" value={todayList.length} label="Present today" />
            <Stat
              icon={<RiTimeLine />}
              tone="orange"
              value={studentNames.length ? `${Math.round((todayList.length / studentNames.length) * 100)}%` : "—"}
              label="Attendance rate"
            />
          </div>

          {canWrite && (
          <div className="attnd-grid2">
            <Card icon={<RiScan2Line />} tone="blue" title={direction === "out" ? "QR Check-Out" : "QR Check-In"}>
              <div id="qr-reader" style={{ width: "100%", minHeight: qrActive ? 260 : 0 }} />
              {!qrActive ? (
                <Button variant="primary" onClick={startScanner} disabled={qrStarting}>
                  {qrStarting ? <Spinner size="sm" animation="border" /> : <><RiScan2Line className="me-1" /> Start Camera Scanner</>}
                </Button>
              ) : (
                <Button variant="outline-danger" onClick={stopScanner}>Stop Camera</Button>
              )}
              <p className="attnd-hint">
                Scan a student ID card QR code. The scan performs the attendance type selected above and can never flip the other way. The camera requires HTTPS on mobile devices.
              </p>
            </Card>

            <Card icon={<RiUserSearchLine />} tone="purple" title={direction === "out" ? "Manual Check-Out" : "Manual Check-In"}>
              <Form onSubmit={handleManualCheckIn}>
                <Form.Group className="mb-2" controlId="manualClass">
                  <Form.Label>Class</Form.Label>
                  <Form.Select
                    value={manualClass}
                    onChange={(e) => {
                      setManualClass(e.target.value);
                      // keep the name selection only if it still belongs to the new class
                      if (manualName && !studentNames.some((s) => s.name === manualName && (!e.target.value || canonClass(s.class) === canonClass(e.target.value)))) {
                        setManualName("");
                      }
                    }}
                  >
                    <option value="">All classes</option>
                    {classesList.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3" controlId="manualName">
                  <Form.Label>Student Name</Form.Label>
                  <Form.Select value={manualName} onChange={(e) => setManualName(e.target.value)}>
                    <option value="">Select student…</option>
                    {namesForClass.map((s) => {
                      const st = studentState[`${s.name}|${s.class}`];
                      return (
                        <option key={s.id} value={s.name}>
                          {s.name}{st === "in" ? " — in school" : st === "out" ? " (signed out earlier)" : ""}
                        </option>
                      );
                    })}
                  </Form.Select>
                </Form.Group>
                <Button type="submit" variant={direction === "out" ? "warning" : "success"} disabled={submitting}>
                  {submitting ? <Spinner size="sm" animation="border" /> : direction === "out"
                    ? <><RiLogoutBoxRLine className="me-1" /> Check Out</>
                    : <><RiUserReceivedLine className="me-1" /> Check In</>}
                </Button>
              </Form>
            </Card>
          </div>
          )}

          <Card
            icon={<RiCalendarCheckLine />}
            tone="teal"
            title={`Present Today (${todayList.length})`}
          >
            <div className="attnd-tablewrap">
              <table className="attnd-table">
                <thead>
                  <tr><th>#</th><th>Photo</th><th>Name</th><th>Class</th><th>Time In</th><th>Method</th><th>Check-out</th>{canWrite && <th></th>}</tr>
                </thead>
                <tbody>
                  {todayList.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td><PicThumb src={studentRowPic(r)} name={r.student_name} onZoom={(src, name) => setPicViewer({ open: true, src, name })} /></td>
                      <td className="attnd-strong">{r.student_name}</td>
                      <td>{r.class}</td>
                      <td>{fmtTime(r.check_in_time)}</td>
                      <td><span className={"attnd-badge " + (r.method === "qr" ? "qr" : "manual")}>{r.method || "manual"}</span></td>
                      <td>
                        {r.check_out_time
                          ? <span>{fmtTime(r.check_out_time)} <span className="attnd-badge out">out</span></span>
                          : <span className="attnd-badge in">Still in</span>}
                      </td>
                      {canWrite && (
                        <td style={{ textAlign: "right" }}>
                          {!r.check_out_time && (
                            <button type="button" className="attnd-iconbtn" title="Sign out" onClick={() => signOutStudentRow(r)}>
                              <RiLogoutBoxRLine />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {todayList.length === 0 && (
                    <EmptyRow cols={canWrite ? 8 : 7}>No check-ins yet today.</EmptyRow>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === "staff" && canSeeStaffTab && (
        <>
          <div className="attnd-stats">
            <Stat icon={<RiTeamLine />} tone="blue" value={activeStaff.length} label="Active staff" />
            <Stat icon={<RiCalendarCheckLine />} tone="teal" value={todayStaff.length} label="Present today" />
            <Stat
              icon={<RiTimeLine />}
              tone="orange"
              value={fmtTime(todayStaff[0]?.check_in_time) === "—" ? "—" : fmtTime(todayStaff[0].check_in_time)}
              label="Last check-in"
            />
          </div>

          <div className="attnd-grid2">
            <Card icon={<RiUserReceivedLine />} tone="teal" title={direction === "out" ? "Staff Check-Out" : "Staff Check-In"}>
              {activeStaff.length === 0 ? (
                <div className="attnd-empty" style={{ padding: "12px 0" }}>
                  <span className="attnd-empty-ic"><RiUserSettingsLine /></span>
                  No active staff yet — add team members in the <b>Staff Directory</b> below.
                </div>
              ) : (
                <Form onSubmit={handleStaffCheckIn} className="d-flex gap-2 align-items-end flex-wrap">
                  <Form.Group controlId="staffSelect" style={{ minWidth: 260, flex: "1 1 260px" }}>
                    <Form.Label>Staff Member</Form.Label>
                    <Form.Select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
                      <option value="">Select staff…</option>
                      {activeStaff.map((s) => {
                        const st = staffState[s.name];
                        return (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.role ? `(${s.role})` : ""}{st === "in" ? " — in school" : st === "out" ? " (signed out earlier)" : ""}
                          </option>
                        );
                      })}
                    </Form.Select>
                  </Form.Group>
                  <Button type="submit" variant={direction === "out" ? "warning" : "success"} disabled={submitting}>
                    {submitting ? <Spinner size="sm" animation="border" /> : direction === "out" ? "Check Out" : "Check In"}
                  </Button>
                </Form>
              )}
            </Card>

            <Card icon={<RiArrowLeftRightLine />} tone="orange" title="Staff Present Today">
              {todayStaff.length === 0 ? (
                <div className="attnd-empty" style={{ padding: "12px 0" }}>No staff check-ins yet today.</div>
              ) : (
                <div style={{ maxHeight: 210, overflowY: "auto" }}>
                  <table className="attnd-table">
                    <thead>
                      <tr><th>Photo</th><th>Name</th><th>Role</th><th>In</th><th>Check-out</th><th></th></tr>
                    </thead>
                    <tbody>
                      {todayStaff.map((r) => (
                        <tr key={r.id}>
                          <td><PicThumb src={staffPicMap[r.staff_name]} name={r.staff_name} onZoom={(src, name) => setPicViewer({ open: true, src, name })} /></td>
                          <td className="attnd-strong">{r.staff_name}</td>
                          <td>{r.role || "Staff"}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{fmtTime(r.check_in_time)}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {r.check_out_time
                              ? <span>{fmtTime(r.check_out_time)} <span className="attnd-badge out">out</span></span>
                              : <span className="attnd-badge in">Still in</span>}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {!r.check_out_time && (
                              <button type="button" className="attnd-iconbtn" title="Sign out" onClick={() => signOutStaffRow(r)}>
                                <RiLogoutBoxRLine />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Staff directory — add / manage bluebell_staff from the app */}
          <Card
            icon={<RiUserSettingsLine />}
            tone="purple"
            title={`Staff Directory (${staffList.length})`}
            right={<span className="attnd-hint" style={{ margin: 0 }}>Add, deactivate or remove staff</span>}
          >
            <Form className="attnd-dirform" onSubmit={handleAddStaff}>
              <Form.Group controlId="newStaffName">
                <Form.Label>Full Name *</Form.Label>
                <Form.Control
                  required
                  placeholder="e.g. Ada Okonkwo"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Form.Group>
              <Form.Group controlId="newStaffRole">
                <Form.Label>Role</Form.Label>
                <Form.Select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))}
                >
                  {["Staff", "Teacher", "Admin", "Nurse", "Cook", "Driver", "Security"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group controlId="newStaffEmail">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="optional"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Form.Group>
              <Form.Group controlId="newStaffPhone">
                <Form.Label>Phone</Form.Label>
                <Form.Control
                  placeholder="optional"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </Form.Group>
              <Button type="submit" variant="success" disabled={addingStaff} style={{ height: 38 }}>
                {addingStaff ? <Spinner size="sm" animation="border" /> : <><RiAddLine className="me-1" /> Add Staff</>}
              </Button>
            </Form>

            <div className="attnd-tablewrap">
              <table className="attnd-table">
                <thead>
                  <tr><th>#</th><th>Photo</th><th>Name</th><th>Role</th><th>Contact</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
                </thead>
                <tbody>
                  {staffList.map((s, i) => (
                    <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td><PicThumb src={staffPicUrl(s.profile_pic)} name={s.name} onZoom={(src, name) => setPicViewer({ open: true, src, name })} /></td>
                      <td className="attnd-strong">{s.name}</td>
                      <td>{s.role || "Staff"}</td>
                      <td style={{ fontSize: 12.5, color: "var(--text-secondary, #888)" }}>
                        {[s.email, s.phone].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td><span className={"attnd-badge " + ((s.status || "active") === "active" ? "active" : "inactive")}>{s.status || "active"}</span></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className={"attnd-iconbtn" + ((s.status || "active") === "active" ? "" : " revive")}
                          title={(s.status || "active") === "active" ? "Mark inactive" : "Reactivate"}
                          onClick={() => toggleStaffStatus(s)}
                        >
                          <RiArrowLeftRightLine />
                        </button>{" "}
                        <button type="button" className="attnd-iconbtn" title="Remove staff" onClick={() => deleteStaff(s)}>
                          <RiDeleteBin6Line />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {staffList.length === 0 && (
                    <EmptyRow cols={7}>
                      No staff yet. Use the form above to add your first team member.
                    </EmptyRow>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {/* Full-screen passport viewer */}
      {picViewer.open && (
        <div className="attnd-picviewer" onClick={() => setPicViewer({ open: false, src: "", name: "" })}>
          <button
            type="button"
            title="Close"
            className="attnd-picviewer-close"
            onClick={(e) => { e.stopPropagation(); setPicViewer({ open: false, src: "", name: "" }); }}
          >
            <RiCloseLine />
          </button>
          <div className="attnd-picviewer-body" onClick={(e) => e.stopPropagation()}>
            <img src={picViewer.src} alt={picViewer.name} className="attnd-picviewer-img" />
            {picViewer.name && <span className="attnd-picviewer-name">{picViewer.name}</span>}
          </div>
        </div>
      )}

    </div>
  );
};

export default AttendanceTaker;
