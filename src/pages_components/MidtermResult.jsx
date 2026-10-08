// import React, { useState, useEffect } from "react";
// import { useRouter } from "next/router";
// import { supabase } from "../supabaseClient.js";
// import { ToastContainer, toast } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";
// import Button from "react-bootstrap/Button";
// import Form from "react-bootstrap/Form";
// import Modal from "react-bootstrap/Modal";
// import SideNav from "../components/SideNav";
// import BottomNav from "../components/BottomNav";
// import { abbreviateSubject } from '../utils/subjectUtils';

// // Predefined subjects for each class category
// const schoolSubjects = {
//   "creche": [
//     "Literacy",
//     "Numeracy",
//     "General Subjects",
//     "Pre-writing",
//     "Christian Religious Knowledge",
//     "Diction"
//   ],
//   "pre-nursery1": [
//     "Literacy",
//     "Numeracy",
//     "General Subjects",
//     "Pre-writing",
//     "Christian Religious Knowledge",
//     "Diction"
//   ],
//   "pre-nursery2": [
//     "Literacy",
//     "Numeracy",
//     "General Subjects",
//     "Pre-writing",
//     "Christian Religious Knowledge",
//     "Diction"
//   ],
//   "nursery": [
//     "Literacy",
//     "Numeracy",
//     "General Subjects",
//     "Pre-writing",
//     "Christian Religious Knowledge",
//     "Arts and Craft",
//     "Diction"
//   ],
//   "year1": [
//     "Basic Science",
//     "Physical and Health Education",
//     "Information & Computer Technology",
//     "Pre-Vocational",
//     "Christian Religious Knowledge",
//     "English Studies",
//     "Mathematics",
//     "Social Studies",
//     "Fine Art",
//     "French"
//   ],
//   "year2": [
//     "Basic Science",
//     "Physical and Health Education",
//     "Information & Computer Technology",
//     "Pre-Vocational",
//     "Christian Religious Knowledge",
//     "English Studies",
//     "Mathematics",
//     "Social Studies",
//     "Fine Art",
//     "French"
//   ],
//   "year3": [
//     "Basic Science",
//     "Physical and Health Education",
//     "Information & Computer Technology",
//     "Pre-Vocational",
//     "Christian Religious Knowledge",
//     "English Studies",
//     "Mathematics",
//     "Social Studies",
//     "Fine Art",
//     "French"
//   ],
//   "year4": [
//     "Basic Science",
//     "Physical and Health Education",
//     "Information & Computer Technology",
//     "Pre-Vocational",
//     "Christian Religious Knowledge",
//     "English Studies",
//     "Mathematics",
//     "Social Studies",
//     "Fine Art",
//     "French"
//   ],
//   "year5": [
//     "Basic Science",
//     "Physical and Health Education",
//     "Information & Computer Technology",
//     "Pre-Vocational",
//     "Christian Religious Knowledge",
//     "English Studies",
//     "Mathematics",
//     "Social Studies",
//     "Fine Art",
//     "French"
//   ],
//   "year6": [
//     "Basic Science",
//     "Physical and Health Education",
//     "Information & Computer Technology",
//     "Business Studies",
//     "Home Economics",
//     "Christian Religious Knowledge",
//     "English Studies",
//     "Mathematics",
//     "Social Studies",
//     "Fine Art",
//     "French"
//   ],
//   "year7": [
//     "Basic Science",
//     "Physical and Health Education",
//     "Information & Computer Technology",
//     "Business Studies",
//     "Home Economics",
//     "Christian Religious Knowledge",
//     "English Studies",
//     "Mathematics",
//     "Social Studies",
//     "Fine Art",
//     "French"
//   ],
//   "year8": [
//     "Basic Science",
//     "Physical and Health Education",
//     "Information & Computer Technology",
//     "Business Studies",
//     "Home Economics",
//     "Christian Religious Knowledge",
//     "English Studies",
//     "Mathematics",
//     "Social Studies",
//     "Fine Art",
//     "French"
//   ],
//   "year9": [
//     "Basic Science",
//     "Physical and Health Education",
//     "Information & Computer Technology",
//     "Business Studies",
//     "Home Economics",
//     "Christian Religious Knowledge",
//     "English Studies",
//     "Mathematics",
//     "Social Studies",
//     "Fine Art",
//     "French"
//   ]
// };

