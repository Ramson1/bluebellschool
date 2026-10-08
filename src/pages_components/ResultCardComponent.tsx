import React, { useState, useEffect } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import "../styles/ResultCardComponent.css";
import type { NextRouter } from 'next/router';
// Using logo from public directory
const logo = '/logo.jpg';
import { supabase } from "../supabaseClient";
import approved from '../assets/approved.png';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useRouter } from 'next/router';
import { normalizeSubjectName } from '../utils/subjectUtils';

interface Settings {
  id: number;
  key: string;
  session: string;
  nextTermBegins: string;
  term: string;
  nextTermFees: number;
  schoolOpened: number;
}

interface classList {
  id: number;
  key: string;
  studentName: string;
  studentClass: string;
  studentId: number;
  overall1st: overall;
  overall2nd: overall[];
  overall3rd: overall[];
  term1Subjects: SubjectResult[];
  term2Subjects: SubjectResult[];
  term3Subjects: SubjectResult[];
  token: string;
  uploadResult: boolean;
}

// Extending the classList interface to include additional optional data that can be passed via props
interface ExtendedStudentData extends classList {
  settings?: Settings[];
  classList?: classList[];
  payments?: any[];
  classBal?: any[];
  classFees?: any[];
  preventTokenUpdate?: boolean;
}

interface SubjectResult {
  test?: string;
  project?: string;
  examination?: string;
  note?: string;
  homework?: string;
  ca1?: string;
  exam?: string;
  cbt?: string;
  grade?: string;
  total?: number;
  remark?: string;
  subjectName: string;
}

interface overall {
  overallGrade: string;
  overallTotal: number;
  overallRemark: string;
  overallPrincipalRemark?: string;
  daysPresent?: string;
  daysAbsent?: string;
  punctuality?: string;
  neatness?: string;
  honesty?: string;
  coOperation?: string;
  leadership?: string;
  helpingOthers?: string;
  emotionalStability?: string;
  health?: string;
  attentiveness?: string;
  attitudeToSchoolWork?: string;
  handWriting?: string;
  verbalFrequency?: string;
  games?: string;
  handlingTools?: string;
  drawingPainting?: string;
  musicalSkills?: string;
  debitAmount?: string;
}

