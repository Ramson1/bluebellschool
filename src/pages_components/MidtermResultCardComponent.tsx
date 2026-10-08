import React, { useState, useEffect } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import "../styles/ResultCardComponent.css";
import type { NextRouter } from 'next/router';
// Using logo from public directory
const logo = '/logo.jpg';
import { supabase } from "../supabaseClient";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useRouter } from 'next/router';
import { abbreviateSubject } from '../utils/subjectUtils';

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
  uploadmidtermresult: boolean;
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

const MidtermResultCardComponent: React.FC<{ studentData?: ExtendedStudentData; passport?: any; selectedTerm?: string; }> = ({ studentData: propStudentData, passport: propPassport, selectedTerm: propSelectedTerm }) => {
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
  const studentData = propStudentData || (isRouterAvailable && router?.query?.studentData ? JSON.parse(decodeURIComponent(router.query.studentData as string)) : undefined);
  const passport = propPassport || (isRouterAvailable && router?.query?.passport ? JSON.parse(decodeURIComponent(router.query.passport as string)) : undefined);
  const selectedTerm = propSelectedTerm || (isRouterAvailable ? router?.query?.selectedTerm as string | undefined : undefined);
  
  // Log the received data for debugging
  console.log('Received data in MidtermResultCardComponent:', {
    propStudentData,
    propPassport,
    propSelectedTerm,
    routerQuery: router?.query,
    studentData,
    passport,
    selectedTerm,
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

  const getOverallScore = () => {
    const term = selectedTerm?.toLowerCase() || "";
    if (term.includes("1st term")) return studentData?.overall1st;
    if (term.includes("2nd term")) return studentData?.overall2nd;
    if (term.includes("3rd term")) return studentData?.overall3rd;
    return null;
  };

  const overallScore = getOverallScore(); // Get the relevant overall score

  const resultScore = (): SubjectResult[] | null => {
    const term = selectedTerm?.toLowerCase() || "";
    if (term.includes("1st term")) return studentData?.term1Subjects ?? null;
    if (term.includes("2nd term")) return studentData?.term2Subjects ?? null;
    if (term.includes("3rd term")) return studentData?.term3Subjects ?? null;
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
      return hasTestScore || hasProjectScore || hasExamScore;
    }
  );

  const uploadResult = studentData?.uploadmidtermresult;
  
  // Check if there's actual result data to show regardless of uploadResult status
  const hasResultData = studentData && (
    (studentData.term1Subjects && studentData.term1Subjects.length > 0) ||
    (studentData.term2Subjects && studentData.term2Subjects.length > 0) ||
    (studentData.term3Subjects && studentData.term3Subjects.length > 0)
  );
  
  // More permissive check: if student data exists and has token, allow viewing if results exist
  const hasStudentDataWithResults = studentData && studentData.token && (
    studentData.term1Subjects || 
    studentData.term2Subjects || 
    studentData.term3Subjects ||
    studentData.overall1st ||
    studentData.overall2nd ||
    studentData.overall3rd
  );

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
      console.log('Skipping classStudentsList - no student class');
      return;
    }

    try {
      // Query the 'bluebell_student' table for students in the same class
      const { data, error } = await supabase
        .from('bluebell_student')
        .select('*')
        .eq('class', studentData.studentClass); // Filter by class

      // Handle errors if any occur
      if (error) {
        throw error;
      }

      // Update state with the fetched data
      setStudentList(data || []);
    } catch (err: any) {
      console.error('Error fetching class students:', err.message || err);
      setStudentList([]); // Set empty array on error
    }
  };

  // Function to fetch the payments table
  const fetchPaymentsTable = async () => {
    try {
      // Query the 'payments' table
      const { data, error } = await supabase.from('bluebell_payments').select('*');

      // Handle errors if any occur
      if (error) {
        throw error;
      }

      // Update state with the fetched data
      setPayments(data || []);
    } catch (err: any) {
      console.error('Error fetching payments table:', err.message || err);
      setPayments([]); // Set empty array on error
    }
  };

  // Function to fetch the class balance table
  const fetchClassBalTable = async () => {
    try {
      // Query the 'class_bal' table
      const { data, error } = await supabase.from('bluebell_class_bal').select('*');

      // Handle errors if any occur
      if (error) {
        throw error;
      }

      // Update state with the fetched data
      setClassBal(data || []);
    } catch (err: any) {
      console.error('Error fetching class balance table:', err.message || err);
      setClassBal([]); // Set empty array on error
    }
  };

  // Function to fetch the class fees table
  const fetchClassFeesTable = async () => {
    try {
      // Query the 'class_fees' table
      const { data, error } = await supabase.from('bluebell_class_specific_fees').select('*');

      // Handle errors if any occur
      if (error) {
        throw error;
      }

      // Update state with the fetched data
      setClassFees(data || []);
    } catch (err: any) {
      console.error('Error fetching class fees table:', err.message || err);
      setClassFees([]); // Set empty array on error
    }
  };

  // Fetch all required data when component mounts or when studentData changes
  useEffect(() => {
    if (studentData) {
      fetchSettingsTable();
      classStudentsList();
      fetchPaymentsTable();
      fetchClassBalTable();
      fetchClassFeesTable();
    }
  }, [studentData]);

  // Calculate position in class based on total scores
  const calculatePositionUsingSubjectScores = () => {
    if (!termResult || termResult.length === 0) return 0;

    // Get current student's total score
    const currentStudentTotal = termResult.reduce((sum, subject) => {
      return sum + (subject.total || 0);
    }, 0);

    // Get all students in the same class who have midterm results
    const classmates = studentList.filter(student => student.studentClass === studentData?.studentClass);

    // Calculate totals for all classmates who have midterm results
    const classTotals: { name: string; total: number }[] = [];

    for (const classmate of classmates) {
      // Get this student's midterm results for the selected term
      let studentResults: SubjectResult[] | null = null;
      
      if (selectedTerm === "1st term") {
        studentResults = classmate.term1Subjects ?? null;
      } else if (selectedTerm === "2nd term") {
        studentResults = classmate.term2Subjects ?? null;
      } else if (selectedTerm === "3rd term") {
        studentResults = classmate.term3Subjects ?? null;
      }
      
      if (studentResults && studentResults.length > 0) {
        // Only include students who have actual scores
        const hasValidScores = studentResults.some(subject => 
          (subject.total !== null && subject.total !== undefined && subject.total > 0)
        );
        
        if (hasValidScores) {
          const total = studentResults.reduce((sum, subject) => {
            return sum + (subject.total || 0);
          }, 0);
          classTotals.push({ name: classmate.studentName, total });
        }
      }
    }

    // Sort by total score (descending)
    classTotals.sort((a, b) => b.total - a.total);

    // Find position of current student
    const currentPosition = classTotals.findIndex(student => student.name === studentData?.studentName) + 1;
    
    return currentPosition || 0;
  };

  // Helper function to get color based on score
  const getColorForScore = (score: number) => {
    // For midterm results, the maximum score is 40 (test 30 + project 10)
    // So we scale the thresholds accordingly (based on percentage)
    if (score >= 32) return 'text-success';  // 80% of 40
    if (score >= 24) return 'text-warning';  // 60% of 40
    if (score >= 16) return 'text-info';    // 40% of 40
    return 'text-danger';
  };

  // Helper function to get color based on grade
  const getColorForGrade = (grade: string) => {
    if (grade === 'A+' || grade === 'A') return 'text-success';
    if (grade === 'B+' || grade === 'B') return 'text-warning';
    if (grade === 'C+' || grade === 'C') return 'text-info';
    return 'text-danger';
  };

  // Function to handle printing
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

  // Get image URL for passport
  const imgUrl = 'https://BLUEBELL_SUPABASE_REF_PLACEHOLDER.supabase.co/storage/v1/object/public/passports//';

  return (
    // (uploadResult || hasResultData || hasStudentDataWithResults) ? (
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
                  <strong>Term: </strong>{selectedTerm} (Midterm)
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
                  {/* <strong>Position in Entire Class: </strong>{calculatePositionUsingSubjectScores()} Position */}
                  <strong style={{ color: 'green', fontWeight: 700 }}>Total Score:</strong> {overallScore?.overallTotal},
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
                  {/* <strong style={{ color: 'green', fontWeight: 700 }}>Total Score:</strong> {overallScore?.overallTotal}, */}
                  <strong style={{ paddingLeft: '5px', color: 'green', fontWeight: 700 }}>Average: </strong>{termResult && termResult.length > 0 ? (overallScore?.overallTotal / termResult.length).toFixed(2) : '0.00'},
                  <strong style={{ paddingLeft: '5px', color: 'green', fontWeight: 700 }}>Grade: </strong>{overallScore?.overallGrade}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Academic Results & Other Sections */}
        <section className="result-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <h3 className="title">Midterm Academic Results</h3>
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
                <th>Test (30)</th>
                <th>Project (10)</th>
                <th>Total (40)</th>
                <th>Grade</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {termResult && termResult.length > 0 ? (
                termResult.map((result) => (
                  <tr key={result.subjectName}>
                    <td>{result.subjectName.length > 20 ? abbreviateSubject(result.subjectName) : result.subjectName}</td>
                    <td className={getColorForScore(Number(result.test || result.note || result.ca1 || 0))}>
                      {result.test || result.note || result.ca1 || "-"}
                    </td>
                    <td className={getColorForScore(Number(result.project || result.homework || 0))}>
                      {result.project || result.homework || "-"}
                    </td>
                    <td className={getColorForScore(result.total || 0)}>
                      {result.total || "-"}
                    </td>
                    <td className={getColorForGrade(result.grade || "")}>
                      {result.grade || "-"}
                    </td>
                    <td>{result.remark || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center">
                    No midterm results found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Affective Traits, Psychomotor Skills, and Key Information */}
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
                      <th>Skill</th>
                      <th>Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Handwriting</td><td>{overallScore?.handWriting || '-'}</td></tr>
                    <tr><td>Verbal Fluency</td><td>{overallScore?.verbalFrequency || '-'}</td></tr>
                    <tr><td>Games/Sports</td><td>{overallScore?.games || '-'}</td></tr>
                    <tr><td>Handling Tools</td><td>{overallScore?.handlingTools || '-'}</td></tr>
                    <tr><td>Drawing/Painting</td><td>{overallScore?.drawingPainting || '-'}</td></tr>
                    <tr><td>Musical Skills</td><td>{overallScore?.musicalSkills || '-'}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="col-sm-4 traits-card">
              <h5 className="text-center section-title">Key Information</h5>
              <table className="table table-bordered table-sm redesigned-table">
                <tbody>
                  <tr><td><strong>Debit Amount:</strong></td><td>{overallScore?.debitAmount || '₦0.00'}</td></tr>
                  <tr><td><strong>Next Term Fee:</strong></td><td>
                    {(() => {
                      // Find the fee for this student's class
                      const studentClass = studentData?.studentClass;
                      const classFee = classFees.find(fee => fee.class_name === studentClass);
                      return classFee ? `₦${classFee.next_term_fees?.toLocaleString() || '0'}` : '₦0';
                    })()}
                  </td></tr>
                  <tr><td><strong>Outstanding Balance:</strong></td><td>
                    {(() => {
                      // Calculate outstanding balance
                      const studentClass = studentData?.studentClass;
                      const classFee = classFees.find(fee => fee.class_name === studentClass);
                      const classBalance = classBal.find(balance => balance.class === studentClass);
                      const feeAmount = classFee?.next_term_fees || 0;
                      const balanceAmount = classBalance?.balance || 0;
                      const outstanding = feeAmount - balanceAmount;
                      return outstanding > 0 ? `₦${outstanding.toLocaleString()}` : '₦0';
                    })()}
                  </td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Remarks Section */}
        <section className="remarks-section">
          <div className="row">
            <div className="col-sm-6">
              <div className="remark-card">
                <h5 className="text-center section-title">Form Teacher's Remark</h5>
                <p className="remark-text">{overallScore?.overallRemark || 'No remark available'}</p>
              </div>
            </div>
            <div className="col-sm-6">
              <div className="remark-card">
                <h5 className="text-center section-title">Principal's Remark</h5>
                <p className="remark-text">{overallScore?.overallPrincipalRemark || 'No remark available'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center mt-4" style={{ fontSize: '9px' }}>
          <p className="mb-1"><strong>THIS RESULT WAS ISSUED WITHOUT ERASURE AND ALTERATION</strong></p>
          <p className="mb-1">Generated on: {new Date().toLocaleDateString()}</p>
          <p className="mb-0">© {new Date().getFullYear()} Bluebell International School. All rights reserved.</p>
        </footer>
      </div>
    // ) : (
    //   <div className="container-fluid d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
    //     <div className="text-center">
    //       <h2 className="text-danger">Access Denied</h2>
    //       <p className="lead">You don't have permission to view this result.</p>
    //       <button 
    //         className="btn btn-primary"
    //         onClick={() => navigate('/login')}
    //       >
    //         Go to Login
    //       </button>
    //     </div>
    //   </div>
    // )
  );
};

export default MidtermResultCardComponent;