// const MidtermResult = () => {
//   const [user, setUser] = useState();
//   const [teacherAuth, setTeacherAuth] = useState([]);
//   const [userAuth, setUserAuth] = useState([]);
//   const [devAuth, setDevAuth] = useState([]);
//   const [students, setStudents] = useState([]);
//   const [selectedStudent, setSelectedStudent] = useState("");
//   const [studentClassFilter, setStudentClassFilter] = useState("");
//   const [subjects, setSubjects] = useState([]);
//   const [scores, setScores] = useState({});
//   const [termFilter, setTermFilter] = useState("1st term");
//   const [showModal, setShowModal] = useState(false);
//   const [isUploading, setIsUploading] = useState(false);
//   const [showPreviewModal, setShowPreviewModal] = useState(false);
//   const [showClassStats, setShowClassStats] = useState(false);
//   const [classStats, setClassStats] = useState([]);
//   const [expandedClass, setExpandedClass] = useState(null);
//   const [uploadedStudents, setUploadedStudents] = useState({});
//   const [studentIdMap, setStudentIdMap] = useState({});
//   const [collapsed, setCollapsed] = useState(false);
  
//   // Detect mobile device
//   const [isMobile, setIsMobile] = useState(false);
  
//   // Check if user is teacher or admin
//   const [isTeacher, setIsTeacher] = useState(false);
//   const [isAdmin, setIsAdmin] = useState(false);

//   // Safely initialize router
//   let router;
//   let isRouterAvailable = false;
  
//   try {
//     router = useRouter();
//     isRouterAvailable = router && router.push;
//   } catch (error) {
//     console.warn('NextRouter not available in this context');
//   }

//   useEffect(() => {
//     // Check if on mobile device
//     const checkIsMobile = () => {
//       setIsMobile(window.innerWidth <= 768);
//     };
    
//     checkIsMobile();
//     window.addEventListener('resize', checkIsMobile);
    
//     // Cleanup listener
//     return () => {
//       window.removeEventListener('resize', checkIsMobile);
//     };
//   }, []);
  
//   useEffect(() => {
//     const initializeData = async () => {
//       try {
//         // Get current user
//         const { data: { user: currentUser } } = await supabase.auth.getUser();
        
//         if (!currentUser) {
//           return;
//         }
        
//         setUser(currentUser);
        
//         // Fetch all required data in parallel
//         const [teacherData, userData, devData, studentsData] = await Promise.all([
//           supabase.from('jmis_teacherauth').select('email'),
//           supabase.from('jmis_userauth').select('email'),
//           supabase.from('devauth').select('email'),
//           supabase.from('jmis_student').select('*')
//         ]);
        
//         // Handle teacher auth data
//         if (teacherData.error) throw teacherData.error;
//         setTeacherAuth(teacherData.data || []);
        
//         // Handle user auth data
//         if (userData.error) throw userData.error;
//         setUserAuth(userData.data || []);
        
//         // Handle dev auth data
//         if (devData.error) throw devData.error;
//         setDevAuth(devData.data || []);
        
//         // Handle students data
//         if (studentsData.error) throw studentsData.error;
//         setStudents(studentsData.data || []);
        
//         // Create student ID map
//         const idMap = {};
//         studentsData.data.forEach(student => {
//           idMap[student.name] = {
//             id: student.id,
//             class: student.class
//           };
//         });
//         setStudentIdMap(idMap);
        
//         // Check if user is teacher or admin
//         const userIsTeacher = teacherData.data && teacherData.data.some(auth => auth.email === currentUser?.user_metadata?.email);
//         const userIsAdmin = userData.data && userData.data.some(auth => auth.email === currentUser?.user_metadata?.email);
        
//         setIsTeacher(userIsTeacher);
//         setIsAdmin(userIsAdmin);
        
//       } catch (error) {
//         console.error('Error initializing data:', error);
//         toast.error("Failed to fetch data. Please check your internet connection.");
//       }
//     };
    
//     initializeData();
//   }, []);

//   useEffect(() => {
//     if (selectedStudent && studentClassFilter) {
//       // Normalize class name for lookup in schoolSubjects
//       const normalizedClass = studentClassFilter.toLowerCase().replace(/\s+/g, '');
//       const classSubjects = schoolSubjects[normalizedClass] || [];
//       setSubjects(classSubjects);
      
//       // Initialize scores for all subjects (test and project only for midterm) with remarks
//       const initialScores = {};
//       classSubjects.forEach(subject => {
//         initialScores[subject] = {
//           test: "",
//           project: "",
//           remark: "",
//           useCustomRemark: false,
//           customRemark: ""
//         };
//       });
      
