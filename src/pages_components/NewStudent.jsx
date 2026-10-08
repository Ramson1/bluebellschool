// Added drag-and-drop functionality and a file upload button for the passport image without removing student token functionality
import "bootstrap/dist/css/bootstrap.min.css";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { NavbarComponent } from "../components/Navbar";
import { supabase } from "../supabaseClient";
import { CLASS_OPTIONS } from "../utils/classOptions";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { sendEmailNotification } from "../api/emailNotificationService";
import { logAction } from "../api/auditLog";
import "../styles/NewStudent.css";
import {
  RiUserAddLine,
  RiUserLine,
  RiIdCardLine,
  RiUploadCloud2Line,
  RiTableLine,
  RiErrorWarningLine,
} from 'react-icons/ri';
import "../styles/AdminPages.css";
import { DEV_EMAILS } from "../utils/authUtils";
import * as XLSX from 'xlsx';

export default function NewStudent() {
  const [user, setUser] = useState();
  const [teacherAuth, setTeacherAuth] = useState([]);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [sex, setSex] = useState("");
  const [parentContact, setParentContact] = useState("");
  const [studentToken, setStudentToken] = useState(""); // Student token remains
  const [passport, setPassport] = useState(null); // State for the uploaded image file
  const [loading, setLoading] = useState(true); // Change to single loading state
  const [passportImage, setPassportImage] = useState("");
  const [dragActive, setDragActive] = useState(false); // State for drag-and-drop functionality
  
  // Bulk upload states
  const [bulkImages, setBulkImages] = useState([]); // For multiple image selection
  const [bulkStudentData, setBulkStudentData] = useState(""); // For student data text
  const [bulkUploading, setBulkUploading] = useState(false); // For bulk upload loading state

  // Safely initialize router
  let router;
  let isRouterAvailable = false;
  
  try {
    router = useRouter();
    isRouterAvailable = router && router.push;
  } catch (error) {
    console.warn('NextRouter not available in this context');
  }

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
        const [userData, teacherData, devData] = await Promise.all([
          supabase.from('jmis_userauth').select('email'),
          supabase.from('jmis_teacherauth').select('email'),
          supabase.from('devauth').select('email')
        ]);
        
        // Handle user auth data
        if (userData.error) throw userData.error;
        setUserAuth(userData.data || []);
        
        // Handle teacher auth data
        if (teacherData.error) throw teacherData.error;
        setTeacherAuth(teacherData.data || []);
        
        // Handle dev auth data
        if (devData.error) throw devData.error;
        setDevAuth(devData.data || []);
        
        // Check if user is a teacher and redirect if needed
        const isTeacher = teacherData.data && teacherData.data.some(auth => auth.email === currentUser?.user_metadata?.email);
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

  // Canonical Creche → Year 12 list (see utils/classOptions.js)
  const classOptions = CLASS_OPTIONS;

  const sexOptions = ["Male", "Female"];

  const uploadImage = async (file) => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      setPassportImage(fileName);
      const { error } = await supabase.storage
        .from("passport")
        .upload(fileName, file);

      if (error) {
        throw error;
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from("passport")
          .getPublicUrl(fileName);
        return publicUrl;
      }
    } catch (error) {
      console.error(error);
      toast.error("Error uploading image: " + error.message);
      return null;
    }
  };

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

  const handleStudentInput = async () => {
    setLoading(true);
    try {
      let passportURL = null;
      if (passport) {
        passportURL = await uploadImage(passport);
      }

      const studentData = {
        name,
        class: className,
        sex,
        parentcontact: parentContact,
        token: studentToken,
        passport: passportURL || passportImage,
        user_id: user?.identities?.[0]?.identity_data?.full_name || user?.email || '',
      };

      const { error } = await supabase.from("jmis_student").insert([studentData]);

      if (error) {
        toast.error("Error creating student: " + error.message);
      } else {
        toast.success("Student Successfully Added to Database!");

        // Audit: student added
        logAction(supabase, {
          email: getCurrentUserEmail(),
          role: getAuditRole(),
          action: "student_add",
          targetTable: "jmis_student",
          details: { name, class: className, sex, parentcontact: parentContact },
        });
        
        // Send email notification for new student
        const currentUserEmail = getCurrentUserEmail();
        const emailSubject = 'New Student Added';
        const emailMessage = `A new student record has been added by ${currentUserEmail}:

Student Name: ${name}
Class: ${className}
Gender: ${sex}
Parent Contact: ${parentContact}`;
        await sendEmailNotification(supabase, emailSubject, emailMessage);
        
        setName("");
        setClassName("");
        setSex("");
        setParentContact("");
        setStudentToken("");
        setPassport(null);
        setPassportImage("");
        // router.push("/home");
      }
    } catch (error) {
      toast.error("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Drag-and-drop event handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setPassport(droppedFile);
    }
  };

  // Function to parse bulk student data
  const parseBulkStudentData = (data) => {
    const lines = data.trim().split('\n').map(line => line.trim()).filter(line => line !== '');
    
    if (lines.length < 1) {
      throw new Error('No data provided');
    }
    
    const className = lines[0]; // First line is the class name
    const studentEntries = [];
    
    // Process student entries (2 lines per student: name, token)
    for (let i = 1; i < lines.length; i += 2) {
      if (i + 1 >= lines.length) break; // Ensure we have enough lines
      
      const nameLine = lines[i];
      const tokenLine = lines[i + 1];
      
      // Extract gender from name line if in parentheses
      let name = nameLine;
      let sex = "Female"; // Default to Female
      
      // Check if there's gender info in parentheses (case-insensitive)
      const genderMatch = nameLine.match(/^(.*?)\s*\((.*?)\)\s*$/);
      if (genderMatch) {
        name = genderMatch[1].trim();
        // Case-insensitive gender detection
        sex = genderMatch[2].trim().toLowerCase() === "male" ? "Male" : "Female";
      }
      
      studentEntries.push({
        name: name,
        class: className,
        sex: sex,
        token: tokenLine,
        parentcontact: "" // No parent phone number as per requirements
      });
    }
    
    return studentEntries;
  };

  // Function to handle bulk student upload
  const handleBulkStudentUpload = async () => {
    if (bulkImages.length === 0) {
      toast.error("Please select images for the students");
      return;
    }
    
    if (!bulkStudentData.trim()) {
      toast.error("Please enter student data");
      return;
    }
    
    setBulkUploading(true);
    
    try {
      // Parse student data
      const studentEntries = parseBulkStudentData(bulkStudentData);
      
      // Validate that we have the same number of images and students
      if (bulkImages.length !== studentEntries.length) {
        toast.error(`Number of images (${bulkImages.length}) doesn't match number of students (${studentEntries.length})`);
        setBulkUploading(false);
        return;
      }
      
      // Process each student
      for (let i = 0; i < studentEntries.length; i++) {
        const student = studentEntries[i];
        const image = bulkImages[i];
        
        // Upload image and get filename
        let passportURL = null;
        if (image) {
          const fileExt = image.name.split(".").pop();
          const fileName = `${Date.now()}_${i}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from("passport")
            .upload(fileName, image);
            
          if (uploadError) {
            toast.error(`Error uploading image for ${student.name}: ${uploadError.message}`);
            continue;
          }
          
          // Get the public URL
          const { data: { publicUrl } } = supabase.storage
            .from("passport")
            .getPublicUrl(fileName);
          passportURL = publicUrl;
        }
        
        // Add student to database
        const studentData = {
          ...student,
          passport: passportURL,
          user_id: user?.identities?.[0]?.identity_data?.full_name || user?.email || '',
        };
        
        const { error: insertError } = await supabase.from("jmis_student").insert([studentData]);
        
        if (insertError) {
          toast.error(`Error adding student ${student.name}: ${insertError.message}`);
        } else {
          toast.success(`Successfully added student: ${student.name}`);
          
          // Send email notification for bulk student addition
          const currentUserEmail = getCurrentUserEmail();
          const emailSubject = 'New Student Added (Bulk Upload)';
          const emailMessage = `A new student record has been added via bulk upload by ${currentUserEmail}:

Student Name: ${student.name}
Class: ${student.class}
Gender: ${student.sex}
Token: ${student.token}`;
          await sendEmailNotification(supabase, emailSubject, emailMessage);
        }
      }
      
      // Reset form after successful upload
      setBulkImages([]);
      setBulkStudentData("");
      toast.success("Bulk student upload completed!");
    } catch (error) {
      toast.error("Error in bulk upload: " + error.message);
    }
    
    setBulkUploading(false);
  };

  const formItems = [
    {
      type: "studentsdropdown",
      label: "NAME",
      placeholder: "Insert Student Name",
      value: name,
      setValue: setName,
    },
    {
      type: "dropdown",
      label: "CLASS",
      value: className,
      setValue: setClassName,
      placeholder: "Select Student Class",
      option: classOptions,
    },
    {
      type: "sexDropdown",
      label: "GENDER",
      value: sex,
      setValue: setSex,
      placeholder: "Select Student Gender",
      option: sexOptions,
    },
    {
      type: "parentDropdown",
      label: "Phone Number",
      value: parentContact,
      setValue: setParentContact,
      placeholder: "Insert Parent/Guardian Phone Number",
    },
  ];

  const [userAuth, setUserAuth] = useState([]);
  const [devAuth, setDevAuth] = useState([]);

  // Developer check: DEV_EMAILS list or devauth table (same logic as FullStudent)
  const isDevUser = DEV_EMAILS.includes((user?.user_metadata?.email || "").toLowerCase()) ||
    (devAuth || []).some((auth) => (auth.email || "").toLowerCase() === (user?.user_metadata?.email || "").toLowerCase());

  // Add the exportToExcel function here
  const exportToExcel = () => {
    // Since this is the NewStudent form, we don't have student data to export
    // We could export a template or sample data instead
    const sampleData = [
      { Name: "John Doe", Class: "Year 1", Gender: "Male", "Parent Contact": "+1234567890" }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Student_Template");
    XLSX.writeFile(wb, "student_template.xlsx");
  };

  const deniedPanel = (
    <div className="ap-denied">
      <RiErrorWarningLine />
      <h2>User not authorised</h2>
      <p>Please login with proper credentials or check your internet connection.</p>
      <button
        onClick={() => {
          if (isRouterAvailable) {
            router.push('/login');
          } else {
            // Fallback to window.location for cases where router is not available
            window.location.href = '/login';
          }
        }}
        className="ap-btn primary"
      >
        Go to Login
      </button>
    </div>
  );

  return (
    <>
      <ToastContainer />
      {/* Show loading indicator while verifying credentials */}
      {loading ? (
        <div className="ap-loading">
          <div className="ap-spinner" />
          <div>Verifying credentials...</div>
        </div>
      ) : user && Object.keys(user).length !== 0 ? (
        <div className="ap-page">
          <div className="ap-head">
            <div>
              <h1 className="ap-title">
                <span className="ap-title-ic"><RiUserAddLine /></span>
                Add New Student
              </h1>
              <p className="ap-sub">Enrol a student with their details and passport photo.</p>
            </div>
          </div>
          {userAuth && userAuth.some && userAuth.some((auth) => auth.email === user?.user_metadata?.email) ? (
            <>
              <form>
                <div className="ap-card">
                  <div className="ap-card-head">
                    <span className="ic"><RiUserLine /></span>
                    Student Details
                  </div>
                  <div className="ap-card-body">
                    <div className="ap-form-grid">
                      <div>
                        {formItems.map((item, index) => (
                          <label className="ap-field" key={index}>
                            <span className="ap-label">{item.label}</span>
                            {item.type === "dropdown" || item.type === "sexDropdown" ? (
                              <select
                                className="ap-input"
                                id={`formControl${index}`}
                                value={item.value}
                                onChange={(e) => item.setValue(e.target.value)}
                              >
                                <option value="">{item.placeholder}</option>
                                {item.option.map((option, i) => (
                                  <option key={i} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : item.type === "studentsdropdown" ? (
                              <input
                                type="text"
                                className="ap-input"
                                id={`formControl${index}`}
                                placeholder={item.placeholder}
                                value={item.value}
                                onChange={(e) => item.setValue(e.target.value)}
                              />
                            ) : (
                              <input
                                type="tel"
                                className="ap-input"
                                id={`formControl${index}`}
                                placeholder={item.placeholder}
                                value={item.value}
                                onChange={(e) => item.setValue(e.target.value)}
                              />
                            )}
                          </label>
                        ))}
                        {/* Show student token field only for developers (admins cannot set tokens) */}
                        {isDevUser && (
                          <label className="ap-field">
                            <span className="ap-label"><RiIdCardLine /> STUDENT TOKEN</span>
                            <input
                              type="text"
                              className="ap-input"
                              id="studentToken"
                              placeholder="Insert Student Token"
                              value={studentToken}
                              onChange={(e) => setStudentToken(e.target.value)}
                            />
                          </label>
                        )}
                      </div>
                      <div>
                        <span className="ap-label" style={{ marginBottom: 6 }}><RiUploadCloud2Line /> UPLOAD PASSPORT</span>
                        <div
                          className={`drop-zone ${dragActive ? "drag-active" : ""}`}
                          onDragEnter={handleDragEnter}
                          onDragLeave={handleDragLeave}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onClick={() => document.getElementById("fileInput").click()}
                          style={{
                            border: "2px dashed var(--card-border, #ccc)",
                            borderRadius: "12px",
                            padding: "28px 20px",
                            textAlign: "center",
                            cursor: "pointer",
                            color: "var(--text-secondary, #6b7280)",
                            backgroundColor: dragActive ? "rgba(2, 42, 161, 0.08)" : "rgba(107, 114, 128, 0.05)",
                          }}
                        >
                          <p style={{ margin: 0 }}>Drag &amp; drop your image here or click to select</p>
                          {passport && <p style={{ margin: '8px 0 0', fontWeight: 700, color: 'var(--text-primary, #1f2937)' }}>Selected: {passport.name}</p>}
                          <input
                            id="fileInput"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setPassport(e.target.files[0]);
                              }
                            }}
                            style={{ display: "none" }}
                          />
                        </div>
                        <button
                          type="button"
                          className="ap-btn primary"
                          style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
                          onClick={handleStudentInput}
                          disabled={loading}
                        >
                          {loading ? "Adding Student..." : "ADD STUDENT"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </form>

              {/* Show Bulk Upload Section only for devauth users */}
              {devAuth && devAuth.some && devAuth.some((auth) => auth.email === user?.user_metadata?.email) && (
                <div className="ap-card">
                  <div className="ap-card-head">
                    <span className="ic blue"><RiTableLine /></span>
                    Bulk Student Upload
                    <span className="ap-card-sub">Developer access only</span>
                  </div>
                  <div className="ap-card-body">
                    <div className="ap-form-grid">
                      <div className="ap-field">
                        <span className="ap-label">Select Student Images</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            if (e.target.files) {
                              setBulkImages(Array.from(e.target.files));
                            }
                          }}
                          className="ap-input"
                        />
                        {bulkImages.length > 0 && (
                          <small className="ap-hint">
                            Selected {bulkImages.length} image(s)
                          </small>
                        )}
                      </div>
                      <div className="ap-field">
                        <span className="ap-label">Student Data</span>
                        <textarea
                          className="ap-input"
                          rows="5"
                          placeholder="Enter student data in the format:
Class Name
Student Name 1
Token 1
Student Name 2
Token 2
..."
                          value={bulkStudentData}
                          onChange={(e) => setBulkStudentData(e.target.value)}
                        ></textarea>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ap-btn green"
                      onClick={handleBulkStudentUpload}
                      disabled={bulkUploading || bulkImages.length === 0 || !bulkStudentData.trim()}
                    >
                      {bulkUploading ? "Uploading Students..." : "BULK UPLOAD STUDENTS"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            deniedPanel
          )}
        </div>
      ) : (
        deniedPanel
      )}
    </>
  );
}