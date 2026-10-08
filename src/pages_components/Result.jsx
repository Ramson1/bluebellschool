import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { abbreviateSubject, getStandardRemarks, normalizeSubjectName, schoolSubjects } from '../utils/subjectUtils';
import { CLASS_OPTIONS } from '../utils/classOptions';
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Card from "react-bootstrap/Card";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import ProgressBar from "react-bootstrap/ProgressBar";
import Spinner from "react-bootstrap/Spinner";
import emailjs from '@emailjs/browser';
import { sendEmailNotification } from '../api/emailNotificationService';
import { resolveResultRecipients } from '../utils/resultRecipients';
import { logAction } from '../api/auditLog';
import * as XLSX from 'xlsx';
import { FaFileExcel } from 'react-icons/fa';
import {
  RiUploadCloud2Line,
  RiEyeLine,
  RiBarChart2Line,
  RiDownloadLine,
  RiUserLine,
  RiGraduationCapLine,
  RiTimeLine,
  RiGroupLine,
  RiClipboardLine,
  RiAwardLine,
  RiStarLine,
  RiCheckLine,
  RiCloseLine,
  RiInformationLine,
  RiEmotionHappyLine,
  RiRunLine,
  RiBankLine,
} from 'react-icons/ri';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import '../styles/Result.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
// import { sendEmailNotification as sendEmailNotificationClient, getAdminEmail } from '../api/emailClient';
// EMAIL FUNCTIONALITY COMMENTED OUT FOR VERCEL DEPLOYMENT

// Function to send email notification using both EmailJS and Gmail service
// EMAIL FUNCTIONALITY COMMENTED OUT FOR VERCEL DEPLOYMENT
// const sendEmailNotification = async (subject, message) => {
//   console.log('Email functionality is disabled for Vercel deployment');
//   console.log('Subject:', subject);
//   console.log('Message:', message);
//   // Return early without sending email
//   return;
// }; // Unused

// Function to send email notification using our Gmail service
// EMAIL FUNCTIONALITY COMMENTED OUT FOR VERCEL DEPLOYMENT
// const sendEmailNotificationGmail = async (subject, text) => {
//   console.log('Email functionality is disabled for Vercel deployment');
//   console.log('Subject:', subject);
//   console.log('Text:', text);
//   // Return early without sending email
//   return;
// }; // Unused

// Predefined subjects for each class category
// schoolSubjects are imported from subjectUtils.js