//       // Add overall evaluation fields
//       initialScores.useCustomOverallRemark = false;
//       initialScores.customOverallRemark = "";
      
//       setScores(initialScores);
      
//       // Fetch existing midterm results if they exist
//       fetchExistingMidtermResults();
//     }
//   }, [selectedStudent, studentClassFilter]);
  
//   const fetchExistingMidtermResults = async () => {
//     if (!selectedStudent || !studentClassFilter || !termFilter) return;
    
//     const studentInfo = studentIdMap[selectedStudent];
//     if (!studentInfo) return;
    
//     try {
//       const { data: existingResultData, error: fetchError } = await supabase
//         .from("jmis_result")
//         .select("*")
//         .eq("studentId", studentInfo.id)
//         .single();
      
//       if (fetchError && fetchError.code !== "PGRST116") {
//         throw fetchError;
//       }
      
//       if (existingResultData) {
//         // Get the correct term key based on selected term
//         const termKey =
//           termFilter === "1st term"
//             ? "term1midtermsubjects"
//             : termFilter === "2nd term"
//               ? "term2midtermsubjects"
//               : "term3midtermsubjects";
        
//         const termResults = existingResultData[termKey];
        
//         if (termResults && termResults.length > 0) {
//           // Get the current subjects for this class
//           const normalizedClass = studentClassFilter.toLowerCase().replace(/\s+/g, '');
//           const classSubjects = schoolSubjects[normalizedClass] || [];
          
//           // Create a new scores object based on current subjects
//           const updatedScores = {};
          
//           // First, initialize with current scores structure
//           classSubjects.forEach(subject => {
//             updatedScores[subject] = {
//               test: "",
//               project: "",
//               remark: "",
//               useCustomRemark: false,
//               customRemark: ""
//             };
//           });
          
//           // Then, update with existing data
//           termResults.forEach(result => {
//             const subjectName = result.subjectName;
//             if (updatedScores[subjectName]) {
//               updatedScores[subjectName] = {
//                 test: result.test || "",
//                 project: result.project || "",
//                 remark: result.remark || "",
//                 useCustomRemark: false, // Default to false, can be adjusted based on your logic
//                 customRemark: ""
//               };
//             }
//           });
          
//           setScores(updatedScores);
//         }
//       }
//     } catch (error) {
//       console.error("Error fetching existing midterm results:", error);
//       // Don't show error toast here as it might be expected that not all students have existing results
//     }
//   };

//   const handleScoreChange = (subject, field, value) => {
//     setScores(prev => ({
//       ...prev,
//       [subject]: {
//         ...prev[subject],
//         [field]: value
//       }
//     }));
//   };
  
//   const handleInputChange = (field, key, value) => {
//     setScores((prevScores) => {
//       let newScores;
      
//       // If key is empty string, treat as a simple value assignment
//       if (key === "") {
//         newScores = {
//           ...prevScores,
//           [field]: value,
//         };
//       } else {
//         // Otherwise, treat as a nested object property
//         newScores = {
//           ...prevScores,
//           [field]: {
//             ...prevScores[field],
//             [key]: value,
//           }
//         };
//       }
      
//       return newScores;
//     });
//   }

//   const calculateTotal = (subjectScores) => {
//     const test = parseFloat(subjectScores.test) || 0;
//     const project = parseFloat(subjectScores.project) || 0;
//     // For midterm, only test and project scores are used
//     return test + project;
//   };

//   const determineGrade = (total) => {
//     // For midterm results, the maximum score is 40 (test 30 + project 10)
//     // So we scale the thresholds accordingly (based on percentage)
//     if (total >= 38.4) return "A+";  // 96% of 40
//     if (total >= 34.4) return "A";   // 86% of 40
//     if (total >= 32) return "B+";    // 80% of 40
//     if (total >= 28) return "B";     // 70% of 40
//     if (total >= 26.4) return "C+";  // 66% of 40
//     if (total >= 22.4) return "C";   // 56% of 40
//     if (total >= 18.4) return "D";   // 46% of 40
//     return "E";
//   };

//   const gradeRemarks = {
//     "A+": ["Excellent", "Outstanding", "Keep it up"],
//     "A": ["Very good", "Outstanding", "Great effort"],
//     "B+": ["Good", "Satisfactory", "More effort"],
//     "B": ["Good", "Satisfactory", "Work harder"],
//     "C+": ["Fair", "Below average", "More effort"],
//     "C": ["Fair", "Needs attention", "Focus more"],
//     "D": ["Poor", "Unacceptable", "Serious help needed"],
//     "E": ["Poor", "Failing", "Immediate help"]
//   };