const ResultCardComponent: React.FC<{ studentData?: ExtendedStudentData; passport?: any; selectedTerm?: string; resultType?: string; }> = ({ studentData: propStudentData, passport: propPassport, selectedTerm: propSelectedTerm, resultType: propResultType }) => {
  // Safely initialize router
  
  let router: NextRouter | undefined;
  let isRouterAvailable = false;
  
  try {
    router = useRouter();
    isRouterAvailable = !!(router && router.query);
  } catch (error) {
    console.warn('NextRouter not available in this context');
  }
  
  // For backwards compatibility with React Router, fallback to location.state if props aren't provided
  // const location = useLocation();
  // const { studentData, passport, selectedTerm } = location.state || {};
  
  // Use props if provided, otherwise try to get from router query
  // Added localStorage support to handle large data that causes HTTP 431 errors in URL
  const [localStudentData, setLocalStudentData] = useState<ExtendedStudentData | undefined>(undefined);
  const [localPassport, setLocalPassport] = useState<any>(undefined);

  useEffect(() => {
    // Try to load from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const storedResultData = localStorage.getItem('studentResultData');
        if (storedResultData) {
          setLocalStudentData(JSON.parse(storedResultData));
        }
        
        const storedPassportData = localStorage.getItem('studentPassportData');
        if (storedPassportData) {
          setLocalPassport(JSON.parse(storedPassportData));
        }
      } catch (e) {
        console.error('Error loading data from localStorage:', e);
      }
    }
  }, []);

  const studentData = propStudentData || 
                      (isRouterAvailable && router?.query?.studentData ? JSON.parse(decodeURIComponent(router.query.studentData as string)) : undefined) ||
                      localStudentData;
                      
  const passport = propPassport || 
                   (isRouterAvailable && router?.query?.passport ? JSON.parse(decodeURIComponent(router.query.passport as string)) : undefined) ||
                   localPassport;
  
  const selectedTerm = propSelectedTerm || (isRouterAvailable ? router?.query?.selectedTerm as string | undefined : undefined);
  const resultType = propResultType || (isRouterAvailable ? router?.query?.resultType as string | undefined : undefined);
  
  // Log the received data for debugging
  console.log('Received data in ResultCardComponent:', {
    propStudentData,
    propPassport,
    propSelectedTerm,
    routerQuery: router?.query,
    studentData,
    passport,
    selectedTerm,
    resultType,
    isRouterAvailable
  });
  const [settings, setSettings] = useState<Settings[]>(propStudentData?.settings || []);
  const setting = settings[0];
  const [studentList, setStudentList] = useState<classList[]>(propStudentData?.classList || []);
  const [payments, setPayments] = useState<any[]>(propStudentData?.payments || []);
  const [classBal, setClassBal] = useState<any[]>(propStudentData?.classBal || []);
  const [classFees, setClassFees] = useState<any[]>([]);
  // Using router when available, fallback to window.location for Next.js compatibility
    const navigate = (path: string) => {
      if (isRouterAvailable && router) {
        router.push(path);
      } else {
        window.location.href = path;
      }
    };

  const isMidterm = resultType === 'midterm' || selectedTerm?.toLowerCase().includes("midterm") || selectedTerm?.toLowerCase().includes("mid-term");

  const getOverallScore = () => {
    const term = selectedTerm?.toLowerCase() || "";
    const isFirstTerm = term.includes("1st term");
    const isSecondTerm = term.includes("2nd term");
    const isThirdTerm = term.includes("3rd term");

    const fulltermOverall = isFirstTerm
      ? studentData?.overall1st
      : isSecondTerm
        ? studentData?.overall2nd
        : isThirdTerm
          ? studentData?.overall3rd
          : undefined;

    const hasFullterm = !!fulltermOverall && typeof fulltermOverall.overallTotal !== "undefined";

    if (isMidterm) {
      if (hasFullterm) return fulltermOverall;
      return null;
    }

    if (hasFullterm) return fulltermOverall;
    return null;
  };

  const overallScore = getOverallScore(); // Get the relevant overall score

  const resultScore = (): SubjectResult[] | null => {
    const term = selectedTerm?.toLowerCase() || "";
    const isFirstTerm = term.includes("1st term");
    const isSecondTerm = term.includes("2nd term");
    const isThirdTerm = term.includes("3rd term");

    const fulltermSubjects = isFirstTerm
      ? studentData?.term1Subjects ?? null
      : isSecondTerm
        ? studentData?.term2Subjects ?? null
        : isThirdTerm
          ? studentData?.term3Subjects ?? null
          : null;

    const hasFullterm = !!fulltermSubjects && fulltermSubjects.length > 0;

    if (isMidterm) {
      if (hasFullterm) return fulltermSubjects;
      return null;
    }

    if (hasFullterm) return fulltermSubjects;
    return null;
  };

  const termResult = resultScore()?.filter(
    (result) => {
      // Check if any of the score fields have values
      const hasTestScore = 
        (result.test !== null && result.test !== undefined && result.test !== "" && result.test !== "0") ||
        (result.note !== null && result.note !== undefined && result.note !== "" && result.note !== "0") ||
        (result.ca1 !== null && result.ca1 !== undefined && result.ca1 !== "" && result.ca1 !== "0");
      
      const hasProjectScore = 
        (result.project !== null && result.project !== undefined && result.project !== "" && result.project !== "0") ||
        (result.homework !== null && result.homework !== undefined && result.homework !== "" && result.homework !== "0");
      
      const hasExamScore = 
        (result.examination !== null && result.examination !== undefined && result.examination !== "" && result.examination !== "0") ||
        (result.exam !== null && result.exam !== undefined && result.exam !== "" && result.exam !== "0") ||
        (result.cbt !== null && result.cbt !== undefined && result.cbt !== "" && result.cbt !== "0");
      
      // Only include subjects that have at least one score
      // For midterm, we only care about test score, but keeping existing logic is fine as we filter columns later
      return hasTestScore || hasProjectScore || hasExamScore;
    }
  );

  const normalizedTermResult: SubjectResult[] = termResult
    ? (() => {
        const subjectMap = new Map<string, SubjectResult>();
        termResult.forEach((result) => {
          const canonicalName = normalizeSubjectName(result.subjectName) || result.subjectName;
          if (!subjectMap.has(canonicalName)) {
            subjectMap.set(canonicalName, { ...result, subjectName: canonicalName });
          }
        });
        return Array.from(subjectMap.values());
      })()
    : [];

  const midtermTotal = isMidterm
    && normalizedTermResult.length > 0
    ? normalizedTermResult.reduce((sum, result) => {
        return sum + Number(result.test || 0);
      }, 0)
    : 0;

  const formatSubjectName = (name: string) => {
    const canonical = normalizeSubjectName(name) || name;
    if (canonical === 'Information & Communication Technology') {
      return 'ICT';
    }
    if (canonical === 'Christian Religious Knowledge') {
      return 'C R S';
    }
    return canonical;
  };


  const uploadResult = studentData?.uploadResult;

  // Function to fetch the settings table
  const fetchSettingsTable = async () => {
    try {
      // Query the 'settings' table
      const { data, error } = await supabase.from('bluebell_settings').select('*');

      // Handle errors if any occur
      if (error) {
        throw error;
      }

      // Update state with the fetched data
      setSettings(data || []);
    } catch (err: any) {
      console.error('Error fetching settings table:', err.message || err);
      setSettings([]); // Set empty array on error
    }
  };

  // Fetch list of students in the same class
  const classStudentsList = async () => {
    // Skip if required data is not available
    if (!studentData?.studentClass) {
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('bluebell_result')
        .select('*')
        .eq('studentClass', studentData.studentClass);
      if (error) throw error;
      setStudentList(data || []); // Update state with the fetched data
    } catch (err: any) {
      console.error('Error fetching class student list:', err.message || err);
      setStudentList([]); // Set empty array on error
    }
  };

  const classFee = async () => {
    try {
      const { data: classFeesData, error: classFeesError } = await supabase
        .from('bluebell_class_specific_fees')
        .select('*');
      if (classFeesError) throw classFeesError;
      setClassFees(classFeesData || []); // Update state with the fetched data
    } catch (err: any) {
      console.error('Error fetching class fees data:', err.message || err);
      setClassFees([]); // Set empty array on error
    }
  };
  
  const classBalance = async () => {
    try {
      const { data: classBalData, error: classBalError } = await supabase
        .from('bluebell_paymentsinfo')
        .select('*');
      if (classBalError) throw classBalError;
      setClassBal(classBalData || []); // Update state with the fetched data
    } catch (err: any) {
      console.error('Error fetching class balance data:', err.message || err);
      setClassBal([]); // Set empty array on error
    }
  };

  useEffect(() => {
    const fetchPaymentData = async () => {
      // Skip if required data is not available
      if (!studentData?.studentName || !selectedTerm) {
        return;
      }
      
      const set = selectedTerm;
      try {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('bluebell_paymentsinfo')
          .select('*')
          .eq('name', studentData.studentName)
          .eq('currentterm', set);
        if (paymentsError) throw paymentsError;
        // Only update state if we don't already have payment data from props
        if (!propStudentData?.payments || propStudentData.payments.length === 0) {
          setPayments(paymentsData || []);
        }
      } catch (err: any) {
        console.error('Error fetching payment data:', err.message || err);
        // Only update state if we don't already have payment data from props
        if (!propStudentData?.payments || propStudentData.payments.length === 0) {
          setPayments([]); // Set empty array on error
        }
      }
    };

    // Only fetch payment data if student data exists and we don't already have payment data from props
    if (studentData && (!propStudentData?.payments || propStudentData.payments.length === 0)) {
      fetchPaymentData();
    }
  }, [studentData, selectedTerm, propStudentData?.payments]);

  useEffect(() => {
    // Only fetch additional data if it's not already provided in props
    // If student data is passed with additional data, don't make unnecessary API calls
    if (!propStudentData?.settings || propStudentData.settings.length === 0) {
      fetchSettingsTable();
    }
    
    if (studentData?.studentClass && (!propStudentData?.classList || propStudentData.classList.length === 0)) {
      classStudentsList();
    }
    
    if (!propStudentData?.classBal || propStudentData.classBal.length === 0) {
      classFee();
      classBalance();
    }
  }, [studentData?.studentClass]);
  
  // Effect to ensure class fees are loaded when student class changes
  useEffect(() => {
    if (!propStudentData?.classFees || propStudentData.classFees.length === 0) {
      classFee();
    }
  }, []);

  const ff = studentData?.studentClass.toLowerCase();
  const db = classBal[0]?.[ff] - payments[0]?.amountpaid;
  const debitAmount = studentData?.overall1st?.debitAmount || studentData?.overall2nd?.debitAmount || studentData?.overall3rd?.debitAmount || null;

  // Function to determine class level group - now using primary/secondary grading for all levels
  const getClassLevelGroup = (classKey: string) => {
    return "primary"; // Always return "primary" to use the same grading system for all levels
  };

  const classLevelGroup = getClassLevelGroup(studentData?.studentClass || "");

  // Updated getColorForGrade function to use the primary/secondary grading system for all levels
  const getColorForGrade = (grade: string) => {
    // For primary and secondary: A+, A, B+, B, C+, C, D, E (used for all levels now)
    if (grade === "A+" || grade === "A") return "good-grade";
    if (grade === "B+" || grade === "B" || grade === "C+") return "average-grade";
    if (grade === "C" || grade === "D" || grade === "E") return "low-grade";
    return ""; // default
  };

  const getMidtermGrade = (score: number) => {
    if (score >= 29) return "A+";
    if (score >= 26) return "A";
    if (score >= 24) return "B+";
    if (score >= 21) return "B";
    if (score >= 20) return "C+";
    if (score >= 17) return "C";
    if (score >= 14) return "D";
    return "E";
  };


  // Updated Score Range and Grade Meaning table to always use the primary/secondary grading system
  const renderGradingTable = () => {
    if (isMidterm) {
      return (
        <table className="table table-bordered table-sm redesigned-table">
          <thead className="table-light">
            <tr>
              <th>Score Range</th>
              <th>Grade</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>29-30</td>
              <td>A+</td>
              <td>Excellent</td>
            </tr>
            <tr>
              <td>26-28</td>
              <td>A</td>
              <td>Very Good</td>
            </tr>
            <tr>
              <td>24-25</td>
              <td>B+</td>
              <td>Good</td>
            </tr>
            <tr>
              <td>21-23</td>
              <td>B</td>
              <td>Satisfactory</td>
            </tr>
            <tr>
              <td>20</td>
              <td>C+</td>
              <td>Fair</td>
            </tr>
            <tr>
              <td>17-19</td>
              <td>C</td>
              <td>Average</td>
            </tr>
            <tr>
              <td>14-16</td>
              <td>D</td>
              <td>Below Average</td>
            </tr>
            <tr>
              <td>0-13</td>
              <td>E</td>
              <td>Poor</td>
            </tr>
          </tbody>
        </table>
      );
    }
    return (
      <table className="table table-bordered table-sm redesigned-table">
        <thead className="table-light">
          <tr>
            <th>Score Range</th>
            <th>Grade</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>96-100</td>
            <td>A+</td>
            <td>Excellent</td>
          </tr>
          <tr>
            <td>86-95</td>
            <td>A</td>
            <td>Very Good</td>
          </tr>
          <tr>
            <td>80-85</td>
            <td>B+</td>
            <td>Good</td>
          </tr>
          <tr>
            <td>70-79</td>
            <td>B</td>
            <td>Satisfactory</td>
          </tr>
          <tr>
            <td>66-69</td>
            <td>C+</td>
            <td>Fair</td>
          </tr>
          <tr>
            <td>56-65</td>
            <td>C</td>
            <td>Average</td>
          </tr>
          <tr>
            <td>46-55</td>
            <td>D</td>
            <td>Below Average</td>
          </tr>
          <tr>
            <td>0-45</td>
            <td>E</td>
            <td>Poor</td>
          </tr>
        </tbody>
      </table>
    );
  };

  // Calculate the student's position in class
  const calculatePosition = () => {
    if (!studentList || !Array.isArray(studentList) || !studentData || !overallScore) return null;

    // Extract overall totals and sort in descending order
    const sortedStudents = studentList.slice().sort((a, b) => {
      const term = selectedTerm?.toLowerCase() || "";
      
      const getScore = (student: classList) => {
         if (term.includes("1st term")) return student.overall1st?.overallTotal || 0;
         if (term.includes("2nd term")) {
             const ov = student.overall2nd;
             return (Array.isArray(ov) ? ov[0]?.overallTotal : (ov as any)?.overallTotal) || 0;
         }
         if (term.includes("3rd term")) {
             const ov = student.overall3rd;
             return (Array.isArray(ov) ? ov[0]?.overallTotal : (ov as any)?.overallTotal) || 0;
         }
         return 0;
      };

      return getScore(b) - getScore(a); // Sort descending
    });

    // Find the position of the current student
    const studentPosition = sortedStudents.findIndex(
      student => student.studentId === studentData.studentId
    );

    return studentPosition >= 0 ? `${studentPosition + 1}${getOrdinalSuffix(studentPosition + 1)}` : null;
  };

  const calculatePositionUsingSubjectScores = () => {
    if (!studentList || !Array.isArray(studentList) || !studentData || !setting) return null;

    // Determine which term's subjects to use based on the current term
    const getSubjects = (student: classList): SubjectResult[] => {
      const term = selectedTerm?.toLowerCase() || setting.term?.toLowerCase();
      
      if (term?.includes("1st term")) return student.term1Subjects || [];
      if (term?.includes("2nd term")) return student.term2Subjects || [];
      if (term?.includes("3rd term")) return student.term3Subjects || [];
      return [];
    };

    // Calculate total scores for each student using the correct fields
    const studentsWithTotals = studentList.map((student) => {
      const subjects = getSubjects(student);
      // Sum the 'total' field of each subject
      const totalScore = subjects.reduce((sum, subject) => {
        if (isMidterm) {
          return sum + Number(subject.test || 0);
        }
        return sum + Number(subject.total || 0);
      }, 0);
      return { ...student, totalScore };
    });

    // Sort students by totalScore in descending order
    const sortedStudents = studentsWithTotals.slice().sort((a, b) => b.totalScore - a.totalScore);

    // Assign positions, accounting for ties
    let currentPosition = 1;
    let previousScore: number | null = null;
    const studentsWithPositions = sortedStudents.map((student, index) => {
      if (student.totalScore !== previousScore) {
        currentPosition = index + 1;
      }
      previousScore = student.totalScore;
      return { ...student, position: currentPosition };
    });

    // Find the position of the current student
    const currentStudent = studentsWithPositions.find(
      (student) => student.studentId === studentData.studentId
    );

    // Return the position (1-based index) with ordinal suffix
    return currentStudent ? `${currentStudent.position}${getOrdinalSuffix(currentStudent.position)}` : null;
  };

  // Helper function to generate ordinal suffix (e.g., 1st, 2nd, 3rd)
  const getOrdinalSuffix = (num: number) => {
    const j = num % 10, k = num % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  };

  // const positionInClass = calculatePosition(); // Unused variable

  const getColorForScore = (score: number) => {
    if (score >= 20) return "good-score"; // Blue for good scores
    if (score >= 10) return "average-score"; // Orange for average scores
    return "low-score"; // Red for low scores
  };

  // const getColorForCBT = (score: number) => {
  //   if (score >= 15) return "good-score"; // Blue for good scores
  //   if (score >= 10) return "average-score"; // Orange for average scores
  //   return "low-score"; // Red for low scores
  // };

  const imgUrl = 'https://BLUEBELL_SUPABASE_REF_PLACEHOLDER.supabase.co/storage/v1/object/public/passport/';

  useEffect(() => {
    const updateTokenCount = async () => {
      // Token budget now lives on bluebell_student (single source of truth).
      // Consume one view from the student's shared count, keyed by studentId.
      // Guard on preventTokenUpdate so admin previews don't consume tokens.
      if (studentData?.tokenCount !== undefined && studentData?.studentId && (!propStudentData || !propStudentData.preventTokenUpdate)) {
        const newTokenCount = studentData.tokenCount === 0 ? 0 : studentData.tokenCount - 1;
        toast.warn('Token remains ' + newTokenCount + ' Usage');

        // Decrement the student's budget in the database
        const { error } = await supabase
          .from('bluebell_student')
          .update({ tokenCount: newTokenCount })
          .eq('id', studentData.studentId);

        if (error) {
          console.error('Error updating token count:', error);
        }
      }
    };

    updateTokenCount();
  }, [studentData, propStudentData]);

  if (studentData?.tokenCount <= 0 && !propStudentData?.preventTokenUpdate) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', height: '100vh', backgroundColor: '#f8f9fa', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ color: '#dc3545', marginBottom: '20px', textShadow: '2px 1px 4px rgba(0, 0, 0, 0.4)' }}>Token has been exhausted</h2>
        <p style={{ marginBottom: '20px', textShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>Request for a new token to view the result.</p>
        <button onClick={() => navigate('/')} className="btn btn-primary" style={{ textShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>Back to Home</button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const getSchoolName = () => {
    const className = studentData?.studentClass || "";
    const upperClass = className.toUpperCase();
    const yearMatch = upperClass.match(/YEAR\s*(\d+)/);
    if (yearMatch && parseInt(yearMatch[1], 10) >= 7) {
      return "Bluebell High School";
    }
    return "Bluebell International School";
  };

  return (
    uploadResult ? (
      <div className="container-fluid result-doc" style={{ fontSize: '10px', lineHeight: '1.1' }}>
        {/* Header Section */}
        <header className="row row-cols-auto mb-3" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="col-sm-2 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={typeof logo === 'string' ? logo : '/logo.jpg'}
              alt="School Logo"
              className="img-fluid"
              style={{ width: '50px', height: '50px' }}
            />
          </div>
          <div className="col-md-8 text-center school-info">
            <h6 className="text-uppercase fw-bold text-primary">{getSchoolName()}</h6>
            {/* <p className="mb-1 text-danger text-uppercase"><strong>Motto: BLUEBELL_MOTTO_PLACEHOLDER</strong></p> */}
            <p className="mb-1"><strong>Address: </strong>BLUEBELL_ADDRESS_PLACEHOLDER</p>
            <p className="mb-0"><strong>Phone No: </strong>BLUEBELL_PHONE_PLACEHOLDER | <strong>Email: </strong><a href="mailto:BLUEBELL_EMAIL_PLACEHOLDER">BLUEBELL_EMAIL_PLACEHOLDER</a></p>
          </div>
          <div className="col-md-2 text-end">
            {(() => {
              console.log('Passport data for image display:', { passport, hasPassport: passport && passport.passport, imgUrl });
              return passport && passport.passport ? (
                <img
                  src={imgUrl + passport.passport}
                  alt="Student Passport"
                  className="img-fluid rounded-circle border"
                  style={{ width: '50px', height: '50px' }}
                  onError={(e) => {
                    console.error('Failed to load passport image:', imgUrl + passport.passport);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px', backgroundColor: '#e9ecef', borderRadius: '50%' }}>
                  <span>No Image</span>
                </div>
              );
            })()}
          </div>
        </header>
        <ToastContainer />
        {/* Student Info Section */}
        <section className="compact-section">
          <table className="compact-table">
            <tbody>
              <tr>
                <td>
                  <strong>Session: </strong>{setting?.session}
                </td>
                <td>
                  <strong>Term: </strong>{selectedTerm}
                </td>
                <td>
                  <strong>Result Pin: </strong>{studentData?.token}
                </td>
                <td>
                  <strong>Next Term Begins: </strong>{setting?.nextTermBegins}
                </td>
              </tr>
              <tr>
                <td style={{ color: 'green', lineHeight: '1.1' }}>
                  {studentData?.studentName}
                </td>
                <td>
                  <strong>Class: </strong>{studentData?.studentClass}
                </td>
                <td>
                  <strong>No. of Students in Class: </strong>{studentList?.length}
                </td>
                <td>
                  <strong>Position in Entire Class: </strong>{calculatePositionUsingSubjectScores()} Position
                  {/* <strong style={{ color: 'green', fontWeight: 700 }}>Total Score:</strong> {isMidterm ? midtermTotal : overallScore?.overallTotal}, */}
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Days School Opened: </strong>{setting?.schoolOpened}
                </td>
                <td>
                  <strong>Days Present: </strong>{overallScore?.daysPresent}
                </td>
                <td>
                  <strong>Days Absent: </strong>{overallScore?.daysAbsent}
                </td>
                <td style={{ color: 'green', fontWeight: 700 }}>
                  <strong style={{ paddingLeft: '5px', color: 'green', fontWeight: 700 }}>Total Score:</strong> {isMidterm ? midtermTotal : overallScore?.overallTotal},
                  <strong style={{ paddingLeft: '5px', color: 'green', fontWeight: 700 }}>Average: </strong>{normalizedTermResult && normalizedTermResult.length > 0 ? ((isMidterm ? midtermTotal : overallScore?.overallTotal) / normalizedTermResult.length).toFixed(2) : '0.00'},
                  <strong style={{ paddingLeft: '5px', color: 'green', fontWeight: 700 }}>Grade: </strong>{isMidterm ? getMidtermGrade(midtermTotal / (normalizedTermResult.length || 1)) : overallScore?.overallGrade}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Academic Results & Other Sections */}
        <section className="result-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <h3 className="title">Academic Results</h3>
            </div>
            {/* Print Button */}
            <div className="print-button-container">
              <button 
                onClick={handlePrint}
                className="btn btn-primary"
                style={{
                  backgroundColor: '#007bff',
                  borderColor: '#007bff',
                  padding: '8px 15px',
                  fontSize: '14px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  marginLeft: '10px'
                }}
              >
                Print Result
              </button>
            </div>
          </div>
          <table className="result-table">
            <thead>
              <tr>
                <th>Subject</th>
                {isMidterm ? (
                  <>
                    <th>Midterm Score (30)</th>
                    <th>Grade</th>
                    <th>Remarks</th>
                  </>
                ) : (
                  <>
                    <th>Test (30)</th>
                    <th>Project (10)</th>
                    <th>Examination (60)</th>
                    <th>Total (100)</th>
                    <th>Grade</th>
                    <th>Remarks</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {normalizedTermResult && normalizedTermResult.length > 0 ? (
                normalizedTermResult.map((result) => (
                  <tr key={result.subjectName}>
                    <td>{formatSubjectName(result.subjectName)}</td>
                    {isMidterm ? (
                      <>
                        <td className={getColorForScore(Number(result.test || 0))}>
                          {result.test || "-"}
                        </td>
                        <td className={getColorForGrade(getMidtermGrade(Number(result.test || 0)))}>
                          {getMidtermGrade(Number(result.test || 0))}
                        </td>
                        <td>{result.remark || "-"}</td>
                      </>
                    ) : (
                      <>
                        <td className={getColorForScore(Number(result.test || result.note || result.ca1 || 0))}>
                          {result.test || result.note || result.ca1 || "-"}
                        </td>
                        <td className={getColorForScore(Number(result.project || result.homework || 0))}>
                          {result.project || result.homework || "-"}
                        </td>
                        <td className={getColorForScore(Number(result.examination || result.exam || 0))}>
                          {result.examination || result.exam || "-"}
                        </td>
                        <td className={getColorForScore(result.total || 0)}>
                          {result.total || "-"}
                        </td>
                        <td className={getColorForGrade(result.grade || "")}>
                          {result.grade || "-"}
                        </td>
                        <td>{result.remark || "-"}</td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center">
                    No results found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Affective Traits, Psychomotor Skills, and Key Information */}
        {/* {!isMidterm && ( */}
          <>
            <section className="traits-skills-section">
              <div className="row">
                {/* Affective Traits */}
                <div className="col-sm-4 traits-card">
                  <h5 className="text-center section-title">Affective Domain</h5>
                  <table className="table table-bordered table-sm redesigned-table">
                    <thead className="table-light">
                      <tr>
                        <th>Trait</th>
                        <th>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Punctuality</td><td>{overallScore?.punctuality || '-'}</td></tr>
                      <tr><td>Neatness</td><td>{overallScore?.neatness || '-'}</td></tr>
                      <tr><td>Honesty</td><td>{overallScore?.honesty || '-'}</td></tr>
                      <tr><td>Co-operation</td><td>{overallScore?.coOperation || '-'}</td></tr>
                      <tr><td>Leadership</td><td>{overallScore?.leadership || '-'}</td></tr>
                      <tr><td>Helping Others</td><td>{overallScore?.helpingOthers || '-'}</td></tr>
                      <tr><td>Emotional Stability</td><td>{overallScore?.emotionalStability || '-'}</td></tr>
                      <tr><td>Health</td><td>{overallScore?.health || '-'}</td></tr>
                      <tr><td>Attentiveness</td><td>{overallScore?.attentiveness || '-'}</td></tr>
                      <tr><td>Attitude to School Work</td><td>{overallScore?.attitudeToSchoolWork || '-'}</td></tr>
                    </tbody>
                  </table>
                </div>
                
                <div className="col traits-card">
                  <div className="col-sm-12 ">
                    <h5 className="text-center section-title">Psychomotive Domain</h5>
                    <table className="table table-bordered table-sm redesigned-table">
                      <thead className="table-light">
                        <tr>
                          <th>Trait</th>
                          <th>Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td>Hand Writing</td><td>{overallScore?.handWriting || '-'}</td></tr>
                        <tr><td>Verbal Frequency</td><td>{overallScore?.verbalFrequency || '-'}</td></tr>
                        <tr><td>Games</td><td>{overallScore?.games || '-'}</td></tr>
                        <tr><td>Handling Tools</td><td>{overallScore?.handlingTools || '-'}</td></tr>
                        <tr><td>Drawing/Painting</td><td>{overallScore?.drawingPainting || '-'}</td></tr>
                        <tr><td>Musical Skills</td><td>{overallScore?.musicalSkills || '-'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="col-sm-12">
                    {/* <h5 className="text-center section-title">Key and Meaning</h5> */}
                    <table className="table table-bordered table-sm redesigned-table">
                      <thead className="table-light">
                        <tr>
                          <th>KEY</th>
                          <th>MEANING</th>
                        </tr>
                      </thead>
                      <tbody className="key-meaning">
                        <tr>
                          <td>5</td>
                          <td>Maintains an excellent degree of observation</td>
                        </tr>
                        <tr>
                          <td>4</td>
                          <td>Maintains high level of observation trait</td>
                        </tr>
                        <tr>
                          <td>3</td>
                          <td>Acceptable level of observation trait</td>
                        </tr>
                        <tr>
                          <td>2</td>
                          <td>Shows minimal level of observation trait</td>
                        </tr>
                        <tr>
                          <td>1</td>
                          <td>Has no regard for observation trait</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Score Range and Grade Meaning in Table Format */}
                <div className="col-sm-4 traits-card align">
                  <h5 className="text-center section-title">Score Range and Grade Meaning</h5>
                  {renderGradingTable()}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={typeof approved === 'string' ? approved : approved.src || '/approved.png'} alt="approved" className="img-fluid" style={{ height: '90px', width: '120px' }} />
                </div>
              </div>
            </section>
            <section className='footer'>
              <div>
                <p><strong>Form Teacher's comment: </strong>{overallScore?.overallRemark}</p>
                <p><strong>Head of School comment: </strong>{overallScore?.overallPrincipalRemark}</p>
              </div>
              {!isMidterm && (
                <div>
                  {/* <p><strong>Debit Amount: </strong>{debitAmount ? `₦ ${debitAmount}` : '-'}</p> */}
                  <p><strong>Next Term School Fees: </strong>₦{(() => {
                    if (studentData?.studentClass && classFees && classFees.length > 0) {
                      const classFee = classFees.find(fee => 
                        fee.class_name?.toLowerCase() === studentData.studentClass.toLowerCase()
                      );
                      return classFee?.next_term_fees || setting?.nextTermFees || 0;
                    }
                    return setting?.nextTermFees || 0;
                  })()}</p>
                </div>
              )}
            </section>
          </>
       {/* )} */}
        

      </div>
    ) : (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#f0f2f5',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '60%',
            padding: '40px',
            backgroundColor: 'var(--card-bg, #fff)',
            borderRadius: '10px',
            boxShadow: '0 4px 8px var(--shadow-color, rgba(0, 0, 0, 0.1))',
            textAlign: 'center',
          }}
        >
          <h1 style={{ marginBottom: '20px', color: '#333' }}>
            Results not ready yet
          </h1>
          <p style={{ marginBottom: '40px', color: 'red' }}>
            Communicate with school Administrator or check your login details
          </p>
          <button
            onClick={() => {
              navigate('/');
            }}
            className="btn btn-primary"
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              borderRadius: '5px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            }}
          >
            Back
          </button>
        </div>
      </div>
    )
  )
}
export default ResultCardComponent;
