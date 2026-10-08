import React, { useEffect, useState } from "react";
import {
  RiGraduationCapLine,
  RiTeamLine,
  RiCalendarCheckLine,
  RiBriefcaseLine,
  RiMoneyDollarCircleLine,
  RiQuestionAnswerLine,
  RiSearchLine,
  RiHistoryLine,
  RiTrophyLine,
  RiScanLine,
  RiArrowRightLine,
  RiCustomerService2Line,
  RiDraftLine,
  RiBookOpenLine,
  RiFileTextLine,
} from "react-icons/ri";
import CardComponent from "../components/Card";
import GraphComponent from "../components/GraphComponent";
import { Col, Row } from "react-bootstrap";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../supabaseClient";
import { endOfMonth } from "../utils/dateUtils";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/Home.css";

// ---------- small presentational helpers ----------

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const fmtDay = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "?";

const StatCard = ({ icon, label, value, sub, tone = "#4e73df", chipBg = "#eef2fd" }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: chipBg, color: tone }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div className="stat-label" style={{ color: tone }}>{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  </div>
);

const Panel = ({ title, icon, tone = "#4e73df", chipBg = "#eef2fd", action, children, className = "" }) => (
  <div className={`dash-panel ${className}`}>
    <div className="panel-head">
      <div className="d-flex align-items-center" style={{ gap: 10, minWidth: 0 }}>
        <span className="panel-icon" style={{ background: chipBg, color: tone }}>{icon}</span>
        <span className="panel-title">{title}</span>
      </div>
      {action}
    </div>
    <div className="panel-body">{children}</div>
  </div>
);

const EmptyNote = ({ children }) => <div className="empty-note">{children}</div>;

const MiniRow = ({ name, sub, right, badge, badgeTone = "#1cc88a" }) => (
  <div className="mini-item">
    <span className="mini-avatar">{initials(name)}</span>
    <div className="mini-text">
      <div className="mini-name">{name}</div>
      {sub && <div className="mini-sub">{sub}</div>}
    </div>
    {badge && (
      <span className="mini-badge" style={{ background: `${badgeTone}1a`, color: badgeTone }}>
        {badge}
      </span>
    )}
    {right && <span className="mini-right">{right}</span>}
  </div>
);

// ---------- dashboard ----------