//   const calculateOverallTotal = () => {
//     return subjects.reduce((sum, subject) => {
//       return sum + calculateTotal(scores[subject]);
//     }, 0);
//   };

//   const calculateOverallGrade = () => {
//     const overallTotal = calculateOverallTotal();
//     const average = subjects.length > 0 ? overallTotal / subjects.length : 0;
//     return determineGrade(average);
//   };

//   const overallRemark = () => {
//     const grade = calculateOverallGrade();
//     if (grade && gradeRemarks[grade]) {
//       return gradeRemarks[grade][2];
//     }
//     return "";
//   };

//   const uploadResults = async () => {
//     if (!selectedStudent || !studentClassFilter || !termFilter) {
//       toast.warn("Please fill in all fields before uploading results.");
//       return;
//     }

//     const studentInfo = studentIdMap[selectedStudent];
//     if (!studentInfo) {
//       toast.error("Please select a valid student.");
//       return;
//     }

//     // Set loading state
//     setIsUploading(true);

//     const studentId = studentInfo.id;
//     const studentClass = studentInfo.class || studentClassFilter;

//     const termKey =
//       termFilter === "1st term"
//         ? "term1midtermsubjects"
//         : termFilter === "2nd term"
//           ? "term2midtermsubjects"
//           : "term3midtermsubjects";

//     const termSubjectsToUpload = subjects.map((subject) => {
//       const subjectScores = scores[subject] || {};
//       const total = calculateTotal(subjectScores);
      
//       // Determine which remark to save based on user selection
//       let remarkToSave = "";
//       if (subjectScores.useCustomRemark) {
//         remarkToSave = subjectScores.customRemark ?? "";
//       } else {
//         remarkToSave = subjectScores.remark ?? "";
//       }
      
//       return {
//         subjectName: subject,
//         test: subjectScores.test ?? "0",
//         project: subjectScores.project ?? "0",
//         total: total,
//         grade: determineGrade(total),
//         remark: remarkToSave
//       };
//     });

//     const overallKey =
//       termFilter === "1st term"
//         ? "overall1midterm"
//         : termFilter === "2nd term"
//           ? "overall2midterm"
//           : "overall3midterm";

//     const termOverallToUpload = {
//       overallTotal: calculateOverallTotal(),
//       overallGrade: calculateOverallGrade(),
//       overallRemark: overallRemark(),
//       daysPresent: scores["daysPresent"]?.value || "0",
//       daysAbsent: scores["daysAbsent"]?.value || "0"
//     };

//     try {
//       // Check if result already exists for this student
//       const { data: existingResultData, error: fetchError } = await supabase
//         .from("jmis_result")
//         .select("*")
//         .eq("studentId", studentId)
//         .single();

//       if (fetchError && fetchError.code !== "PGRST116") {
//         throw fetchError;
//       }

//       const updateData = {
//         studentId,
//         studentName: selectedStudent,
//         studentClass: studentClass.replace(/\s+/g, ''),
//         [termKey]: termSubjectsToUpload,
//         [overallKey]: termOverallToUpload,
//         uploadResult: true
//       };

//       let result;
//       if (existingResultData) {
//         // Update existing record
//         const { data, error } = await supabase
//           .from("jmis_result")
//           .update(updateData)
//           .eq("studentId", studentId);
          
//         if (error) throw error;
//         result = data;
//       } else {
//         // Create new record
//         const { data, error } = await supabase
//           .from("jmis_result")
//           .insert([updateData]);
          
//         if (error) throw error;
//         result = data;
//       }

//       toast.success("Midterm results uploaded successfully!");
//       setShowModal(false);
      