// Function to determine class level group - now using primary grading for all levels including early years
const getClassLevelGroup = (classKey) => {
  const lowerClassKey = String(classKey || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const m = lowerClassKey.match(/year(\d+)/);
  if (m) return Number(m[1]) >= 7 ? "secondary" : "primary";
  return "primary"; // early years + default
};

// Resolve the subject list for a class label (used to measure result completeness)
const getSubjectListForClass = (className) => {
  const key = (className || "").toLowerCase().replace(/\s+/g, "");
  if (key.includes("creche")) return schoolSubjects.creche || [];
  if (key.includes("prenursery") || key.includes("pre-nursery") || key.includes("nursery")) {
    return schoolSubjects.nursery || [];
  }
  const m = key.match(/year(\d+)/);
  if (m) return schoolSubjects[`year${m[1]}`] || [];
  return [];
};

// A stored subject entry counts as "filled" only when it carries a real score
// (untouched subjects are stored with "0"/empty fallbacks by uploadResults)
const resultEntryHasScore = (entry, isMidterm) => {
  if (!entry) return false;
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  if (isMidterm) return num(entry.midtermScore ?? entry.test) > 0;
  return num(entry.examination) > 0 || num(entry.test) > 0 || num(entry.project) > 0;
};

// The school's marking scheme is a hard ceiling on every result cell: Test 30,
// Project 10, Examination 60, mid-term score 30. A typed number used to be stored
// exactly as entered, which is how one subject could end up holding more marks
// than the column can take.
const SCORE_MAX = { test: 30, project: 10, examination: 60, midtermScore: 30 };

const clampScore = (key, value) => {
  const max = SCORE_MAX[key];
  if (max === undefined) return { value, clamped: false };
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return { value, clamped: false };   // empty / partial input
  if (num < 0) return { value: "0", clamped: true };
  if (num > max) return { value: String(max), clamped: true };
  return { value, clamped: false };
};

// Main component: Handles student result entry, grading, and dynamic subject selection
export default function Result() {
  const [user, setUser] = useState();
  const [userAuth, setUserAuth] = useState([]);
  const [teacherAuth, setTeacherAuth] = useState([]);

  const [studentClassFilter, setStudentClassFilter] = useState("");
  const [termFilter, setTermFilter] = useState(""); // State to manage the selected term
  const [subjects, setSubjects] = useState([]);
  const [studentsOptions, setStudentsOptions] = useState([]);
  const [studentIdMap, setStudentIdMap] = useState({});
  const [clampedCells, setClampedCells] = useState({}); // cells capped by SCORE_MAX
  const [scores, setScores] = useState({
    debitAmount: { value: "" },
    // Initialize all psychomotor and affective domain fields
    handWriting: { value: "" },
    verbalFrequency: { value: "" },
    games: { value: "" },
    handlingTools: { value: "" },
    drawingPainting: { value: "" },
    musicalSkills: { value: "" },
    daysPresent: { value: "" },
    daysAbsent: { value: "" },
    punctuality: { value: "" },
    neatness: { value: "" },
    honesty: { value: "" },
    coOperation: { value: "" },
    leadership: { value: "" },
    helpingOthers: { value: "" },
    emotionalStability: { value: "" },
    health: { value: "" },
    attentiveness: { value: "" },
    attitudeToSchoolWork: { value: "" }
  });
  const [selectedStudent, setSelectedStudent] = useState("");
  const [fetchedResultId, setFetchedResultId] = useState(null);
  const [termSubjects, setTermSubjects] = useState({
    term1Subjects: [],
    term2Subjects: [],
    term3Subjects: [],
    overall1st: {},
    overall2nd: {},
    overall3rd: {},
  });
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [classStats, setClassStats] = useState([]);
  const [showClassStats, setShowClassStats] = useState(true); // State to toggle class stats visibility
  const [statsClass, setStatsClass] = useState(""); // Class selected in the completion panel
  const [isUploading, setIsUploading] = useState(false); // State to track upload process
  const [purpose, setPurpose] = useState('fullterm'); // State to manage result purpose (fullterm/midterm)

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTerm, setExportTerm] = useState('1st Term');
  const [exportType, setExportType] = useState('general');
  const [exportScope, setExportScope] = useState('all');
  const [exportStudentName, setExportStudentName] = useState('');
  const [devAuth, setDevAuth] = useState([]);

  // const router = useRouter(); // Unused

  useEffect(() => {
    const getUserData = async () => {
      await supabase.auth.getUser().then((value) => {
        if (value.data?.user) {
          setUser(value.data.user);
        }
      });
    };
    // check if it is working
    const fetchUserAuth = async () => {
      try {
        const { data, error } = await supabase
          .from('jmis_userauth')
          .select('email');
        if (error) throw error;
        setUserAuth(data);
      } catch (error) {
        // Handle error if needed
      }
    };
    
    const fetchTeacherAuth = async () => {
      try {
        const { data, error } = await supabase
          .from('jmis_teacherauth')
          .select('email');
        if (error) throw error;
        setTeacherAuth(data);
      } catch (error) {
        // Handle error if needed
      }
    };

    const fetchDevAuth = async () => {
      try {
        const { data, error } = await supabase
          .from('devauth')
          .select('email');
        if (error) throw error;
        setDevAuth(data);
      } catch (error) {
        // Handle error if needed
      }
    };
    
    getUserData();
    fetchUserAuth();
    fetchTeacherAuth();
    fetchDevAuth();
  }, []);

  // Check if the current user is a teacher
  const isTeacher = user && teacherAuth && teacherAuth.some && teacherAuth.some(auth => auth.email === user?.user_metadata?.email);
  const isDev = user && devAuth && devAuth.some && devAuth.some(auth => auth.email === user?.user_metadata?.email);

  // Get current user's email for audit trail
  const getCurrentUserEmail = () => {
    return user?.user_metadata?.email || 'Unknown User';
  };

  // Resolve the acting user's role for audit logging
  const getAuditRole = () => {
    const em = getCurrentUserEmail();
    if ((devAuth || []).some((a) => a.email === em)) return "developer";
    if ((userAuth || []).some((a) => a.email === em)) return "admin";
    if ((teacherAuth || []).some((a) => a.email === em)) return "teacher";
    return "";
  };

  const handleExport = async () => {
    toast.info("Exporting data...");
    try {
      let query = supabase.from('jmis_result').select('*');
      
      if (exportScope === 'individual') {
        if (!exportStudentName) {
          toast.error("Please enter student name");
          return;
        }
        query = query.ilike('studentName', `%${exportStudentName}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info("No data found to export");
        return;
      }

      const processedData = data.map(record => {
         let termKey = 'term1Subjects';
         let overall = record.overall1st || {};

         if (exportTerm === '2nd Term') {
           termKey = 'term2Subjects';
           overall = Array.isArray(record.overall2nd) ? (record.overall2nd[0] || {}) : (record.overall2nd || {});
         } else if (exportTerm === '3rd Term') {
           termKey = 'term3Subjects';
           overall = Array.isArray(record.overall3rd) ? (record.overall3rd[0] || {}) : (record.overall3rd || {});
         }

         const subjects = record[termKey] || [];
         const subjectData = {};

         subjects.forEach(sub => {
           if (exportType === 'midterm') {
              subjectData[`${sub.subjectName} (Midterm)`] = sub.test || sub.ca1 || '-';
           } else {
              subjectData[`${sub.subjectName} (Test)`] = sub.test || '-';
              subjectData[`${sub.subjectName} (Project)`] = sub.project || '-';
              subjectData[`${sub.subjectName} (Exam)`] = sub.examination || sub.exam || '-';
              subjectData[`${sub.subjectName} (Total)`] = sub.total || '-';
              subjectData[`${sub.subjectName} (Grade)`] = sub.grade || '-';
           }
         });

         return {
           'Student Name': record.studentName,
           'Class': record.studentClass,
           'Term': exportTerm,
           'Type': exportType,
           ...subjectData,
           'Total Score': overall.overallTotal || '-',
           'Average/Grade': overall.overallGrade || '-',
           'Teacher Remark': overall.overallRemark || '-',
           'Principal Remark': overall.overallPrincipalRemark || '-'
         };
      });

      const ws = XLSX.utils.json_to_sheet(processedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Results");
      XLSX.writeFile(wb, `Results_${exportTerm}_${exportType}.xlsx`);
      
      toast.success("Export successful!");
      setShowExportModal(false);
    } catch (error) {
      console.error(error);
      toast.error("Export failed: " + error.message);
    }
  };

  // Button activity state for 'Upload Results'
  const isUploadButtonDisabled = !selectedStudent || !studentClassFilter || !termFilter;

  // Fetch user data and student names along with IDs
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const { data, error } = await supabase.from("jmis_student").select("id, name, class");
        if (error) throw error;

        const sortedStudents = data.map((student) => student.name).sort();
        // Create a mapping that includes both student ID and class
        const studentIdMapping = data.reduce((acc, student) => {
          acc[student.name] = {
            id: student.id,
            class: student.class
          };
          return acc;
        }, {});

        setStudentsOptions(sortedStudents);
        setStudentIdMap(studentIdMapping);
      } catch (error) {
        toast.error("Error fetching students: " + error.message);
      }
    };

    fetchStudents();
  }, []);

  useEffect(() => {
    console.log("Student ID Map updated:", studentIdMap);
    // Log the keys to see what students are available
    console.log("Available students:", Object.keys(studentIdMap));
  }, [studentIdMap]);

  useEffect(() => {
    console.log("Scores updated:", scores);
  }, [scores]);

  useEffect(() => {
    console.log("Subjects updated:", subjects);
  }, [subjects]);

  useEffect(() => {
    console.log("Selected student changed:", selectedStudent);
  }, [selectedStudent]);


  useEffect(() => {
    console.log("Term filter changed:", termFilter);
  }, [termFilter]);

  useEffect(() => {
    console.log("Term subjects updated:", termSubjects);
  }, [termSubjects]);

  // Attendance history for the selected student (current term, from jmis_attendance)
  const [studentAttendance, setStudentAttendance] = useState([]);

  useEffect(() => {
    const fetchAttendance = async () => {
      setStudentAttendance([]);
      if (!selectedStudent || !studentClassFilter || !termFilter) return;
      try {
        const { data: settingsData } = await supabase
          .from("jmis_settings")
          .select("session, term, schoolOpened")
          .limit(1);
        const s = (settingsData && settingsData[0]) || {};
        // attendance is only tracked for the term currently set in settings
        if (!s.term || s.term.toLowerCase().trim() !== termFilter.toLowerCase().trim()) return;

        const { data } = await supabase
          .from("jmis_attendance")
          .select("*")
          .eq("student_name", selectedStudent)
          .eq("term", s.term)
          .order("date", { ascending: true });
        const norm = (v) => (v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const rows = (data || []).filter((r) => norm(r.class) === norm(studentClassFilter));
        setStudentAttendance(rows);

        // Prefill daysPresent/daysAbsent from check-ins (manual override still possible)
        if (rows.length > 0) {
          const present = rows.length;
          const opened = parseInt(s.schoolOpened, 10);
          setScores((prev) => ({
            ...prev,
            daysPresent: prev?.daysPresent?.value ? prev.daysPresent : { value: String(present) },
            daysAbsent:
              prev?.daysAbsent?.value
                ? prev.daysAbsent
                : { value: Number.isFinite(opened) ? String(Math.max(opened - present, 0)) : "" },
          }));
        }
      } catch (e) {
        console.warn("Attendance fetch failed:", e);
      }
    };
    fetchAttendance();
  }, [selectedStudent, studentClassFilter, termFilter]);

  const getStudentInfo = (name) => {
    if (!name || !studentIdMap) return null;
    const direct = studentIdMap[name];
    if (direct) return direct;
    const trimmed = name.trim().toLowerCase();
    const matchedKey = Object.keys(studentIdMap).find(
      (key) => key.trim().toLowerCase() === trimmed
    );
    return matchedKey ? studentIdMap[matchedKey] : null;
  };

  // Canonical Creche → Year 12 list (see utils/classOptions.js)
  const classOptions = CLASS_OPTIONS;

  
  useEffect(() => {
    console.log("Student class filter changed:", studentClassFilter);
    // Log all available class options
    console.log("Available class options:", classOptions);
  }, [studentClassFilter, classOptions]);
  
  useEffect(() => {
    const fetchClassStats = async () => {
      try {
        const { data: studentsData, error: studentsError } = await supabase
          .from("jmis_student")
          .select("name, class");

        const { data: resultsData, error: resultsError } = await supabase
          .from("jmis_result")
          .select("studentName, studentClass, term1Subjects, term2Subjects, term3Subjects");

        if (studentsError || resultsError) {
          throw new Error(studentsError?.message || resultsError?.message);
        }

        const termKey =
          termFilter === "1st term"
            ? "term1Subjects"
            : termFilter === "2nd term"
              ? "term2Subjects"
              : "term3Subjects";
        const isMidterm = purpose === "midterm";
        const normName = (v) => (v || "").trim().toLowerCase();

        const resultsByStudent = {};
        (resultsData || []).forEach((r) => {
          if (r?.studentName) resultsByStudent[normName(r.studentName)] = r;
        });

        // Build per-class stats including per-student completeness for the chart panel
        const byClass = {};
        (studentsData || []).forEach((student) => {
          if (!student?.class) return;
          if (!byClass[student.class]) {
            byClass[student.class] = { totalPupils: 0, resultsUploaded: 0, students: [] };
          }
          const group = byClass[student.class];
          group.totalPupils += 1;

          const row = resultsByStudent[normName(student.name)];
          const entries = (row && row[termKey]) || [];
          const subjectCount = Math.max(getSubjectListForClass(student.class).length, entries.length, 1);
          const scoredCount = entries.filter((e) => resultEntryHasScore(e, isMidterm)).length;
          const recorded = entries.length > 0;
          if (recorded) group.resultsUploaded += 1;

          group.students.push({
            name: student.name,
            recorded,
            scoredCount,
            subjectCount,
            percent: Math.min(100, Math.round((scoredCount / subjectCount) * 100)),
          });
        });

        const stats = Object.keys(byClass).map((className) => ({
          className,
          ...byClass[className],
          students: byClass[className].students.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
          ),
        }));
        stats.sort((a, b) => a.className.localeCompare(b.className));

        setClassStats(stats);
      } catch (error) {
        toast.error("Error fetching class stats: " + error.message);
      }
    };

    if (termFilter) {
      fetchClassStats();
    }
  }, [termFilter, purpose]); // Refetch stats when the term or result type changes

  // Derived data for the completion panel (bar chart + per-student progress bars)
  const activeStatsClass =
    statsClass || studentClassFilter || (classStats[0] && classStats[0].className) || "";
  const statsStudents =
    (classStats.find((c) => c.className === activeStatsClass) || { students: [] }).students;

  const isDarkChart =
    typeof document !== "undefined" &&
    document.documentElement?.getAttribute("data-theme") === "dark";
  const chartTextColor = isDarkChart ? "#cbd5e1" : "#334155";

  const completionChart = {
    labels: classStats.map((s) => s.className),
    datasets: [
      {
        label: "Results recorded",
        data: classStats.map((s) => s.resultsUploaded),
        backgroundColor: "#022aa1",
        borderRadius: 6,
        barPercentage: 0.68,
      },
      {
        label: "Not recorded",
        data: classStats.map((s) => Math.max(s.totalPupils - s.resultsUploaded, 0)),
        backgroundColor: isDarkChart ? "rgba(217, 83, 79, 0.45)" : "rgba(217, 83, 79, 0.55)",
        borderRadius: 6,
        barPercentage: 0.68,
      },
    ],
  };

  const completionChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: chartTextColor, usePointStyle: true, boxHeight: 8 } },
      tooltip: { callbacks: {
        afterBody: (items) => {
          const stat = classStats[items[0].dataIndex];
          return stat ? `${stat.resultsUploaded} of ${stat.totalPupils} pupils recorded` : "";
        },
      } },
    },
    scales: {
      x: { stacked: true, ticks: { color: chartTextColor }, grid: { display: false } },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: chartTextColor, precision: 0 },
        grid: { color: isDarkChart ? "rgba(148,163,184,0.15)" : "rgba(107,114,128,0.12)" },
      },
    },
  };

  useEffect(() => {
    const fetchExistingResult = async () => {
      // Add checks to ensure all required values are present
      if (!selectedStudent || !studentClassFilter || !termFilter) {
        return;
      }
      
      // Check if studentIdMap is populated
      if (!studentIdMap || Object.keys(studentIdMap).length === 0) {
        return;
      }
      
      if (selectedStudent && studentClassFilter && termFilter) {
        const studentInfo = getStudentInfo(selectedStudent);
        if (!studentInfo) {
          return;
        }

        const studentId = studentInfo.id;
        const studentClassFromDb = studentInfo.class;

        const normalizeClassLabel = (value) =>
          (value || "").toLowerCase().replace(/[^a-z0-9]/g, '');

        const selectedClassNormalized = normalizeClassLabel(studentClassFilter);
        const dbClassNormalized = normalizeClassLabel(studentClassFromDb);

        if (studentClassFilter && selectedClassNormalized && dbClassNormalized && selectedClassNormalized !== dbClassNormalized) {
          toast.warn("Selected class does not match the student's class. Please choose the correct class.");
          setFetchedResultId(null);
          handleClassChange("");
          return;
        }

        const studentClass = studentClassFromDb || studentClassFilter;

        // Normalize class name for subject lookup (numeric year check so
        // Year 10-12 don't collapse onto year1 via an includes("year1") test)
        let classKey = studentClass.toLowerCase().replace(/\s+/g, '');
        
        if (classKey.includes("creche")) classKey = "creche";
        else if (classKey.includes("prenursery") || classKey.includes("pre-nursery")) {
          classKey = classKey.endsWith("2") ? "pre-nursery2" : "pre-nursery1";
        } else if (classKey.includes("nursery")) classKey = "nursery";
        else {
          const m = classKey.match(/year(\d+)/);
          if (m) classKey = `year${Number(m[1])}`;
        }

        const defaultSubjects = schoolSubjects[classKey] || [];

        try {
          const normalizedClassNoSpace = studentClass.replace(/\s+/g, '');
          const classCandidates = Array.from(new Set([studentClass, normalizedClassNoSpace]));

          const { data: existingResult, error } = await supabase
            .from("jmis_result")
            .select("*")
            .eq("studentId", studentId)
            .in("studentClass", classCandidates);

          if (error) {
            throw error;
          }

          // A student with no live jmis_result row starts a fresh current-session
          // entry. Do NOT fall back to jmis_result_history here: the "Start New
          // Session" rollover archives the previous session and clears jmis_result,
          // so re-loading the latest archived row would resurrect old-session results
          // and block new-session entry (this mirrors the staff portal Result page,
          // which already starts clean for a student with no live row).
          const effectiveResult = existingResult;
          
          // Check if we have exactly one result
          if (effectiveResult && effectiveResult.length === 1) {
            const result = effectiveResult[0];
            setFetchedResultId(result.id);

            const isFirstTerm = termFilter === "1st term";
            const isSecondTerm = termFilter === "2nd term";
            const termKey = isFirstTerm
              ? "term1Subjects"
              : isSecondTerm
                ? "term2Subjects"
                : "term3Subjects";

            let rawTermSubjects = result[termKey] || [];
            
            // Normalize and deduplicate subjects
            const normalizedSubjectsMap = new Map();
            
            rawTermSubjects.forEach(subject => {
              const normalizedName = normalizeSubjectName(subject.subjectName);
              const existing = normalizedSubjectsMap.get(normalizedName);
              
              const hasScore = (s) => (
                (s.test && s.test !== "") || 
                (s.project && s.project !== "") || 
                (s.examination && s.examination !== "") ||
                (s.midtermScore && s.midtermScore !== "")
              );
              
              if (!existing) {
                normalizedSubjectsMap.set(normalizedName, { ...subject, subjectName: normalizedName });
              } else {
                // If current has score and existing doesn't, overwrite
                if (hasScore(subject) && !hasScore(existing)) {
                   normalizedSubjectsMap.set(normalizedName, { ...subject, subjectName: normalizedName });
                }
              }
            });
            
            const termSpecificSubjects = Array.from(normalizedSubjectsMap.values());

            // Merge default subjects with result subjects (ensuring no duplicates)
            // We want default subjects first, then any extra subjects from the result
            const resultSubjectNames = termSpecificSubjects.map((sub) => sub.subjectName);
            const mergedSubjects = [...new Set([...defaultSubjects, ...resultSubjectNames])];
            
            setSubjects(mergedSubjects);

            const newScores = mergedSubjects.reduce((acc, subjectName) => {
              const subject = termSpecificSubjects.find(s => s.subjectName === subjectName);

              if (subject) {
                // Determine if the remark is custom or auto by checking against predefined remarks
                const totalScore = parseFloat(subject.test || 0) + 
                  parseFloat(subject.project || 0) + 
                  parseFloat(subject.examination || 0);
                
                const grade = determineGrade(
                  totalScore,
                  getClassLevelGroup(studentClassFilter.toLowerCase())
                );
                
                // Get the predefined remarks for this grade
                const predefinedRemarks = grade && gradeRemarks[grade] ? gradeRemarks[grade] : [];
                
                // Check if the stored remark matches any of the predefined remarks
                const isCustomRemark = subject.remark && !predefinedRemarks.includes(subject.remark);
                
                acc[subjectName] = {
                  test: subject.test || "",
                  project: subject.project || "",
                  examination: subject.examination || "",
                  midtermScore: subject.midtermScore || subject.test || "",
                  remark: subject.remark || "",
                  useCustomRemark: isCustomRemark,
                  customRemark: isCustomRemark ? subject.remark : "",
                };
              } else {
                 // Default empty scores for new/missing subjects
                 acc[subjectName] = { 
                    test: "", 
                    project: "", 
                    examination: "", 
                    midtermScore: "",
                    remark: "", 
                    useCustomRemark: false, 
                    customRemark: "" 
                 };
              }
              return acc;
            }, {});

            const overallKey =
              termFilter === "1st term"
                ? "overall1st"
                : termFilter === "2nd term"
                  ? "overall2nd"
                  : "overall3rd";

            const overallResult = result[overallKey];

            if (overallResult) {
              ["daysPresent", "daysAbsent", "punctuality", "neatness", "honesty", "coOperation",
                "leadership", "helpingOthers", "emotionalStability", "health", "attentiveness",
                "attitudeToSchoolWork", "handWriting", "verbalFrequency", "games",
                "handlingTools", "drawingPainting", "musicalSkills"].forEach((key) => {
                  newScores[key] = { value: overallResult[key] || "" };
              });

              newScores.overallTotalFromDb = overallResult.overallTotal;
              newScores.overallGradeFromDb = overallResult.overallGrade;
              newScores.overallRemarkFromDb = overallResult.overallRemark;
              newScores.overallPrincipalRemarkFromDb = overallResult.overallPrincipalRemark;
              
              const currentSubjects = termSpecificSubjects.map((sub) => sub.subjectName);
              const overallGrade = determineGrade(
                currentSubjects.reduce((sum, subjectName) => {
                  const subject = termSpecificSubjects.find(s => s.subjectName === subjectName);
                  if (subject) {
                    return sum + parseFloat(subject.test || 0) + 
                      parseFloat(subject.project || 0) + 
                      parseFloat(subject.examination || 0);
                  }
                  return sum;
                }, 0) / currentSubjects.length,
                getClassLevelGroup(studentClassFilter.toLowerCase())
              );
              
              const predefinedOverallRemark = overallGrade && gradeRemarks[overallGrade] ? gradeRemarks[overallGrade][2] : "";
              
              const isCustomOverallRemark = overallResult.overallRemark && overallResult.overallRemark !== predefinedOverallRemark;
              
              newScores.useCustomOverallRemark = isCustomOverallRemark;
              newScores.customOverallRemark = isCustomOverallRemark ? overallResult.overallRemark : "";
            }

            setScores(newScores);
            setTermSubjects({
              term1Subjects: result.term1Subjects || [],
              term2Subjects: result.term2Subjects || [],
              term3Subjects: result.term3Subjects || [],
              overall1st: result.overall1st || {},
              overall2nd: result.overall2nd || {},
              overall3rd: result.overall3rd || {},
            });
          } else if (existingResult && existingResult.length > 1) {
            // Handle multiple results case
            toast.warn("Multiple results found. Using the first result.");
            const result = existingResult[0];
            setFetchedResultId(result.id);

            const isFirstTerm = termFilter === "1st term";
            const isSecondTerm = termFilter === "2nd term";
            const termKey = isFirstTerm
              ? "term1Subjects"
              : isSecondTerm
                ? "term2Subjects"
                : "term3Subjects";

            let rawTermSubjects = result[termKey] || [];
            
            // Normalize and deduplicate subjects
            const normalizedSubjectsMap = new Map();
            
            rawTermSubjects.forEach(subject => {
              const normalizedName = normalizeSubjectName(subject.subjectName);
              const existing = normalizedSubjectsMap.get(normalizedName);
              
              const hasScore = (s) => (
                (s.test && s.test !== "") || 
                (s.project && s.project !== "") || 
                (s.examination && s.examination !== "") ||
                (s.midtermScore && s.midtermScore !== "")
              );
              
              if (!existing) {
                normalizedSubjectsMap.set(normalizedName, { ...subject, subjectName: normalizedName });
              } else {
                // If current has score and existing doesn't, overwrite
                if (hasScore(subject) && !hasScore(existing)) {
                   normalizedSubjectsMap.set(normalizedName, { ...subject, subjectName: normalizedName });
                }
              }
            });
            
            const termSpecificSubjects = Array.from(normalizedSubjectsMap.values());

            // Merge default subjects with result subjects (ensuring no duplicates)
            // We want default subjects first, then any extra subjects from the result
            const resultSubjectNames = termSpecificSubjects.map((sub) => sub.subjectName);
            const mergedSubjects = [...new Set([...defaultSubjects, ...resultSubjectNames])];
            
            setSubjects(mergedSubjects);

            const newScores = mergedSubjects.reduce((acc, subjectName) => {
              const subject = termSpecificSubjects.find(s => s.subjectName === subjectName);

              if (subject) {
                // Determine if the remark is custom or auto by checking against predefined remarks
                const totalScore = parseFloat(subject.test || 0) + 
                  parseFloat(subject.project || 0) + 
                  parseFloat(subject.examination || 0);
                
                const grade = determineGrade(
                  totalScore,
                  getClassLevelGroup(studentClassFilter.toLowerCase())
                );
                
                // Get the predefined remarks for this grade
                const predefinedRemarks = grade && gradeRemarks[grade] ? gradeRemarks[grade] : [];
                
                // Check if the stored remark matches any of the predefined remarks
                const isCustomRemark = subject.remark && !predefinedRemarks.includes(subject.remark);
                
                acc[subjectName] = {
                  test: subject.test || "",
                  project: subject.project || "",
                  examination: subject.examination || "",
                  remark: subject.remark || "",
                  useCustomRemark: isCustomRemark,
                  customRemark: isCustomRemark ? subject.remark : "",
                  midtermScore: subject.midtermScore || "",
                  midtermGrade: subject.midtermGrade || "",
                };
              } else {
                 // Default empty scores for new/missing subjects
                 acc[subjectName] = { 
                    test: "", 
                    project: "", 
                    examination: "", 
                    remark: "", 
                    useCustomRemark: false, 
                    customRemark: "",
                    midtermScore: "",
                    midtermGrade: ""
                 };
              }
              return acc;
            }, {});

            const overallKey =
              termFilter === "1st term"
                ? "overall1st"
                : termFilter === "2nd term"
                  ? "overall2nd"
                  : "overall3rd";

            const overallResult = result[overallKey];

            if (overallResult) {
              ["daysPresent", "daysAbsent", "punctuality", "neatness", "honesty", "coOperation",
                "leadership", "helpingOthers", "emotionalStability", "health", "attentiveness",
                "attitudeToSchoolWork", "handWriting", "verbalFrequency", "games",
                "handlingTools", "drawingPainting", "musicalSkills"].forEach((key) => {
                  newScores[key] = { value: overallResult[key] || "" };
              });

              newScores.overallTotalFromDb = overallResult.overallTotal;
              newScores.overallGradeFromDb = overallResult.overallGrade;
              newScores.overallRemarkFromDb = overallResult.overallRemark;
              newScores.overallPrincipalRemarkFromDb = overallResult.overallPrincipalRemark;
              
              const currentSubjects = termSpecificSubjects.map((sub) => sub.subjectName);
              const overallGrade = determineGrade(
                currentSubjects.reduce((sum, subjectName) => {
                  const subject = termSpecificSubjects.find(s => s.subjectName === subjectName);
                  if (subject) {
                    return sum + parseFloat(subject.test || 0) + 
                      parseFloat(subject.project || 0) + 
                      parseFloat(subject.examination || 0);
                  }
                  return sum;
                }, 0) / currentSubjects.length,
                getClassLevelGroup(studentClassFilter.toLowerCase())
              );
              
              const predefinedOverallRemark = overallGrade && gradeRemarks[overallGrade] ? gradeRemarks[overallGrade][2] : "";
              
              const isCustomOverallRemark = overallResult.overallRemark && overallResult.overallRemark !== predefinedOverallRemark;
              
              newScores.useCustomOverallRemark = isCustomOverallRemark;
              newScores.customOverallRemark = isCustomOverallRemark ? overallResult.overallRemark : "";
            }

            setScores(newScores);
            setTermSubjects({
              term1Subjects: result.term1Subjects || [],
              term2Subjects: result.term2Subjects || [],
              term3Subjects: result.term3Subjects || [],
              overall1st: result.overall1st || {},
              overall2nd: result.overall2nd || {},
              overall3rd: result.overall3rd || {},
            });
          } else {
            setFetchedResultId(null);
            handleClassChange(studentClassFilter); // Reset the subjects and scores
          }
        } catch (error) {
          toast.error("Error in Response, Reload application! Or Make sure you have selected the correct student, class and term.");
        }
      }
    };

    fetchExistingResult();
  }, [selectedStudent, studentClassFilter, termFilter, studentIdMap]);

  const termOptions = ["1st term", "2nd term", "3rd term"];

  // Update subjects and initialize score structure when student class is selected
  const handleClassChange = (newClass) => {
    setStudentClassFilter(newClass);
    let classKey = newClass.toLowerCase().replace(/\s+/g, '');

    // Map a class label to its schoolSubjects key; numeric check so Year 10-12
    // resolve correctly (an includes("year1") test would match year10 first)
    if (classKey.includes("creche")) classKey = "creche";
    else if (classKey.includes("prenursery") || classKey.includes("pre-nursery")) {
      classKey = classKey.endsWith("2") ? "pre-nursery2" : "pre-nursery1";
    } else if (classKey.includes("nursery")) classKey = "nursery";
    else {
      const m = classKey.match(/year(\d+)/);
      if (m) classKey = `year${Number(m[1])}`;
    }

    const newSubjects = schoolSubjects[classKey] || [];
    setSubjects(newSubjects);

    const classLevelGroup = getClassLevelGroup(classKey);
    
    const newScores = newSubjects.reduce((acc, subject) => {
      // Use same structure for all class levels
      acc[subject] = { test: "", project: "", examination: "", remark: "", useCustomRemark: false, customRemark: "", midtermScore: "", midtermGrade: "" };
      return acc;
    }, {});
    
    // Add overall evaluation fields
    newScores.useCustomOverallRemark = false;
    newScores.customOverallRemark = "";
    
    setScores(newScores);
  }


  const handleInputChange = (field, key, value) => {
    // Cap the score fields at the marks they can hold, and remember which cell was
    // capped so the teacher can see why the number changed under the cursor
    const capped = clampScore(key, value);
    setClampedCells((prev) => {
      const cellKey = `${field}::${key}`;
      if (!capped.clamped) {
        if (!prev[cellKey]) return prev;
        const cleared = { ...prev };
        delete cleared[cellKey];
        return cleared;
      }
      return { ...prev, [cellKey]: SCORE_MAX[key] };
    });

    setScores((prevScores) => {
      let newScores;
      
      // If key is empty string, treat as a simple value assignment
      if (key === "") {
        newScores = {
          ...prevScores,
          [field]: value,
        };
      } else {
        // Otherwise, treat as a nested object property
        newScores = {
          ...prevScores,
          [field]: {
            ...prevScores[field],
            [key]: capped.value,
          }
        };
      }
      
      console.log("Updated scores:", newScores);
      return newScores;
    });
  }

  // Props for a score cell: the allowed maximum plus the warning styling that
  // stays on the input until the teacher edits it again
  const scoreCellProps = (subject, key) => {
    const max = SCORE_MAX[key];
    const cappedAt = clampedCells[`${subject}::${key}`];
    return {
      max: max !== undefined ? max : undefined,
      min: max !== undefined ? 0 : undefined,
      style: cappedAt
        ? { borderColor: "#dc3545", boxShadow: "0 0 0 2px rgba(220, 53, 69, 0.2)" }
        : undefined,
      title: cappedAt
        ? `Capped at ${max} marks — a ${key} entry cannot hold more`
        : max !== undefined
          ? `Maximum ${max} marks`
          : undefined,
    };
  };
  const calculateTotal = (subjectScores, classLevelGroup) => {
    // For all classes including early years: Test + Project + Examination = Total
    const test = parseFloat(subjectScores.test || 0);
    const project = parseFloat(subjectScores.project || 0);
    const examination = parseFloat(subjectScores.examination || 0);
    return test + project + examination;
  }
  const determineGrade = (total, classLevelGroup) => {
    // Use primary/secondary grading system for all levels
    if (total >= 96) return "A+";
    if (total >= 86) return "A";
    if (total >= 80) return "B+";
    if (total >= 70) return "B";
    if (total >= 66) return "C+";
    if (total >= 56) return "C";
    if (total >= 46) return "D";
    return "E";
  }

  const calculateMidtermGrade = (score) => {
    score = parseFloat(score || 0);
    if (score >= 29) return "A+";
    if (score >= 26) return "A";
    if (score >= 24) return "B+";
    if (score >= 21) return "B";
    if (score >= 20) return "C+";
    if (score >= 17) return "C";
    if (score >= 14) return "D";
    return "E";
  };

  const calculateOverallTotal = (studentClass) => {
    // Use the correct class name for determining the level group
    const classLevelGroup = getClassLevelGroup(studentClass.toLowerCase());
    return subjects.reduce((sum, subject) => {
      return sum + calculateTotal(scores[subject], classLevelGroup);
    }, 0);
  }
  const calculateOverallGrade = (studentClass) => {
    // Use the correct class name for determining the level group
    const classLevelGroup = getClassLevelGroup(studentClass.toLowerCase());
    const overallTotal = calculateOverallTotal(studentClass);
    const average = subjects.length > 0 ? overallTotal / subjects.length : 0;
    
    if (purpose === 'midterm') {
      return calculateMidtermGrade(Math.round(average));
    }

    return determineGrade(average, classLevelGroup);
  }
  const overallRemark = (studentClass) => {
    const grade = calculateOverallGrade(studentClass);
    // Check if grade exists in gradeRemarks before accessing
    if (grade && gradeRemarks[grade]) {
      return gradeRemarks[grade][2];
    }
    return "";
  }
  
  const overallPrincipalRemark = (studentClass) => {
    const grade = calculateOverallGrade(studentClass);
    // Check if grade exists in gradeRemarks before accessing
    if (grade && gradeRemarks[grade]) {
      return gradeRemarks[grade][1];
    }
    return "";
  }

  const gradeRemarks = {
    "A+": ["Excellent", "Outstanding", "Keep it up"],
    "A": ["Very good", "Outstanding", "Great effort"],
    "B+": ["Good", "Satisfactory", "More effort"],
    "B": ["Good", "Satisfactory", "Work harder"],
    "C+": ["Fair", "Below average", "More effort"],
    "C": ["Fair", "Needs attention", "Focus more"],
    "D": ["Poor", "Unacceptable", "Serious help needed"],
    "E": ["Poor", "Failing", "Immediate help"]
  }

  const fetchStudentToken = async (studentName, studentClass) => {
    console.log(`Fetching token for student: ${studentName}, class: ${studentClass}`);
    // Don't add spaces to class names - they should match the database format
    try {
      // First try with the class from studentIdMap if available
      const studentInfo = getStudentInfo(studentName);
      if (studentInfo && studentInfo.class) {
        const { data: data1, error: error1 } = await supabase
          .from("jmis_student")
          .select("token")
          .eq("name", studentName)
          .eq("class", studentInfo.class);
        
        if (data1 && data1.length > 0 && !error1) {
          const token = data1[0]?.token || null;
          
          if (!token) {
            toast.warn("Student found but no token assigned. Please contact administrator.");
            return null;
          }
          return token;
        }
      }

      // If that didn't work, try exact match with provided class
      let { data, error } = await supabase
        .from("jmis_student")
        .select("token")
        .eq("name", studentName)
        .eq("class", studentClass);

      // If still no results found, try case-insensitive match for the class
      if ((!data || data.length === 0) && !error) {
        const { data: caseInsensitiveData, error: caseInsensitiveError } = await supabase
          .from("jmis_student")
          .select("token")
          .eq("name", studentName)
          .ilike("class", studentClass); // ilike for case-insensitive match
        
        if (!caseInsensitiveError) {
          data = caseInsensitiveData;
          error = caseInsensitiveError;
        }
      }

      if (error) {
        throw error;
      }

      // Check if we have exactly one result
      if (data && data.length === 1) {
        const token = data[0]?.token || null;
        
        if (!token) {
          toast.warn("Student found but no token assigned. Please contact administrator.");
          return null;
        }
        return token;
      } else if (data && data.length > 1) {
        // Handle multiple results case
        toast.warn("Multiple students found with the same name and class. Using the first result.");
        const token = data[0]?.token || null;
        if (!token) {
          toast.warn("Student found but no token assigned. Please contact administrator.");
          return null;
        }
        return token;
      } else {
        // No results found
        toast.warn("No student found with the given name and class.");
        return null;
      }
    } catch (error) {
      toast.error("Error fetching student token: " + error.message);
      return null;
    }
  }

  const uploadResults = async () => {
    if (!selectedStudent || !studentClassFilter || !termFilter) {
      toast.warn("Please fill in all fields before uploading results.");
      return;
    }

    const studentInfo = getStudentInfo(selectedStudent);
    if (!studentInfo) {
      toast.error("Please select a valid student.");
      return;
    }

    // Set loading state
    setIsUploading(true);

    const studentId = studentInfo.id;
    // Use the class from studentIdMap for consistency with database
    const studentClass = studentInfo.class || studentClassFilter;

    // Fetch the token for the selected student and class
    const token = await fetchStudentToken(selectedStudent, studentClass);
    if (!token) {
      // The specific error message is now handled in fetchStudentToken
      setIsUploading(false);
      return;
    }

    const termKey =
      termFilter === "1st term"
        ? "term1Subjects"
        : termFilter === "2nd term"
          ? "term2Subjects"
          : "term3Subjects";

    const termSubjectsToUpload = subjects.map((subject) => {
      const subjectScores = scores[subject] || {};
      // Use the correct class name for determining the level group
      const classLevelGroup = getClassLevelGroup(studentClass.toLowerCase());
      
      // Determine which remark to save based on user selection
      let remarkToSave = "";
      if (subjectScores.useCustomRemark) {
        remarkToSave = subjectScores.customRemark ?? "";
      } else {
        remarkToSave = subjectScores.remark ?? "";
      }

      if (purpose === "midterm") {
          const midtermScore = subjectScores.midtermScore ?? "";
          const midtermGrade = calculateMidtermGrade(midtermScore);
          return {
            subjectName: subject,
            test: midtermScore, // Map midterm score to test field for compatibility
            project: "0",
            examination: "0",
            total: midtermScore, // Total is just the score for now
            grade: midtermGrade,
            remark: remarkToSave,
            midtermScore: midtermScore,
            midtermGrade: midtermGrade
          };
      } else {
          // For all classes, we save test, project, examination with calculated total and grade
          const total = calculateTotal(subjectScores, classLevelGroup);
          
          return {
            subjectName: subject,
            test: subjectScores.test ?? "0",
            project: subjectScores.project ?? "0",
            examination: subjectScores.examination ?? "0",
            total: total,
            grade: determineGrade(total, classLevelGroup),
            remark: remarkToSave,
            midtermScore: subjectScores.midtermScore ?? "", // Keep existing if needed
            midtermGrade: calculateMidtermGrade(subjectScores.midtermScore) // Keep existing if needed
          }; 
      }
    });

    const overallKey =
      termFilter === "1st term"
        ? "overall1st"
        : termFilter === "2nd term"
          ? "overall2nd"
          : "overall3rd";

    // Determine which overall remark to save based on user selection
    let overallRemarkToSave = "";
    if (scores.useCustomOverallRemark) {
      overallRemarkToSave = scores.customOverallRemark || "";
    } else {
      overallRemarkToSave = overallRemark(studentClass);
    }
    
    // Determine which principal remark to save based on user selection
    let overallPrincipalRemarkToSave = "";
    if (scores.useCustomPrincipalRemark) {
      overallPrincipalRemarkToSave = scores.customPrincipalRemark || "";
    } else {
      overallPrincipalRemarkToSave = overallPrincipalRemark(studentClass);
    }
    
    const termOverallToUpload = {
      overallTotal: calculateOverallTotal(studentClass),
      overallGrade: calculateOverallGrade(studentClass),
      overallRemark: overallRemarkToSave,
      overallPrincipalRemark: overallPrincipalRemarkToSave,
      daysPresent: scores["daysPresent"]?.value || "0",
      daysAbsent: scores["daysAbsent"]?.value || "0",
      punctuality: scores["punctuality"]?.value || "",
      neatness: scores["neatness"]?.value || "",
      honesty: scores["honesty"]?.value || "",
      coOperation: scores["coOperation"]?.value || "",
      leadership: scores["leadership"]?.value || "",
      helpingOthers: scores["helpingOthers"]?.value || "",
      emotionalStability: scores["emotionalStability"]?.value || "",
      health: scores["health"]?.value || "",
      attentiveness: scores["attentiveness"]?.value || "",
      attitudeToSchoolWork: scores["attitudeToSchoolWork"]?.value || "",
      handWriting: scores["handWriting"]?.value || "",
      verbalFrequency: scores["verbalFrequency"]?.value || "",
      games: scores["games"]?.value || "",
      handlingTools: scores["handlingTools"]?.value || "",
      drawingPainting: scores["drawingPainting"]?.value || "",
      musicalSkills: scores["musicalSkills"]?.value || "",
      debitAmount: scores["debitAmount"]?.value || "",
    }

    const updatedResultData = {
      studentId,
      studentName: selectedStudent,
      studentClass: studentClass, // Use the correct class name from studentIdMap
      // Preserve data for other terms when updating
      ...(fetchedResultId && {
        term1Subjects: (termFilter === "1st term") ? termSubjectsToUpload : (termSubjects.term1Subjects || []),
        term2Subjects: (termFilter === "2nd term") ? termSubjectsToUpload : (termSubjects.term2Subjects || []),
        term3Subjects: (termFilter === "3rd term") ? termSubjectsToUpload : (termSubjects.term3Subjects || []),
        overall1st: (termFilter === "1st term") ? termOverallToUpload : (termSubjects.overall1st || {}),
        overall2nd: (termFilter === "2nd term") ? termOverallToUpload : (termSubjects.overall2nd || {}),
        overall3rd: (termFilter === "3rd term") ? termOverallToUpload : (termSubjects.overall3rd || {}),
      }),
      // If creating new record, only set data for current term
      ...(!fetchedResultId && {
        [termKey]: termSubjectsToUpload,
        [overallKey]: termOverallToUpload,
      }),
      token
    }

    try {
      if (fetchedResultId) {
        // Update record
        const { error } = await supabase
          .from("jmis_result")
          .update(updatedResultData)
          .eq("id", fetchedResultId);

        if (error) {
          toast.error("Error in Response, Reload application! ");
          setIsUploading(false);
          return;
        }
        
        // Send email notification for updated results
        const emailSubject = 'Student Result Updated';
        const currentUserEmail = getCurrentUserEmail();
        
        const detailedScores = termSubjectsToUpload.map(s => {
          if (purpose === "midterm") {
             return `${s.subjectName}: Midterm=${s.midtermScore || '-'}`;
          } else {
             return `${s.subjectName}: Test=${s.test||'-'}, Proj=${s.project||'-'}, Exam=${s.examination||'-'}, Total=${s.total}, Grade=${s.grade}`;
          }
        }).join('\n');

        const emailMessage = `Student result has been updated by ${currentUserEmail}:

Student Name: ${selectedStudent}
Class: ${studentClass}
Term: ${termFilter}
Number of Subjects: ${subjects.length}

Updated Scores:
${detailedScores}`;

            // Delivered to the addresses this school configures — see src/utils/resultRecipients.js
    const recipients = await resolveResultRecipients(supabase);
        await sendEmailNotification(supabase, emailSubject, emailMessage, recipients);
        
        toast.success("Results updated successfully!");

        // Audit: result updated
        logAction(supabase, {
          email: getCurrentUserEmail(),
          role: getAuditRole(),
          action: "result_update",
          targetTable: "jmis_result",
          recordId: fetchedResultId,
          details: { studentName: selectedStudent, class: studentClass, term: termFilter, subjects: subjects.length },
        });
      } else {
        // Create new record
        const { error } = await supabase.from("jmis_result").insert([updatedResultData]);

        if (error) {
          toast.error("Error in Response, Reload application! ");
          setIsUploading(false);
          return;
        }
        
        // Send email notification for new results
        const emailSubject = 'New Student Result Uploaded';
        const currentUserEmail = getCurrentUserEmail();
        
        const detailedScores = termSubjectsToUpload.map(s => {
          if (purpose === "midterm") {
             return `${s.subjectName}: Midterm=${s.midtermScore || '-'}`;
          } else {
             return `${s.subjectName}: Test=${s.test||'-'}, Proj=${s.project||'-'}, Exam=${s.examination||'-'}, Total=${s.total}, Grade=${s.grade}`;
          }
        }).join('\n');

        const emailMessage = `New student result has been uploaded by ${currentUserEmail}:

Student Name: ${selectedStudent}
Class: ${studentClass}
Term: ${termFilter}
Number of Subjects: ${subjects.length}

Scores:
${detailedScores}`;

            // Delivered to the addresses this school configures — see src/utils/resultRecipients.js
    const recipients = await resolveResultRecipients(supabase);
        await sendEmailNotification(supabase, emailSubject, emailMessage, recipients);
        
        toast.success("Results uploaded successfully!");

        // Audit: result uploaded
        logAction(supabase, {
          email: getCurrentUserEmail(),
          role: getAuditRole(),
          action: "result_upload",
          targetTable: "jmis_result",
          details: { studentName: selectedStudent, class: studentClass, term: termFilter, subjects: subjects.length },
        });
      }
    } catch (err) {
      toast.error("Error in Response, Reload application! ");
      setIsUploading(false);
      return;
    } finally {
      // Reset loading state
      setIsUploading(false);
    }
  }

  // Function to update the `uploadResult` field in Supabase
  const finalizeAndPublishResult = async () => {
    if (!fetchedResultId) {
      toast.warn("No result has been uploaded yet to finalize.");
      return;
    }

    try {
      // First, get the result details for the email notification
      const { data: resultData, error: fetchError } = await supabase
        .from("jmis_result")
        .select("studentName, studentClass, term1Subjects, term2Subjects, term3Subjects")
        .eq("id", fetchedResultId)
        .single();

      if (fetchError) throw fetchError;

      const { /* data, */ error } = await supabase
        .from("jmis_result")
        .update({ uploadResult: true })
        .eq("id", fetchedResultId);

      if (error) throw error;
      
      // Determine which term has data
      let termInfo = "Unknown Term";
      let termSubjects = [];
      if (resultData.term1Subjects && resultData.term1Subjects.length > 0) {
        termInfo = "1st term";
        termSubjects = resultData.term1Subjects;
      } else if (resultData.term2Subjects && resultData.term2Subjects.length > 0) {
        termInfo = "2nd term";
        termSubjects = resultData.term2Subjects;
      } else if (resultData.term3Subjects && resultData.term3Subjects.length > 0) {
        termInfo = "3rd term";
        termSubjects = resultData.term3Subjects;
      }
      
      // Send email notification for published results
      const emailSubject = 'Student Result Published';
      const currentUserEmail = getCurrentUserEmail();
      const emailMessage = `Student result has been published by ${currentUserEmail}:

Student Name: ${resultData.studentName}
Class: ${resultData.studentClass}
Term: ${termInfo}
Number of Subjects: ${termSubjects.length}`;
      await sendEmailNotification(supabase, emailSubject, emailMessage);
      
      toast.success("Result finalized and Uploaded");
    } catch (error) {
      toast.error("Error finalizing result: " + error.message);
    }
  }

  const handleClosePreviewModal = () => setShowPreviewModal(false);

  return (
    <div>
      {/* <NavbarComponent /> */}
      <ToastContainer />
      <div className="res-page">
        {/* Page header */}
        <div className="res-head">
          <div>
            <h1 className="res-title">
              <span className="res-title-ic"><RiUploadCloud2Line /></span> Upload Results Session
            </h1>
            <p className="res-sub">Record, review and publish student results for each term.</p>
          </div>
          <div className="res-pills">
            {studentClassFilter && (
              <span className="res-pill"><RiGraduationCapLine /> {studentClassFilter}</span>
            )}
            {termFilter && (
              <span className="res-pill"><RiTimeLine /> {termFilter}</span>
            )}
            <span className="res-pill alt">
              {purpose === "midterm" ? "Midterm Result" : "Full Term Result"}
            </span>
          </div>
        </div>

        {/* Session toolbar — student, class, term and result type */}
        <div className="res-session">
          <div className="res-field">
            <label htmlFor="studentsAutocomplete" className="res-label">
              <RiUserLine /> Student Name
            </label>
            <input
              id="studentsAutocomplete"
              className="res-input"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              list="studentsOptionsList"
              placeholder="Search student name..."
            />
            <datalist id="studentsOptionsList">
              {studentsOptions.map((studentName, index) => (
                <option key={index} value={studentName}>
                  {studentName}
                </option>
              ))}
            </datalist>
          </div>

          <div className="res-field">
            <label htmlFor="classAutocomplete" className="res-label">
              <RiGraduationCapLine /> Class
            </label>
            <select
              id="classAutocomplete"
              className="res-input"
              value={studentClassFilter}
              onChange={(e) => handleClassChange(e.target.value)}
            >
              <option value="">Select Student Class</option>
              {classOptions.map((classOption, index) => (
                <option key={index} value={classOption}>
                  {classOption}
                </option>
              ))}
            </select>
          </div>

          <div className="res-field">
            <label htmlFor="termAutocomplete" className="res-label">
              <RiTimeLine /> Term
            </label>
            <select
              id="termAutocomplete"
              className="res-input"
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value)}
            >
              <option value="">Select Term</option>
              {termOptions.map((term, index) => (
                <option key={index} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </div>

          <div className="res-field">
            <span className="res-label"><RiStarLine /> Result Type</span>
            <div className="res-seg" role="group" aria-label="Result type">
              <button
                type="button"
                className={`res-seg-btn${purpose === "fullterm" ? " active" : ""}`}
                onClick={() => setPurpose("fullterm")}
              >
                Full Term
              </button>
              <button
                type="button"
                className={`res-seg-btn${purpose === "midterm" ? " active" : ""}`}
                onClick={() => setPurpose("midterm")}
              >
                Midterm
              </button>
            </div>
          </div>
        </div>

        {/* Role-aware action bar */}
        <div className="res-actions">
          {(userAuth && userAuth.some && userAuth.some(auth => auth.email === user?.user_metadata?.email)) && (
            <button className="res-btn green" onClick={finalizeAndPublishResult}>
              <RiCheckLine /> Finish & Publish Result
            </button>
          )}
          <button
            className="res-btn primary"
            onClick={uploadResults}
            disabled={isUploadButtonDisabled || isUploading}
          >
            {isUploading ? (
              <>
                <Spinner animation="border" size="sm" /> Uploading...
              </>
            ) : (
              <>
                <RiUploadCloud2Line /> Upload Results
              </>
            )}
          </button>
          {(isTeacher || isDev || (userAuth && userAuth.some && userAuth.some(auth => auth.email === user?.user_metadata?.email))) && (
            <>
              <button
                className="res-btn amber"
                onClick={() => setShowPreviewModal(true)} // Open the preview modal
                disabled={!selectedStudent || !studentClassFilter || !termFilter}
              >
                <RiEyeLine /> Preview Result
              </button>
              <button
                className={`res-btn soft${showClassStats ? " on" : ""}`}
                onClick={() => setShowClassStats(!showClassStats)} // Toggle visibility
              >
                <RiBarChart2Line /> {showClassStats ? "Hide Progress" : "Result Progress"}
              </button>
              <button
                className="res-btn blue"
                onClick={() => setShowExportModal(true)}
              >
                <FaFileExcel /> Export Results
              </button>
            </>
          )}
        </div>
        
        {showClassStats && (
          <div className="res-progress">
            <div className="res-progress-grid">
              <div className="res-card">
                <div className="res-card-head">
                  <RiBarChart2Line /> Recorded vs Not Recorded
                  <span className="res-card-sub">
                    {termFilter ? `${termFilter} • ${purpose === "midterm" ? "Midterm" : "Full Term"}` : "Select a term"}
                  </span>
                </div>
                {classStats.length === 0 ? (
                  <div className="res-empty">
                    {termFilter
                      ? "No classes with enrolled students yet."
                      : "Select a term above to load class statistics."}
                  </div>
                ) : (
                  <div className="res-chartbox">
                    <Bar data={completionChart} options={completionChartOptions} />
                  </div>
                )}
              </div>
              <div className="res-card">
                <div className="res-card-head">
                  <RiGroupLine /> Result Completeness
                  <select
                    className="res-mini-select"
                    value={activeStatsClass}
                    onChange={(e) => setStatsClass(e.target.value)}
                  >
                    {classStats.map((s) => (
                      <option key={s.className} value={s.className}>
                        {s.className} ({s.resultsUploaded}/{s.totalPupils} recorded)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="res-stulist">
                  {statsStudents.length === 0 && (
                    <div className="res-empty">No students found for this class yet.</div>
                  )}
                  {statsStudents.map((st) => (
                    <div key={st.name} className="res-stu">
                      <div className="res-stu-top">
                        <span className="res-stu-name">{st.name}</span>
                        {st.recorded && st.percent >= 100 ? (
                          <span className="res-badge ok"><RiCheckLine /> Complete</span>
                        ) : st.recorded && st.percent > 0 ? (
                          <span className="res-badge part"><RiInformationLine /> {st.scoredCount}/{st.subjectCount} subjects</span>
                        ) : (
                          <span className="res-badge none"><RiCloseLine /> Not recorded</span>
                        )}
                      </div>
                      <div className="res-bar">
                        <div
                          className={`res-bar-fill${st.recorded && st.percent >= 100 ? " ok" : ""}`}
                          style={{ width: `${Math.max(st.percent, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        
        <Modal show={showExportModal} onHide={() => setShowExportModal(false)} centered contentClassName="res-modal-content">
          <div className="res-modal-head">
            <div className="t"><FaFileExcel /> Export Results to Excel</div>
            <div className="s">Download recorded results as a spreadsheet.</div>
          </div>
          <Modal.Body className="res-modal-body">
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Select Term</Form.Label>
                  <Form.Select value={exportTerm} onChange={(e) => setExportTerm(e.target.value)}>
                    <option value="1st Term">1st Term</option>
                    <option value="2nd Term">2nd Term</option>
                    <option value="3rd Term">3rd Term</option>
                  </Form.Select>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Result Type</Form.Label>
                  <Form.Select value={exportType} onChange={(e) => setExportType(e.target.value)}>
                    <option value="midterm">Midterm</option>
                    <option value="general">General Exam</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Scope</Form.Label>
                  <Form.Select value={exportScope} onChange={(e) => setExportScope(e.target.value)}>
                    <option value="all">All Students</option>
                    <option value="individual">Individual Student</option>
                  </Form.Select>
                </Form.Group>

                {exportScope === 'individual' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Student Name</Form.Label>
                    <Form.Control
                      type="text"
                      list="export-students-list"
                      placeholder="Enter or Select Student Name"
                      value={exportStudentName}
                      onChange={(e) => setExportStudentName(e.target.value)}
                    />
                    <datalist id="export-students-list">
                      {studentsOptions.map((studentName, index) => (
                        <option key={index} value={studentName} />
                      ))}
                    </datalist>
                  </Form.Group>
                )}
              </Form>
          </Modal.Body>
          <div className="res-modal-foot">
            <button className="res-cancel" onClick={() => setShowExportModal(false)}>
              Cancel
            </button>
            <button className="res-btn primary" onClick={handleExport}>
              <RiDownloadLine /> Export
            </button>
          </div>
        </Modal>

        <div className="res-card res-tablecard">
          <div className="res-card-head">
            <RiClipboardLine /> {purpose === "midterm" ? "Midterm Scores" : "Subject Scores"}
            <span className="res-card-sub">{selectedStudent ? selectedStudent : "Select a student to enter scores"}</span>
          </div>
          <div className="res-tablewrap">
        <table className="table res-table">
          <thead>
            <tr>
              <th>Subject</th>
              {purpose === "midterm" ? (
                <>
                  <th>Midterm Score (30)</th>
                  <th>Grade</th>
                  <th>Teacher&apos;s Remark</th>
                </>
              ) : (
                <>
                  <th>Test</th>
                  <th>Project</th>
                  <th>Examination</th>
                  <th>Total (100)</th>
                  <th>Grade</th>
                  <th>Teacher&apos;s Remark</th>
                </>
              )}
            </tr>
          </thead><tbody>
            {subjects.map((subject) => (
              <tr key={subject}>
                <td className="res-subject-cell">{subject}</td>
                {purpose === "midterm" ? (
                  <>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Score (30)"
                        {...scoreCellProps(subject, "midtermScore")}
                        value={scores[subject]?.midtermScore ?? ""}
                        onChange={(e) =>
                          handleInputChange(subject, "midtermScore", e.target.value)
                        }
                      />
                    </td>
                    <td><span className="res-grade-chip">{calculateMidtermGrade(scores[subject]?.midtermScore)}</span></td>
                    <td>
                      <div className="d-flex flex-column gap-2">
                        <div className="d-flex gap-3">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name={`remarkType-${subject}`}
                              id={`autoRemark-${subject}`}
                              checked={!scores[subject]?.useCustomRemark}
                              onChange={() => handleInputChange(subject, "useCustomRemark", false)}
                            />
                            <label className="form-check-label" htmlFor={`autoRemark-${subject}`}>
                              Auto
                            </label>
                          </div>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name={`remarkType-${subject}`}
                              id={`customRemark-${subject}`}
                              checked={scores[subject]?.useCustomRemark}
                              onChange={() => handleInputChange(subject, "useCustomRemark", true)}
                            />
                            <label className="form-check-label" htmlFor={`customRemark-${subject}`}>
                              Custom
                            </label>
                          </div>
                        </div>
                        
                        {!scores[subject]?.useCustomRemark && (
                          <select
                            className="form-control"
                            value={scores[subject]?.remark || ""}
                            onChange={(e) =>
                              handleInputChange(subject, "remark", e.target.value)
                            }
                          >
                            <option value="">Select Auto Remark</option>
                            {gradeRemarks[
                              calculateMidtermGrade(scores[subject]?.midtermScore)
                            ]?.map((remark, index) => (
                              <option key={index} value={remark}>
                                {remark}
                              </option>
                            ))}
                          </select>
                        )}
                        
                        {scores[subject]?.useCustomRemark && (
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter custom remark"
                            value={scores[subject]?.customRemark || ""}
                            onChange={(e) =>
                              handleInputChange(subject, "customRemark", e.target.value)
                            }
                          />
                        )}
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Test (30)"
                        {...scoreCellProps(subject, "test")}
                        value={scores[subject]?.test ?? ""}
                        onChange={(e) =>
                          handleInputChange(subject, "test", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Project (10)"
                        {...scoreCellProps(subject, "project")}
                        value={scores[subject]?.project ?? ""}
                        onChange={(e) =>
                          handleInputChange(subject, "project", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Examination (60)"
                        {...scoreCellProps(subject, "examination")}
                        value={scores[subject]?.examination ?? ""}
                        onChange={(e) =>
                          handleInputChange(subject, "examination", e.target.value)
                        }
                      />
                    </td>
                    
                      <td className="fw-bold">{calculateTotal(scores[subject], getClassLevelGroup(studentClassFilter.toLowerCase()))}</td>
                    <td><span className="res-grade-chip">{determineGrade(calculateTotal(scores[subject], getClassLevelGroup(studentClassFilter.toLowerCase())), getClassLevelGroup(studentClassFilter.toLowerCase()))}</span></td>
                    <td>
                      <div className="d-flex flex-column gap-2">
                        {/* Radio buttons to choose between auto-generated and custom remark */}
                        <div className="d-flex gap-3">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name={`remarkType-${subject}`}
                              id={`autoRemark-${subject}`}
                              checked={!scores[subject]?.useCustomRemark}
                              onChange={() => handleInputChange(subject, "useCustomRemark", false)}
                            />
                            <label className="form-check-label" htmlFor={`autoRemark-${subject}`}>
                              Auto
                            </label>
                          </div>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name={`remarkType-${subject}`}
                              id={`customRemark-${subject}`}
                              checked={scores[subject]?.useCustomRemark}
                              onChange={() => handleInputChange(subject, "useCustomRemark", true)}
                            />
                            <label className="form-check-label" htmlFor={`customRemark-${subject}`}>
                              Custom
                            </label>
                          </div>
                        </div>
                        
                        {/* Show auto-generated remarks dropdown when auto is selected */}
                        {!scores[subject]?.useCustomRemark && (
                          <select
                            className="form-control"
                            value={scores[subject]?.remark || ""}
                            onChange={(e) =>
                              handleInputChange(subject, "remark", e.target.value)
                            }
                          >
                            <option value="">Select Auto Remark</option>
                            {gradeRemarks[
                              determineGrade(calculateTotal(scores[subject], getClassLevelGroup(studentClassFilter.toLowerCase())), getClassLevelGroup(studentClassFilter.toLowerCase()))
                            ]?.map((remark, index) => (
                              <option key={index} value={remark}>
                                {remark}
                              </option>
                            ))}
                          </select>
                        )}
                        
                        {/* Show custom remark input when custom is selected */}
                        {scores[subject]?.useCustomRemark && (
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter custom remark"
                            value={scores[subject]?.customRemark || ""}
                            onChange={(e) =>
                              handleInputChange(subject, "customRemark", e.target.value)
                            }
                          />
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
          </div>
          {subjects.length === 0 && (
            <div className="res-empty">Select a class to load its subjects.</div>
          )}
        </div>
        <div className="res-card res-overall mt-4">
          <div className="res-card-head"><RiAwardLine /> Overall Summary</div>
          <div className="res-overall-tops">
            <div className="res-statbox"><span className="k">Overall Total</span><span className="v">{scores?.overallTotalFromDb || calculateOverallTotal(studentClassFilter)}</span></div>
            <div className="res-statbox"><span className="k">Overall Grade</span><span className="v">{scores?.overallGradeFromDb || calculateOverallGrade(studentClassFilter)}</span></div>
          </div>
          <div className="res-remark">
            <h5>Teacher&apos;s Remark</h5>
    {/* Radio buttons to choose between auto-generated and custom overall remark */}
    <div className="d-flex gap-3">
      <div className="form-check">
        <input
          className="form-check-input"
          type="radio"
          name="overallRemarkType"
          id="autoOverallRemark"
          checked={!scores?.useCustomOverallRemark || scores?.useCustomOverallRemark === undefined ? true : !scores.useCustomOverallRemark}
          onChange={() => handleInputChange("useCustomOverallRemark", "", false)}
        />
        <label className="form-check-label" htmlFor="autoOverallRemark">
          Auto
        </label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          type="radio"
          name="overallRemarkType"
          id="customOverallRemark"
          checked={scores?.useCustomOverallRemark || false}
          onChange={() => handleInputChange("useCustomOverallRemark", "", true)}
        />
        <label className="form-check-label" htmlFor="customOverallRemark">
          Custom
        </label>
      </div>
    </div>
    
    {/* Show auto-generated overall remark when auto is selected */}
    {!scores?.useCustomOverallRemark && (
      <p className="res-auto-remark">Auto Teacher&apos;s Remark: {scores?.overallRemarkFromDb || overallRemark(studentClassFilter)}</p>
    )}
    
    {/* Show custom overall remark input when custom is selected */}
    {scores?.useCustomOverallRemark && (
      <input
        type="text"
        className="form-control"
        placeholder="Enter custom teacher remark"
        value={scores?.customOverallRemark || ""}
        onChange={(e) =>
          handleInputChange("customOverallRemark", "", e.target.value)
        }
      />
    )}
  </div>
  
  {/* Principal's Remark Section */}
  <div className="res-remark">
    <h5>Principal&apos;s Remark</h5>
    {/* Radio buttons to choose between auto-generated and custom principal remark */}
    <div className="d-flex gap-3">
      <div className="form-check">
        <input
          className="form-check-input"
          type="radio"
          name="principalRemarkType"
          id="autoPrincipalRemark"
          checked={!scores?.useCustomPrincipalRemark || scores?.useCustomPrincipalRemark === undefined ? true : !scores.useCustomPrincipalRemark}
          onChange={() => handleInputChange("useCustomPrincipalRemark", "", false)}
        />
        <label className="form-check-label" htmlFor="autoPrincipalRemark">
          Auto
        </label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          type="radio"
          name="principalRemarkType"
          id="customPrincipalRemark"
          checked={scores?.useCustomPrincipalRemark || false}
          onChange={() => handleInputChange("useCustomPrincipalRemark", "", true)}
        />
        <label className="form-check-label" htmlFor="customPrincipalRemark">
          Custom
        </label>
      </div>
    </div>
    
    {/* Show auto-generated principal remark when auto is selected */}
    {!scores?.useCustomPrincipalRemark && (
      <p className="res-auto-remark">Auto Principal&apos;s Remark: {scores?.overallPrincipalRemarkFromDb || overallPrincipalRemark(studentClassFilter)}</p>
    )}
    
    {/* Show custom principal remark input when custom is selected */}
    {scores?.useCustomPrincipalRemark && (
      <input
        type="text"
        className="form-control"
        placeholder="Enter custom principal remark"
        value={scores?.customPrincipalRemark || ""}
        onChange={(e) =>
          handleInputChange("customPrincipalRemark", "", e.target.value)
        }
      />
    )}
  </div>
  {/* Enhanced Additional Evaluation Section */}
  <div className="res-additional">
    <div className="res-card-head">
      <RiStarLine /> Additional Evaluation
      <span className="res-hint-inline">Instruction: Rate each trait from 1 to 5</span>
    </div>

    {/* Attendance Section */}
    <div className="res-eval">
      <h5><span className="ic"><RiTimeLine /></span> Attendance</h5>
      <p className="res-hint">
        Auto-filled from the student&apos;s check-in records when the selected term matches the active term in Settings — you can still update it manually if needed.
      </p>
      {studentAttendance.length > 0 && (
        <div className="res-attnd-box">
          <div className="fw-bold">
            Check-in history: {studentAttendance.length} day{studentAttendance.length > 1 ? "s" : ""} recorded this term
          </div>
          <div className="res-attnd-list">
            {studentAttendance.map((a) => (
              <div key={a.id} className="d-flex">
                <span>{a.date}</span>
                <span className="text-muted">{a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString() : ""} ({a.method || "manual"})</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="res-grid2">
        <div className="res-field">
          <label htmlFor="daysPresent" className="res-label">Days Present</label>
          <input
            id="daysPresent"
            type="number"
            className="res-input"
            value={scores?.daysPresent?.value ?? ""}
            placeholder="Enter number of days present"
            onChange={(e) => handleInputChange("daysPresent", "value", e.target.value)}
          />
        </div>
        <div className="res-field">
          <label htmlFor="daysAbsent" className="res-label">Days Absent</label>
          <input
            id="daysAbsent"
            type="number"
            className="res-input"
            value={scores?.daysAbsent?.value ?? ""}
            placeholder="Enter number of days absent"
            onChange={(e) => handleInputChange("daysAbsent", "value", e.target.value)}
          />
        </div>
      </div>
    </div>

    {/* Affective Domain Section */}
    <div className="res-eval">
      <h5><span className="ic green"><RiEmotionHappyLine /></span> Affective Domain</h5>
      <div className="res-rate-grid">
      {[
        "punctuality",
        "neatness",
        "honesty",
        "coOperation",
        "leadership",
        "helpingOthers",
        "emotionalStability",
        "health",
        "attentiveness",
        "attitudeToSchoolWork",
      ].map((option) => (
        <div className="res-field" key={option}>
          <label htmlFor={option} className="res-label">
            {option.replace(/_/g, " ")}
          </label>
          <input
            id={option}
            type="number"
            className="res-input"
            value={scores?.[option]?.value ?? ""}
            placeholder={`Rate from 1 to 5`}
            onChange={(e) => handleInputChange(option, "value", e.target.value)}
          />
        </div>
      ))}
      </div>
    </div>

    {/* Psychomotor Domain Section */}
    <div className="res-eval">
      <h5><span className="ic amber"><RiRunLine /></span> Psychomotor Domain</h5>
      <div className="res-rate-grid">
      {[
        "handWriting",
        "verbalFrequency",
        "games",
        "handlingTools",
        "drawingPainting",
        "musicalSkills",
      ].map((option) => (
        <div className="res-field" key={option}>
          <label htmlFor={option} className="res-label">
            {option.replace(/_/g, " ")}
          </label>
          <input
            id={option}
            type="number"
            className="res-input"
            value={scores?.[option]?.value ?? ""}
            placeholder={`Rate from 1 to 5`}
            onChange={(e) => handleInputChange(option, "value", e.target.value)}
          />
        </div>
      ))}
      </div>
    </div>
    
    {/* Debit Amount Section - Only visible to jmis_userauth users */}
    {(userAuth && userAuth.some && userAuth.some(auth => auth.email === user?.user_metadata?.email)) && (
      <div className="res-eval">
        <h5><span className="ic red"><RiBankLine /></span> Debit Amount</h5>
        <div className="res-grid2">
          <div className="res-field">
            <label htmlFor="debitAmount" className="res-label">
              Amount
            </label>
            <input
              id="debitAmount"
              type="number"
              className="res-input"
              value={scores?.debitAmount?.value ?? ""}
              placeholder="Enter debit amount"
              onChange={(e) => handleInputChange("debitAmount", "value", e.target.value)}
            />
          </div>
        </div>
      </div>
    )}
  </div>
</div>
        <Modal show={showPreviewModal} onHide={handleClosePreviewModal} size="xl" centered contentClassName="res-modal-content">
          <div className="res-modal-head">
            <div className="t"><RiEyeLine /> Result Preview</div>
            <div className="s">
              {selectedStudent || "Student"}
              {studentClassFilter ? ` • ${studentClassFilter}` : ""}
              {termFilter ? ` • ${termFilter}` : ""}
              {purpose === "midterm" ? " • Midterm" : ""}
            </div>
          </div>
          <Modal.Body className="res-modal-body">
            <PreviewResultComponent
              studentName={selectedStudent}
              studentClass={studentClassFilter}
              term={termFilter}
              subjects={subjects}
              scores={scores}
              overallPrincipalRemark={overallPrincipalRemark}
              useCustomPrincipalRemark={scores?.useCustomPrincipalRemark}
              customPrincipalRemark={scores?.customPrincipalRemark}
              purpose={purpose}
            />
          </Modal.Body>
          <div className="res-modal-foot">
            <button className="res-cancel" onClick={handleClosePreviewModal}>
              Close
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}

const PreviewResultComponent = ({ studentName, studentClass, term, subjects, scores, overallPrincipalRemark, useCustomPrincipalRemark, customPrincipalRemark, purpose }) => {
  // Function to determine class level group - now using primary grading for all levels including early years
  const getClassLevelGroup = (classKey) => {
    if (classKey.includes("pre-nursery") || classKey.includes("nursery") || classKey.includes("creche")) {
      return "primary"; // Use primary grading for early years
    } else if (classKey.includes("year1") || classKey.includes("year2") || classKey.includes("year3") || 
               classKey.includes("year4") || classKey.includes("year5") || classKey.includes("year6")) {
      return "primary";
    } else if (classKey.includes("year7") || classKey.includes("year8") || classKey.includes("year9")) {
      return "secondary";
    }
    return "primary"; // default
  };
  
  const classLevelGroup = getClassLevelGroup(studentClass.toLowerCase());

  const calculateTotal = (subjectScores, classLevelGroup) => {
    // For all classes: Test + Project + Examination = Total
    const test = parseFloat(subjectScores.test || 0);
    const project = parseFloat(subjectScores.project || 0);
    const examination = parseFloat(subjectScores.examination || 0);
    return test + project + examination;
  };
  const determineGrade = (total, classLevelGroup) => {
    // Use primary/secondary grading system for all levels
    if (total >= 96) return "A+";
    if (total >= 86) return "A";
    if (total >= 80) return "B+";
    if (total >= 70) return "B";
    if (total >= 66) return "C+";
    if (total >= 56) return "C";
    if (total >= 46) return "D";
    return "E";
  };

  const calculateMidtermGrade = (score) => {
    score = parseFloat(score || 0);
    if (score >= 29) return "A+";
    if (score >= 26) return "A";
    if (score >= 24) return "B+";
    if (score >= 21) return "B";
    if (score >= 20) return "C+";
    if (score >= 17) return "C";
    if (score >= 14) return "D";
    return "E";
  };

  // Filter subjects that have valid scores
  const validSubjects = subjects.filter((subject) => {
    const subjectScores = scores[subject] || {};
    if (purpose === "midterm") {
      return subjectScores.midtermScore !== undefined && subjectScores.midtermScore !== "";
    }
    return (
      subjectScores.test !== undefined &&
      subjectScores.project !== undefined &&
      subjectScores.examination !== undefined
    );
  });

  const calculateOverallTotal = () => {
    return validSubjects.reduce((sum, subject) => {
      return sum + calculateTotal(scores[subject], classLevelGroup);
    }, 0);
  };
  const calculateOverallGrade = () => {
    const overallTotal = calculateOverallTotal();
    const average = validSubjects.length > 0 ? overallTotal / validSubjects.length : 0;
    return determineGrade(average, classLevelGroup);
  };
  return (
    <div className="res-pv">
      <h2>
        {purpose === "midterm" ? "Midterm Result Preview" : "Result Preview"}
      </h2>
      <div className="res-pv-meta">
        <span><strong>Student Name:</strong> {studentName}</span>
        <span><strong>Class:</strong> {studentClass}</span>
        <span><strong>Term:</strong> {term}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            {purpose === "midterm" ? (
              <>
                <th>Midterm Score (30)</th>
                <th>Grade</th>
                <th>Remark</th>
              </>
            ) : (
              <>
                <th>Test</th>
                <th>Project</th>
                <th>Examination</th>
                <th>Total (100)</th>
                <th>Grade</th>
                <th>Teacher&apos;s Remark</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => {
            const subjScore = scores[subject] || {};
            const total = calculateTotal(subjScore, classLevelGroup);
            const grade = determineGrade(total, classLevelGroup);
            return (
              <tr key={subject}>
                <td>{subject}</td>
                {purpose === "midterm" ? (
                  <>
                    <td>{subjScore.midtermScore || "0"}</td>
                    <td>{calculateMidtermGrade(subjScore.midtermScore)}</td>
                    <td>{subjScore.remark || ""}</td>
                  </>
                ) : (
                  <>
                    <td>{subjScore.test || "0"}</td>
                    <td>{subjScore.project || "0"}</td>
                    <td>{subjScore.examination || "0"}</td>
                    <td><strong>{total}</strong></td>
                    <td>{grade}</td>
                    <td>{subjScore.remark || ""}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {purpose !== "midterm" && (
        <div className="res-pv-foot">
          <p className="line">Overall Total: {calculateOverallTotal()}</p>
          <p className="line">Overall Grade: {validSubjects.length > 0 ? calculateOverallGrade() : "N/A"}</p>
          <p className="line" style={{ marginTop: "12px" }}>
            Principal&apos;s Comment: {useCustomPrincipalRemark ? (customPrincipalRemark || "N/A") : (overallPrincipalRemark ? overallPrincipalRemark(studentClass) : "N/A")}
          </p>
        </div>
      )}
    </div>
  );
};