export const Home = () => {
  const [user, setUser] = useState();
  const [teacherAuth, setTeacherAuth] = useState([]);
  const [userAuth, setUserAuthState] = useState([]);
  const [loading, setLoading] = useState(true);
  // Safely initialize router
  let router;
  let isRouterAvailable = false;

  try {
    router = useRouter();
    isRouterAvailable = router && router.push;
  } catch (error) {
    console.warn("NextRouter not available in this context");
  }
  const [pay, setPay] = useState("");
  const [succ, setSucc] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [attendance, setAttendance] = useState({ studentsToday: 0, staffToday: 0, studentsTerm: 0, staffTerm: 0 });
  const [recents, setRecents] = useState({ attendance: [], students: [], cbtResults: [], cbtQuestions: [] });
  const [enquiryStats, setEnquiryStats] = useState({ newCount: 0, overdue: 0, recent: [] });
  // Recent teaching activity for the dashboard: lesson plans, notes, assignments.
  const [academic, setAcademic] = useState({ lessonPlans: [], notes: [], assignments: [] });

  // Website enquiries widget — new leads + overdue follow-ups (Phase 3b).
  // Tolerates a missing bluebell_enquiries table (SQL not run yet) by staying 0/empty.
  useEffect(() => {
    const loadEnquiries = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [fresh, overdue, recent] = await Promise.all([
          supabase.from("bluebell_enquiries").select("*", { count: "exact", head: true }).eq("status", "new"),
          supabase
            .from("bluebell_enquiries")
            .select("*", { count: "exact", head: true })
            .lt("next_follow_up", today)
            .not("status", "in", "(closed,resolved)"),
          supabase
            .from("bluebell_enquiries")
            .select("name, email, enquiry_type, created_at")
            .eq("status", "new")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
        if (fresh.error) return; // table probably missing — widget stays silent
        setEnquiryStats({
          newCount: fresh.count || 0,
          overdue: overdue.error ? 0 : overdue.count || 0,
          recent: recent.error ? [] : recent.data || [],
        });
      } catch (e) {
        console.warn("Enquiry stats unavailable:", e);
      }
    };
    loadEnquiries();
  }, []);

  // Attendance tracking widgets: count-only queries, no row fetches
  useEffect(() => {
    const loadAttendanceStats = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data: settingsData } = await supabase.from("bluebell_settings").select("session, term").limit(1);
        const current = settingsData && settingsData[0] ? settingsData[0] : {};

        let studentsTodayQ = supabase.from("bluebell_attendance").select("*", { count: "exact", head: true }).eq("date", today);
        let staffTodayQ = supabase.from("bluebell_staff_attendance").select("*", { count: "exact", head: true }).eq("date", today);
        let studentsTermQ = supabase.from("bluebell_attendance").select("*", { count: "exact", head: true });
        // staff attendance has no term column – use a current-month date range instead
        const monthStart = today.slice(0, 8) + "01";
        // real last day of month — a hard-coded "31" is out of range in short months
        const monthEnd = endOfMonth(today.slice(0, 7));
        let staffTermQ = supabase.from("bluebell_staff_attendance").select("*", { count: "exact", head: true }).gte("date", monthStart).lte("date", monthEnd);
        if (current.term) {
          studentsTermQ = studentsTermQ.eq("term", current.term);
          if (current.session) studentsTermQ = studentsTermQ.eq("session", current.session);
        }
        const [sToday, stToday, sTerm, stTerm] = await Promise.all([
          studentsTodayQ,
          staffTodayQ,
          studentsTermQ,
          staffTermQ,
        ]);
        setAttendance({
          studentsToday: sToday.count || 0,
          staffToday: stToday.count || 0,
          studentsTerm: sTerm.count || 0,
          staffTerm: stTerm.count || 0,
        });
      } catch (e) {
        console.warn("Attendance stats unavailable:", e);
      }
    };
    loadAttendanceStats();
  }, []);

  // Recent activity lists – each query is independent; failures (e.g. missing
  // tables) simply yield empty lists so the dashboard never breaks.
  useEffect(() => {
    const loadRecents = async () => {
      const [att, stu, res, q] = await Promise.allSettled([
        supabase
          .from("bluebell_attendance")
          .select("student_name, class, check_in_time, method")
          .order("check_in_time", { ascending: false })
          .limit(12),
        supabase
          .from("bluebell_student")
          .select("id, name, class, sex")
          .order("id", { ascending: false })
          .limit(8),
        supabase
          .from("bluebell_cbt_results")
          .select("studentName, studentClass, subject, term, percentage, sessionType, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("bluebell_cbtQuestions")
          .select("subject, class, purpose, term, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      const rows = (r) => (r.status === "fulfilled" && !r.value.error ? r.value.data || [] : []);
      setRecents({
        attendance: rows(att),
        students: rows(stu),
        cbtResults: rows(res),
        cbtQuestions: rows(q),
      });
    };
    loadRecents();
  }, []);

  // Teaching & learning widgets – recent lesson plans, notes and assignments.
  // Each query is independent; missing/empty tables simply yield empty lists
  // so the dashboard never breaks (admins and teachers both see these).
  useEffect(() => {
    const loadAcademic = async () => {
      const [plans, notes, assigns] = await Promise.allSettled([
        supabase
          .from("bluebell_lesson_plans")
          .select("class, subject, topic, teacher_name, submitted_by, review_status, academic_session, term, updated_at")
          .order("updated_at", { ascending: false })
          .limit(8),
        supabase
          .from("bluebell_notes")
          .select("class, subject, title, uploaded_by, academic_session, term, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("bluebell_assignments")
          .select("class, subject, title, assignment_type, due_date, created_by, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      const rows = (r) => (r.status === "fulfilled" && !r.value.error ? r.value.data || [] : []);
      setAcademic({ lessonPlans: rows(plans), notes: rows(notes), assignments: rows(assigns) });
    };
    loadAcademic();
  }, []);

  const handleInputChange = (e) => setPay(e.target.value);

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
        const [teacherData, userData] = await Promise.all([
          supabase.from("bluebell_teacherauth").select("*"),
          supabase.from("bluebell_userauth").select("*"),
        ]);

        // Handle teacher auth data
        if (teacherData.error) throw teacherData.error;
        setTeacherAuth(teacherData.data || []);

        // Handle user auth data
        if (userData.error) throw userData.error;
        setUserAuthState(userData.data || []);
      } catch (error) {
        console.error("Error initializing data:", error);
      } finally {
        // Only set loading to false after all verification is complete
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  const [paymentList, setPaymentList] = useState([]);

  useEffect(() => {
    getProducts();
  }, []);

  async function getProducts() {
    try {
      const { data, error } = await supabase
        .from("bluebell_paymentsinfo")
        .select("*");
      if (error) throw error;
      if (data != null) {
        setSucc(data);
        setPaymentList([...data].reverse());
      }
    } catch (error) {
      toast.error(error.message);
    }
  }

  useEffect(() => {
    const getTotalStudents = async () => {
      try {
        const { count, error } = await supabase
          .from("bluebell_student")
          .select("*", { count: "exact", head: true });
        if (error) throw error;
        setTotalStudents(count || 0);
      } catch (error) {
        toast.error("Failed to fetch data. Please check your internet connection.");
      }
    };
    getTotalStudents();
  }, []);

  // Check if the current user is a teacher
  const isTeacher = user && teacherAuth && teacherAuth.some && teacherAuth.some(auth => auth.email === user?.user_metadata?.email);
  // Check if the current user is an admin
  const isAdmin = user && userAuth && userAuth.some && userAuth.some(auth => auth.email === user?.user_metadata?.email);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontSize: "1.2rem",
        flexDirection: "column",
      }}>
        <div className="spinner-border" role="status" style={{ width: "3rem", height: "3rem", marginBottom: "1rem" }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <div>Verifying credentials...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isTeacher && !isAdmin) {
    return (
      <div className="user-not-found">
        <h1 style={{ marginBottom: "20px", color: "#333" }}>
          User not authorised
        </h1>
        <p style={{ marginBottom: "40px", color: "red" }}>
          Please login with proper credentials or check your internet connection.
        </p>
        <button
          onClick={() => {
            if (isRouterAvailable) {
              router.push("/login");
            } else {
              // Fallback to window.location for cases where router is not available
              window.location.href = "/login";
            }
          }}
          className="btn btn-primary"
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            borderRadius: "5px",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
          }}
        >
          Go to Login
        </button>
      </div>
    );
  }

  const fullName =
    user.identities && user.identities[0]?.identity_data?.full_name
      ? user.identities[0].identity_data.full_name
      : user.email;
  const staffAccounts = Math.max(teacherAuth.length - 2, 0);
  const presentPct = totalStudents > 0 ? Math.min(100, Math.round((attendance.studentsToday / totalStudents) * 100)) : 0;
  const todayLabel = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="dash-page">
      <ToastContainer />

      {/* Hero */}
      <div className="dash-hero">
        <div style={{ minWidth: 0 }}>
          <div className="dash-hero-kicker">{todayLabel}</div>
          <h2 className="dash-hero-title">
            {greeting()}, {String(fullName).split(" ")[0]}
          </h2>
          <div className="dash-hero-sub">Welcome back to your dashboard.</div>
        </div>
        <div className="dash-hero-side">
          <span className="dash-role-badge">{isTeacher ? "Teacher" : "Administrator"}</span>
          <Link href="/attendance" className="dash-hero-btn">
            <RiScanLine /> Take Attendance <RiArrowRightLine />
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} xl>
          <StatCard
            icon={<RiGraduationCapLine size={24} />}
            label="Students"
            value={totalStudents}
            sub="Total enrolled"
            tone="#4e73df"
            chipBg="#e9effc"
          />
        </Col>
        <Col xs={12} sm={6} xl>
          <StatCard
            icon={<RiTeamLine size={24} />}
            label="Staff"
            value={staffAccounts}
            sub="Staff accounts"
            tone="#36b9cc"
            chipBg="#e2f7fa"
          />
        </Col>
        <Col xs={12} sm={6} xl>
          <StatCard
            icon={<RiCalendarCheckLine size={24} />}
            label="Present Today"
            value={attendance.studentsToday}
            sub={`Students · ${attendance.studentsTerm} this term`}
            tone="#1cc88a"
            chipBg="#e5f8ef"
          />
        </Col>
        {!isTeacher && (
          <Col xs={12} sm={6} xl>
            <StatCard
              icon={<RiBriefcaseLine size={24} />}
              label="Staff Present Today"
              value={attendance.staffToday}
              sub={`${attendance.staffTerm} this month`}
              tone="#f6a623"
              chipBg="#fdf3e2"
            />
          </Col>
        )}
        {!isTeacher && (
          <Col xs={12} sm={6} xl>
            <StatCard
              icon={<RiMoneyDollarCircleLine size={24} />}
              label="Payments"
              value={succ.length}
              sub="Successful"
              tone="#a14ee7"
              chipBg="#f4eafc"
            />
          </Col>
        )}
      </Row>

      {/* Today's attendance – prominent feature panel */}
      <Panel
        className="mb-4"
        title="Today's Attendance"
        icon={<RiCalendarCheckLine size={18} />}
        tone="#1cc88a"
        chipBg="#e5f8ef"
        action={
          <Link href="/attendance" className="panel-link">
            Check in <RiArrowRightLine />
          </Link>
        }
      >
        <Row className="g-4">
          <Col lg={4}>
            <div className="att-summary">
              <div>
                <div className="att-big">{attendance.studentsToday}<span className="att-big-total">/{totalStudents}</span></div>
                <div className="stat-sub">students checked in today</div>
              </div>
              <div className="att-progress" title={`${presentPct}% of students present`}>
                <div className="att-progress-fill" style={{ width: `${presentPct}%` }} />
              </div>
              <div className="d-flex justify-content-between w-100">
                <div>
                  <div className="att-small">{attendance.studentsTerm}</div>
                  <div className="mini-sub">check-ins this term</div>
                </div>
                {!isTeacher && (
                  <div className="text-end">
                    <div className="att-small">{attendance.staffToday}</div>
                    <div className="mini-sub">staff present today</div>
                  </div>
                )}
              </div>
            </div>
          </Col>
          <Col lg={8}>
            <div className="mini-list-title">
              <RiHistoryLine /> Latest check-ins
            </div>
            <div className="mini-scroll">
              {recents.attendance.length === 0 ? (
                <EmptyNote>No check-ins recorded yet today. Scan a student QR or check in manually from the Attendance page.</EmptyNote>
              ) : (
                recents.attendance.map((a, idx) => (
                  <MiniRow
                    key={`${a.student_name}-${a.class}-${idx}`}
                    name={a.student_name}
                    sub={`${a.class}${a.check_in_time ? ` · ${fmtTime(a.check_in_time)}` : ""}`}
                    badge={a.method === "qr" ? "QR" : "Manual"}
                    badgeTone={a.method === "qr" ? "#4e73df" : "#f6a623"}
                  />
                ))
              )}
            </div>
          </Col>
        </Row>
      </Panel>

      {/* Recent activity grid */}
      <Row className="g-3 mb-4">
        <Col lg={4}>
          <Panel
            title="Recent Students"
            icon={<RiGraduationCapLine size={18} />}
            className="h-100"
            action={<Link href="/full_student" className="panel-link">View all <RiArrowRightLine /></Link>}
          >
            <div className="mini-scroll" style={{ maxHeight: 320 }}>
              {recents.students.length === 0 ? (
                <EmptyNote>No students found.</EmptyNote>
              ) : (
                recents.students.map((s) => (
                  <MiniRow key={s.id} name={s.name} sub={`${s.class}${s.sex ? ` · ${s.sex}` : ""}`} />
                ))
              )}
            </div>
          </Panel>
        </Col>
        <Col lg={4}>
          <Panel
            title="Recent CBT Exams & Results"
            icon={<RiTrophyLine size={18} />}
            tone="#a14ee7"
            chipBg="#f4eafc"
            className="h-100"
          >
            <div className="mini-scroll" style={{ maxHeight: 320 }}>
              {recents.cbtResults.length === 0 ? (
                <EmptyNote>No exam submissions yet.</EmptyNote>
              ) : (
                recents.cbtResults.map((r, idx) => (
                  <MiniRow
                    key={`${r.studentName}-${r.subject}-${idx}`}
                    name={r.studentName || "Unknown"}
                    sub={`${r.subject || "—"}${r.studentClass ? ` · ${r.studentClass}` : ""}${r.term ? ` · ${r.term}` : ""}`}
                    right={r.percentage != null ? `${r.percentage}%` : null}
                    badge={r.sessionType}
                    badgeTone={
                      r.sessionType === "essay" ? "#36b9cc" : r.sessionType === "objective" ? "#1cc88a" : "#4e73df"
                    }
                  />
                ))
              )}
            </div>
          </Panel>
        </Col>
        <Col lg={4}>
          <Panel
            title="Recent CBT Questions"
            icon={<RiQuestionAnswerLine size={18} />}
            tone="#f6a623"
            chipBg="#fdf3e2"
            className="h-100"
            action={<Link href="/CBTQuestions" className="panel-link">Manage <RiArrowRightLine /></Link>}
          >
            <div className="mini-scroll" style={{ maxHeight: 320 }}>
              {recents.cbtQuestions.length === 0 ? (
                <EmptyNote>No questions uploaded yet.</EmptyNote>
              ) : (
                recents.cbtQuestions.map((q, idx) => (
                  <MiniRow
                    key={`${q.subject}-${idx}`}
                    name={q.subject || "Untitled"}
                    sub={`${q.class || "—"}${q.purpose ? ` · ${q.purpose}` : ""}${q.term ? ` · ${q.term}` : ""}`}
                    right={q.created_at ? fmtDay(q.created_at) : null}
                  />
                ))
              )}
            </div>
          </Panel>
        </Col>
      </Row>

      {/* Teaching & learning: lesson plans, notes, assignments (admins & teachers) */}
      <Row className="g-3 mb-4">
        <Col lg={4}>
          <Panel
            title="Lesson Plans"
            icon={<RiDraftLine size={18} />}
            tone="#4e73df"
            chipBg="#e9effc"
            className="h-100"
            action={<Link href="/lesson_plans" className="panel-link">View all <RiArrowRightLine /></Link>}
          >
            <div className="mini-scroll" style={{ maxHeight: 320 }}>
              {academic.lessonPlans.length === 0 ? (
                <EmptyNote>No lesson plans submitted yet.</EmptyNote>
              ) : (
                academic.lessonPlans.map((p, idx) => (
                  <MiniRow
                    key={`lp-${idx}`}
                    name={p.topic || p.class || "Untitled plan"}
                    sub={`${p.class || "—"}${p.subject ? ` · ${p.subject}` : ""}`}
                    badge={p.review_status || "pending"}
                    badgeTone={p.review_status === "approved" ? "#1cc88a" : p.review_status === "revision" ? "#f6a623" : "#4e73df"}
                    right={p.updated_at ? fmtDay(p.updated_at) : null}
                  />
                ))
              )}
            </div>
          </Panel>
        </Col>
        <Col lg={4}>
          <Panel
            title="E-Notes"
            icon={<RiBookOpenLine size={18} />}
            tone="#1cc88a"
            chipBg="#e5f8ef"
            className="h-100"
            action={<Link href="/notes" className="panel-link">View all <RiArrowRightLine /></Link>}
          >
            <div className="mini-scroll" style={{ maxHeight: 320 }}>
              {academic.notes.length === 0 ? (
                <EmptyNote>No notes shared yet.</EmptyNote>
              ) : (
                academic.notes.map((n, idx) => (
                  <MiniRow
                    key={`nt-${idx}`}
                    name={n.title || "Untitled note"}
                    sub={`${n.class || "—"}${n.subject ? ` · ${n.subject}` : ""}`}
                    right={n.created_at ? fmtDay(n.created_at) : null}
                  />
                ))
              )}
            </div>
          </Panel>
        </Col>
        <Col lg={4}>
          <Panel
            title="Assignments"
            icon={<RiFileTextLine size={18} />}
            tone="#f6a623"
            chipBg="#fdf3e2"
            className="h-100"
            action={<Link href="/assignments" className="panel-link">View all <RiArrowRightLine /></Link>}
          >
            <div className="mini-scroll" style={{ maxHeight: 320 }}>
              {academic.assignments.length === 0 ? (
                <EmptyNote>No assignments given yet.</EmptyNote>
              ) : (
                academic.assignments.map((a, idx) => (
                  <MiniRow
                    key={`as-${idx}`}
                    name={a.title || "Untitled assignment"}
                    sub={`${a.class || "—"}${a.subject ? ` · ${a.subject}` : ""}${a.due_date ? ` · due ${fmtDay(a.due_date)}` : ""}`}
                    badge={a.assignment_type}
                    badgeTone={a.assignment_type === "project" ? "#a14ee7" : a.assignment_type === "assessment" ? "#e74a3b" : "#f6a623"}
                  />
                ))
              )}
            </div>
          </Panel>
        </Col>
      </Row>

      {/* Admin-only: website enquiries follow-up widget */}
      {!isTeacher && (
        <Panel
          className="mb-4"
          title="Parent Enquiries"
          icon={<RiCustomerService2Line size={18} />}
          tone="#e74a3b"
          chipBg="#fdecea"
          action={
            <Link href="/enquiries" className="panel-link">
              Follow-up pipeline <RiArrowRightLine />
            </Link>
          }
        >
          <Row className="g-4">
            <Col sm={4}>
              <div className="att-big">{enquiryStats.newCount}</div>
              <div className="stat-sub">new, awaiting reply</div>
            </Col>
            <Col sm={4}>
              <div className="att-big" style={{ color: enquiryStats.overdue ? "#e74a3b" : undefined }}>
                {enquiryStats.overdue}
              </div>
              <div className="stat-sub">overdue follow-ups</div>
            </Col>
            <Col sm={4}>
              <div className="mini-list-title">
                <RiHistoryLine /> Latest enquiries
              </div>
              {enquiryStats.recent.length === 0 ? (
                <div className="mini-sub">No new enquiries right now.</div>
              ) : (
                enquiryStats.recent.slice(0, 2).map((q, i) => (
                  <div key={`${q.email}-${i}`} className="mini-sub text-truncate">
                    {q.name} · {q.enquiry_type || "general"}
                  </div>
                ))
              )}
            </Col>
          </Row>
        </Panel>
      )}

      {/* Admin-only: payments analytics */}
      {!isTeacher && (
        <>
          <GraphComponent paymentData={paymentList} />
          <Panel
            className="mt-4"
            title="Recent Payments"
            icon={<RiMoneyDollarCircleLine size={18} />}
            tone="#a14ee7"
            chipBg="#f4eafc"
            action={
              <div className="dash-search">
                <RiSearchLine className="dash-search-icon" />
                <input
                  value={pay}
                  onChange={handleInputChange}
                  placeholder="Search name of student..."
                  aria-label="Search payments by student name"
                />
              </div>
            }
          >
            <Row xs={1} sm={2} lg={3} className="g-3">
              {paymentList
                .filter((payment) =>
                  payment.name && payment.name.toLowerCase().includes(pay.toLowerCase())
                )
                .slice(0, 12)
                .map((payment) => (
                  <Col key={payment.id}>
                    <CardComponent payments={payment} />
                  </Col>
                ))}
            </Row>
            {paymentList.length === 0 && <EmptyNote>No payments recorded yet.</EmptyNote>}
          </Panel>
        </>
      )}
    </div>
  );
};