//     } catch (error) {
//       console.error("Error uploading results:", error);
//       toast.error("Failed to upload results: " + error.message);
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   const filteredStudents = students.filter(
//     (student) => {
//       if (studentClassFilter === "") return true;
      
//       // Normalize class names for comparison
//       const normalizedFilter = studentClassFilter.toLowerCase().replace(/\s+/g, '');
//       const normalizedStudentClass = student.class.toLowerCase().replace(/\s+/g, '');
      
//       return normalizedStudentClass === normalizedFilter;
//     }
//   );
  
//   useEffect(() => {
//     const fetchClassStats = async () => {
//       try {
//         const { data: studentsData, error: studentsError } = await supabase
//           .from("jmis_student")
//           .select("class");

//         const { data: resultsData, error: resultsError } = await supabase
//           .from("jmis_result")
//           .select("studentClass, term1midtermsubjects, term2midtermsubjects, term3midtermsubjects");

//         if (studentsError || resultsError) {
//           throw new Error(studentsError?.message || resultsError?.message);
//         }

//         const classCounts = studentsData.reduce((acc, student) => {
//           acc[student.class] = (acc[student.class] || 0) + 1;
//           return acc;
//         }, {});

//         const resultCounts = resultsData.reduce((acc, result) => {
//           const termKey =
//             termFilter === "1st term"
//               ? "term1midtermsubjects"
//               : termFilter === "2nd term"
//                 ? "term2midtermsubjects"
//                 : "term3midtermsubjects";

//           if (result[termKey] && result[termKey].length > 0) {
//             acc[result.studentClass] = (acc[result.studentClass] || 0) + 1;
//           }
//           return acc;
//         }, {});

//         const stats = Object.keys(classCounts).map((className) => ({
//           className,
//           totalPupils: classCounts[className],
//           resultsUploaded: resultCounts[className] || 0,
//         }));

//         setClassStats(stats);
//       } catch (error) {
//         toast.error("Error fetching class stats: " + error.message);
//       }
//     };

//     if (termFilter) {
//       fetchClassStats();
//     }
//   }, [termFilter]); // Refetch stats when the term changes

//   return (
//     <div style={{ display: "flex", minHeight: "100vh" }}>
//       {/* Sidebar - only show on desktop */}
//       {!isMobile && (
//         <aside style={{
//           width: collapsed ? 70 : 240,
//           transition: "width 0.2s",
//           height: "100vh",
//           position: "fixed",
//           top: 0,
//           left: 0,
//           zIndex: 1000,
//         }}>
//           <SideNav collapsed={collapsed} setCollapsed={setCollapsed} />
//         </aside>
//       )}
      
//       <main
//         style={{
//           flex: 1,
//           padding: isMobile ? 16 : 24,
//           transition: "margin-left 0.2s",
//           minHeight: "100vh",
//           marginBottom: isMobile ? 70 : 0, // space for bottom nav
//           marginLeft: isMobile ? 0 : (collapsed ? 70 : 240), // Add left margin when sidebar is visible
//           position: "relative",
//         }}
//       >
//         <div className="container-fluid mt-4">
//           <ToastContainer />
//           <h2 className="mb-4">Midterm Results Management</h2>
          
//           {(teacherAuth && teacherAuth.some && teacherAuth.some(auth => auth.email === user?.user_metadata?.email)) ||
//            (userAuth && userAuth.some && userAuth.some(auth => auth.email === user?.user_metadata?.email)) ||
//            (devAuth && devAuth.some && devAuth.some(auth => auth.email === user?.user_metadata?.email)) ? (
//             <>
//               <div className="row mb-4">
//                 <div className="col-md-4">
//                   <Form.Group>
//                     <Form.Label>Student Class</Form.Label>
//                     <Form.Select
//                       value={studentClassFilter}
//                       onChange={(e) => {
//                         setStudentClassFilter(e.target.value);
//                         setSelectedStudent("");
//                       }}
//                     >
//                       <option value="">Select Class</option>
//                       <option value="Creche">Creche</option>
//                       <option value="Pre Nursery1">Pre Nursery 1</option>
//                       <option value="Pre Nursery2">Pre Nursery 2</option>
//                       <option value="Nursery">Nursery</option>
//                       <option value="Year 1">Year 1</option>
//                       <option value="Year 2">Year 2</option>
//                       <option value="Year 3">Year 3</option>
//                       <option value="Year 4">Year 4</option>
//                       <option value="Year 5">Year 5</option>
//                       <option value="Year 6">Year 6</option>
//                       <option value="Year 7">Year 7</option>
//                       <option value="Year 8">Year 8</option>
//                       <option value="Year 9">Year 9</option>
//                     </Form.Select>
//                   </Form.Group>
//                 </div>
                
//                 <div className="col-md-4">
//                   <Form.Group>
//                     <Form.Label>Student Name</Form.Label>
//                     <Form.Select
//                       value={selectedStudent}
//                       onChange={(e) => setSelectedStudent(e.target.value)}
//                       disabled={!studentClassFilter}
//                     >
//                       <option value="">Select Student</option>
//                       {filteredStudents.map((student) => (
//                         <option key={student.id} value={student.name}>
//                           {student.name}
//                         </option>
//                       ))}
//                     </Form.Select>
//                   </Form.Group>
//                 </div>
                
//                 <div className="col-md-4">
//                   <Form.Group>
//                     <Form.Label>Term</Form.Label>
//                     <Form.Select
//                       value={termFilter}
//                       onChange={(e) => setTermFilter(e.target.value)}
//                     >
//                       <option value="1st term">1st Term</option>
//                       <option value="2nd term">2nd Term</option>
//                       <option value="3rd term">3rd Term</option>
//                     </Form.Select>
//                   </Form.Group>
//                 </div>
//               </div>

//               {selectedStudent && studentClassFilter && (
//                 <div>
//                   <h4 className="mb-3">
//                     Enter Midterm Scores for {selectedStudent} ({studentClassFilter})
//                   </h4>
                  
//                   <div className="table-responsive">
//                     <table className="table table-bordered">
//                       <thead>
//                         <tr>
//                           <th>Subject</th>
//                           <th>Test</th>
//                           <th>Project</th>
//                           <th>Total (40)</th>
//                           <th>Grade</th>
//                           <th>Teacher's Remark</th>
//                         </tr>
//                       </thead>
//                       <tbody>
//                         {subjects.map((subject) => {
//                           const subjectScores = scores[subject] || {};
//                           const total = calculateTotal(subjectScores);
//                           const grade = determineGrade(total);
                          
//                           return (
//                             <tr key={subject}>
//                               <td>{subject.length > 20 ? abbreviateSubject(subject) : subject}</td>
//                               <td>
//                                 <Form.Control
//                                   type="number"
//                                   min="0"
//                                   max="30"
//                                   value={subjectScores.test || ""}
//                                   onChange={(e) =>
//                                     handleScoreChange(subject, "test", e.target.value)
//                                   }
//                                 />
//                               </td>
//                               <td>
//                                 <Form.Control
//                                   type="number"
//                                   min="0"
//                                   max="10"
//                                   value={subjectScores.project || ""}
//                                   onChange={(e) =>
//                                     handleScoreChange(subject, "project", e.target.value)
//                                   }
//                                 />
//                               </td>
//                               <td>{total}</td>
//                               <td>{grade}</td>
//                               <td>
//                                 <div className="d-flex flex-column gap-2">
//                                   {/* Radio buttons to choose between auto-generated and custom remark */}
//                                   <div className="d-flex gap-3">
//                                     <div className="form-check">
//                                       <input
//                                         className="form-check-input"
//                                         type="radio"
//                                         name={`remarkType-${subject}`}
//                                         id={`autoRemark-${subject}`}
//                                         checked={!subjectScores?.useCustomRemark}
//                                         onChange={() => handleInputChange(subject, "useCustomRemark", false)}
//                                       />
//                                       <label className="form-check-label" htmlFor={`autoRemark-${subject}`}>
//                                         Auto
//                                       </label>
//                                     </div>
//                                     <div className="form-check">
//                                       <input
//                                         className="form-check-input"
//                                         type="radio"
//                                         name={`remarkType-${subject}`}
//                                         id={`customRemark-${subject}`}
//                                         checked={subjectScores?.useCustomRemark}
//                                         onChange={() => handleInputChange(subject, "useCustomRemark", true)}
//                                       />
//                                       <label className="form-check-label" htmlFor={`customRemark-${subject}`}>
//                                         Custom
//                                       </label>
//                                     </div>
//                                   </div>
                                  
//                                   {/* Show auto-generated remarks dropdown when auto is selected */}
//                                   {!subjectScores?.useCustomRemark && (
//                                     <select
//                                       className="form-control"
//                                       value={subjectScores?.remark || ""}
//                                       onChange={(e) =>
//                                         handleInputChange(subject, "remark", e.target.value)
//                                       }
//                                     >
//                                       <option value="">Select Auto Remark</option>
//                                       {gradeRemarks[
//                                         determineGrade(total)
//                                       ]?.map((remark, index) => (
//                                         <option key={index} value={remark}>
//                                           {remark}
//                                         </option>
//                                       ))}
//                                     </select>
//                                   )}
                                  
//                                   {/* Show custom remark input when custom is selected */}
//                                   {subjectScores?.useCustomRemark && (
//                                     <input
//                                       type="text"
//                                       className="form-control"
//                                       placeholder="Enter custom remark"
//                                       value={subjectScores?.customRemark || ""}
//                                       onChange={(e) =>
//                                         handleInputChange(subject, "customRemark", e.target.value)
//                                       }
//                                     />
//                                   )}
//                                 </div>
//                               </td>
//                             </tr>
//                           );
//                         })}
//                       </tbody>
//                     </table>
//                   </div>

//                   <div className="mt-4">
//                     <h5>Overall Summary</h5>
//                     <p><strong>Total Score:</strong> {calculateOverallTotal()}</p>
//                     <p><strong>Overall Grade:</strong> {calculateOverallGrade()}</p>
//                     <p><strong>Remark:</strong> {overallRemark()}</p>
//                   </div>

//                   <div className="d-flex flex gap-5">
//                     <Button
//                       variant="primary"
//                       onClick={() => setShowModal(true)}
//                       disabled={isUploading}
//                     >
//                       {isUploading ? "Uploading..." : "Upload Midterm Results"}
//                     </Button>
//                     <Button
//                       variant="warning"
//                       onClick={() => setShowPreviewModal(true)} // Open the preview modal
//                       disabled={!selectedStudent || !studentClassFilter || !termFilter}
//                     >
//                       Preview Result
//                     </Button>
//                     <Button
//                       variant="secondary"
//                       onClick={() => setShowClassStats(!showClassStats)} // Toggle visibility
//                     >
//                       {showClassStats ? "Hide Class Stats" : "Show Class Stats"}
//                     </Button>
//                     {studentClassFilter && termFilter && (
//                       <div style={{ marginLeft: "20px", fontSize: "1rem", color: "#555" }}>
//                         {classStats
//                           .filter(stat => stat.className === studentClassFilter)
//                           .map(stat => (
//                             <span key={stat.className} style={{ color: '#2d89ef', fontWeight: 600, fontSize: '1.5rem' }}>
//                               Class Total: {stat.totalPupils}, Results Uploaded: {stat.resultsUploaded}
//                             </span>
//                           ))}
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               )}
              
//               {showClassStats && (
//                 <div className="class-stats mt-5">
//                   <h3 style={{ textAlign: "center", marginBottom: "20px", color: "#2d89ef" }}>
//                     Class Statistics
//                   </h3>
//                   {classStats.map((stat, index) => (
//                     <div
//                       key={index}
//                       className="card shadow-sm mb-3"
//                       style={{
//                         borderRadius: "10px",
//                         border: "1px solid #ccc",
//                         overflow: "hidden",
//                       }}
//                     >
//                       <div
//                         className="card-header d-flex justify-content-between align-items-center"
//                         style={{
//                           backgroundColor: "#f8f9fa",
//                           padding: "10px 15px",
//                           cursor: "pointer",
//                         }}
//                         onClick={async () => {
//                           if (expandedClass === stat.className) {
//                             setExpandedClass(null); // Collapse if already expanded
//                           } else {
//                             setExpandedClass(stat.className); // Expand the clicked class

//                             if (!uploadedStudents[stat.className]) {
//                               try {
//                                 const termKey =
//                                   termFilter === "1st term"
//                                     ? "term1MidtermSubjects"
//                                     : termFilter === "2nd term"
//                                       ? "term2MidtermSubjects"
//                                       : "term3MidtermSubjects";

//                                 const { data, error } = await supabase
//                                   .from("jmis_result")
//                                   .select("studentName")
//                                   .eq("studentClass", stat.className)
//                                   .not(termKey, "is", null); // Dynamically check the correct term column

//                                 if (error) throw error;

//                                 setUploadedStudents((prev) => ({
//                                   ...prev,
//                                   [stat.className]: data.map((item) => item.studentName),
//                                 }));
//                               } catch (err) {
//                                 toast.error("Error fetching student names: " + err.message);
//                               }
//                             }
//                           }
//                         }}
//                       >
//                         <span style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
//                           {stat.className}
//                         </span>
//                         <span
//                           style={{
//                             fontSize: "0.9rem",
//                             color: "#555",
//                           }}
//                         >
//                           Total Pupils: {stat.totalPupils} | Results Uploaded: {stat.resultsUploaded}
//                         </span>
//                       </div>
//                       {expandedClass === stat.className && (
//                         <div
//                           style={{
//                             backgroundColor: "#fff",
//                             padding: "10px 15px",
//                             borderTop: "1px solid #ccc",
//                           }}
//                         >
//                           <h5 style={{ marginBottom: "10px", color: "#2d89ef" }}>
//                             Uploaded Students:
//                           </h5>
//                           {uploadedStudents[stat.className]?.length > 0 ? (
//                             <ol style={{ paddingLeft: "20px" }}>
//                               {uploadedStudents[stat.className].map((student, idx) => (
//                                 <li key={idx} style={{ marginBottom: "5px", color: "#333" }}>
//                                   {student}
//                                 </li>
//                               ))}
//                             </ol>
//                           ) : (
//                             <p style={{ color: "#555" }}>No students found.</p>
//                           )}
//                         </div>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               )}

//               <Modal show={showModal} onHide={() => setShowModal(false)}>
//                 <Modal.Header closeButton>
//                   <Modal.Title>Confirm Midterm Results Upload</Modal.Title>
//                 </Modal.Header>
//                 <Modal.Body>
//                   <p>Are you sure you want to upload these midterm results for {selectedStudent}?</p>
//                   <p><strong>Class:</strong> {studentClassFilter}</p>
//                   <p><strong>Term:</strong> {termFilter}</p>
//                   <p><strong>Overall Total:</strong> {calculateOverallTotal()}</p>
//                   <p><strong>Overall Grade:</strong> {calculateOverallGrade()}</p>
//                 </Modal.Body>
//                 <Modal.Footer>
//                   <Button variant="secondary" onClick={() => setShowModal(false)}>
//                     Cancel
//                   </Button>
//                   <Button variant="primary" onClick={uploadResults} disabled={isUploading}>
//                     {isUploading ? "Uploading..." : "Confirm Upload"}
//                   </Button>
//                 </Modal.Footer>
//               </Modal>
              
//               <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} size="lg">
//                 <Modal.Header closeButton>
//                   <Modal.Title>Midterm Result Preview</Modal.Title>
//                 </Modal.Header>
//                 <Modal.Body>
//                   <div className="preview-content">
//                     <h4>Student: {selectedStudent}</h4>
//                     <h5>Class: {studentClassFilter}</h5>
//                     <h5>Term: {termFilter}</h5>
//                     <div className="table-responsive">
//                       <table className="table table-bordered">
//                         <thead>
//                           <tr>
//                             <th>Subject</th>
//                             <th>Test</th>
//                             <th>Project</th>
//                             <th>Total</th>
//                             <th>Grade</th>
//                             <th>Remark</th>
//                           </tr>
//                         </thead>
//                         <tbody>
//                           {subjects.map((subject) => {
//                             const subjectScores = scores[subject] || {};
//                             const total = calculateTotal(subjectScores);
//                             const grade = determineGrade(total);
                            
//                             // Determine which remark to display
//                             let remarkToDisplay = "";
//                             if (subjectScores.useCustomRemark) {
//                               remarkToDisplay = subjectScores.customRemark || "";
//                             } else {
//                               remarkToDisplay = subjectScores.remark || "";
//                             }
                            
//                             return (
//                               <tr key={subject}>
//                                 <td>{subject}</td>
//                                 <td>{subjectScores.test || ""}</td>
//                                 <td>{subjectScores.project || ""}</td>
//                                 <td>{total}</td>
//                                 <td>{grade}</td>
//                                 <td>{remarkToDisplay}</td>
//                               </tr>
//                             );
//                           })}
//                         </tbody>
//                       </table>
//                     </div>
//                     <div className="overall-summary mt-3">
//                       <h5>Overall Summary</h5>
//                       <p><strong>Total Score:</strong> {calculateOverallTotal()}</p>
//                       <p><strong>Overall Grade:</strong> {calculateOverallGrade()}</p>
//                       <p><strong>Overall Remark:</strong> {overallRemark()}</p>
//                     </div>
//                   </div>
//                 </Modal.Body>
//                 <Modal.Footer>
//                   <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
//                     Close
//                   </Button>
//                 </Modal.Footer>
//               </Modal>
//             </>
//           ) : (
//             <div className="alert alert-danger">
//               <h4>Unauthorized Access</h4>
//               <p>You don't have permission to access this page.</p>
//             </div>
//           )}
//         </div>
//       </main>
      
//       {/* Bottom Navigation - only show on mobile */}
//       {isMobile && (
//         <BottomNav isTeacher={isTeacher} isAdmin={isAdmin} />
//       )}
//     </div>
//   );
// };

// export default MidtermResult;