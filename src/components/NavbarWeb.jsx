// Import necessary libraries and components
import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/NavbarWeb.css"; // Importing custom CSS for styling
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import Offcanvas from "react-bootstrap/Offcanvas";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import { supabase } from "../supabaseClient.js";
import { useRouter } from "next/router"; // Importing useRouter for navigation
// import logo from './logo.jpg'
import { ToastContainer, toast } from 'react-toastify';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import 'react-toastify/dist/ReactToastify.css';

export const NavbarWeb = () => {
  const [showModal, setShowModal] = useState(false); // State for showing/hiding the modal
  const [pin, setPin] = useState(""); // State for storing PIN input
  const [showPin, setShowPin] = useState(false); // State for showing/hiding PIN
  const [studentName, setStudentName] = useState(""); // State for storing student name input
  const [selectedTerm, setSelectedTerm] = useState(""); // State for storing student name input
  const [resultType, setResultType] = useState(""); // State for selecting result type (midterm or general)
  // Safely initialize router
  let router;
  let isRouterAvailable = false;
  
  try {
    router = useRouter();
    isRouterAvailable = router && router.push;
  } catch (error) {
    console.warn('NextRouter not available in this context');
  }
  const [settings, setSettings] = useState([]);
  const [lock, setLock] = useState(false);
  const [students, setStudents] = useState([]); // State for storing all students

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const { data, error } = await supabase
          .from('jmis_student')
          .select('name')
          .order('name', { ascending: true });

        if (error) throw error;
        setStudents(data || []);
      } catch (err) {
        console.error('Error fetching students:', err.message);
      }
    };

    const fetchLockStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('jmis_settings')
          .select('resultLock');
          
        if (error) {
          throw error;
        }
        
        // Use the first row if data exists, otherwise default to false
        setLock(data && data.length > 0 ? data[0]?.resultLock || false : false);
      } catch (err) {
        console.error('Error fetching lock status:', err.message);
      }
    };

    fetchStudents();
    fetchLockStatus();
  }, []);

  // Handles scrolling to a specific section of the page
  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" }); // Smooth scroll to the section
    }
  };

  useEffect(() => {
    const fetchSettingsTable = async () => {
      try {
        // Query the 'settings' table
        const { data, error } = await supabase.from('jmis_settings').select('*');

        // Handle errors if any occur
        if (error) {
          throw error;
        }

        // Update state with the fetched data
        setSettings(data);

      } catch (err) {
        console.error('Error fetching settings table');
      }
    };
    fetchSettingsTable()
  }, [])

  const checkDate = () => {
    const currentDate = new Date().toISOString().slice(0, 10);
    const specificDate = settings[0]?.checkResult; // Replace with your specific date
    // console.log(currentDate);


    if (currentDate >= specificDate) {
      setShowModal(true);
    } else {
      toast.warn(`Checking of Student's result starts on ${specificDate}`);
    }
  };

  // Handles the form submission for entering PIN and studentName
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (!resultType) {
      toast.error("Select a result type (general or midterm).");
      return;
    }
    if (!selectedTerm) {
      toast.error("Select a term result you wish to see.");
      return;
    }
    
    // Show loading state
    toast.info("Verifying credentials...");

    try {
      // Check if the studentName and PIN matches in the result table
      let { data: resultData, error: resultError } = await supabase
        .from("jmis_result")
        .select("*")
        .eq("studentName", studentName)
        .eq("token", pin)
        .single(); // Expect a single match for the studentName and token
      
      if (resultError) {
        if (resultError.code === "PGRST116") {
          // F5: no live match – fall back to archived results from past sessions
          const { data: archivedData, error: archivedError } = await supabase
            .from("jmis_result_history")
            .select("*")
            .eq("studentName", studentName)
            .eq("token", pin)
            .order("archived_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (archivedError && archivedError.code !== "PGRST116") throw archivedError;
          if (archivedData) {
            resultData = archivedData;
            toast.info("Viewing an archived result from a previous session");
          } else {
            // No match for studentName and token (live or archived)
            toast.error("Invalid Credentials: Student Result does not exist. Please ensure the student name and token are correct.");
            return; // Exit if there's no result data at all
          }
        } else {
          throw resultError;
        }
      }
      
      // If result data exists, fetch the passport data from jmis_student table
      // First try with name and token (exact match)
      let { data: studentData, error: studentError } = await supabase
        .from("jmis_student")
        .select("*")
        .eq("name", studentName)
        .eq("token", pin)
        .single();
      
      // If no exact match, try case-insensitive search (in case of capitalization differences)
      if (studentError || !studentData) {
        console.log('No exact match found, trying case-insensitive search');
        const result = await supabase
          .from("jmis_student")
          .select("*")
          .ilike("name", studentName.trim())
          .eq("token", pin)
          .single();
        
        studentData = result.data;
        studentError = result.error;
      }
      
      // If still no data, try just with token (in case name has formatting differences)
      if (studentError || !studentData) {
        console.log('No name/token match found, trying token only');
        const result = await supabase
          .from("jmis_student")
          .select("*")
          .eq("token", pin)
          .single();
        
        studentData = result.data;
        studentError = result.error;
      }
      
      // Log the final result
      if (studentError) {
        console.log('Final attempt also failed, no passport data found for:', { studentName, pin });
      } else {
        console.log('Successfully found passport data:', studentData);
      }
      
      console.log('Fetched student data (passport data):', studentData);
      console.log('Student error:', studentError);
      
      if (studentError) {
        console.error("Error fetching student data:", studentError);
        // Continue with result display even if passport isn't available
        toast.warn("Student passport image not available, but showing result.");
      }
      
      setShowModal(false); // Close the modal
      // Log the data being passed
      console.log('Data being passed to ResultCardComponent:', {
        resultData,
        studentData,
        selectedTerm,
        resultType
      });

      // Store data in localStorage to avoid URL length issues (HTTP 431)
      try {
        localStorage.setItem('studentResultData', JSON.stringify(resultData));
        localStorage.setItem('studentPassportData', JSON.stringify(studentData || {}));
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
      
      // If a match is found, navigate to the appropriate result page based on resultType
      let resultPage;
      if (resultType === 'midterm') {
        // resultPage = '/midterm_resultcard';
        resultPage = '/resultCardComponent'; // Using the unified component for both
      } else {
        resultPage = '/resultCardComponent';
      }
      
      if (isRouterAvailable) {
        router.push(`${resultPage}?selectedTerm=${encodeURIComponent(selectedTerm)}&resultType=${encodeURIComponent(resultType)}`);
      } else {
        // Fallback to window.location for cases where router is not available
        const queryParams = new URLSearchParams({
          selectedTerm,
          resultType
        }).toString();
        window.location.href = `${resultPage}?${queryParams}`;
      } // Passing the matched data as encoded query parameters or fallback to window.location
    } catch (error) {
      console.error("Error verifying student credentials:", error.message);
      toast.error("An error occurred while verifying the credentials. Please try again.");
    }
  };

  return (
    <>
      {/* Responsive navbar for different screen sizes */}
      {["md"].map((expand) => (
        <Navbar
          key={expand}
          expand={expand}
          className="navbar-custom shadow-lg mb-3"
          fixed="top"
        >
          <>
            <Navbar.Brand href="#" className="navbar-brand-custom">
              <img
                src="/logo.jpg"
                alt="School Logo"
                className="img-fluid"
                style={{ width: '50px', height: '50px', borderRadius: '100px' }}
              />
            </Navbar.Brand>
            <Navbar.Toggle aria-controls={`offcanvasNavbar-expand-${expand}`} />
            <Navbar.Offcanvas
              id={`offcanvasNavbar-expand-${expand}`}
              aria-labelledby={`offcanvasNavbarLabel-expand-${expand}`}
              placement="end"
            >
              <Offcanvas.Header closeButton>
                <Offcanvas.Title id={`offcanvasNavbarLabel-expand-${expand}`}>
                  Menu
                </Offcanvas.Title>
              </Offcanvas.Header>

              <Offcanvas.Body>
                <Nav style={{ margin: 'auto' }}>
                  {/* Customized navigation links with scroll functionality */}
                  <Nav.Link
                    onClick={() => scrollToSection("hero")}
                    className="nav-link-custom"
                  >
                    Home
                  </Nav.Link>
                  <Nav.Link
                    onClick={() => scrollToSection("about")}
                    className="nav-link-custom"
                  >
                    About
                  </Nav.Link>
                  <Nav.Link
                    onClick={() => scrollToSection("facilities")}
                    className="nav-link-custom"
                  >
                    Facilities
                  </Nav.Link>
                  <Nav.Link
                    onClick={() => scrollToSection("testimonials")}
                    className="nav-link-custom"
                  >
                    Testimonials
                  </Nav.Link>
                  <Nav.Link
                    onClick={() => scrollToSection("contact")}
                    className="nav-link-custom"
                  >
                    Contact
                  </Nav.Link>
                  <ToastContainer />
                </Nav>
                <Nav style={{ gap: '20px' }}>
                  <Nav.Link
                    href="/apppayments"
                    className="navbar-button hover-effect bg-success pt-2 px-3 text-center"
                  >
                    Payments
                  </Nav.Link>
                  <Nav.Link
                    href="/home"
                    className="navbar-button hover-effect bg-danger pt-2 px-3 text-center"
                  >
                    Admin
                  </Nav.Link>
                  <Nav.Link
                    href="/quiz"
                    className="navbar-button hover-effect pt-2 px-3 text-center"
                    style={{backgroundColor: 'rgba(229, 159, 7, 0.96)'}}
                  >
                    CBT Exam
                  </Nav.Link>
                  <Button
                    className="navbar-button hover-effect"
                    onClick={() => checkDate()} // Open the modal
                  >
                    Result
                  </Button>
                
                </Nav>
              </Offcanvas.Body>
            </Navbar.Offcanvas>
          </>
        </Navbar>
      ))}

      {/* Modal for studentName and PIN input */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)} // Close modal on hide
        centered
      >
        {lock ? <div>
          <Modal.Header closeButton>
            <Modal.Title>Contact RHEMA EXPERT SOLUTION to ratify your result</Modal.Title>
          </Modal.Header>
        </div> :
          <div>
            <Modal.Header closeButton>
              <Modal.Title>Enter Student Details</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form onSubmit={handlePinSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Student Name</Form.Label>
                  <Form.Control
                    type="text"
                    list="student-names"
                    placeholder="Enter or Select Student Name"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    required
                    autoComplete="off"
                  />
                  <datalist id="student-names">
                    {students.map((student, index) => (
                      <option key={index} value={student.name} />
                    ))}
                  </datalist>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Access PIN</Form.Label>
                  <div className="position-relative">
                    <Form.Control
                      type={showPin ? "text" : "password"}
                      placeholder="Enter PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)} // Update PIN state
                      required
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      className="btn position-absolute end-0 top-50 translate-middle-y border-0 bg-transparent"
                      onClick={() => setShowPin(!showPin)}
                      style={{ right: '10px', color: '#6c757d' }}
                    >
                      {showPin ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <Form.Text className="text-muted">
                    Please enter the details provided by the school administrator.
                  </Form.Text>
                </Form.Group>
                <div style={{ margin: "18px 0" }}>
  <label style={{ fontWeight: 700, color: "#4e73df" }}>Select Result Type</label>
  <div
    style={{
      marginTop: 8,
      width: "100%",
      borderRadius: 10,
      border: "1.5px solid #e3e9f7",
      background: "#fff",
      boxShadow: "0 2px 8px rgba(44,62,80,0.07)",
      padding: "10px 14px",
      fontSize: 16,
      color: "#222",
      cursor: "pointer",
    }}
  >
    <select
      value={resultType}
      onChange={e => setResultType(e.target.value)}
      style={{
        border: "none",
        outline: "none",
        background: "transparent",
        width: "100%",
        fontSize: 16,
        color: resultType ? "#222" : "#888",
      }}
      required
    >
      <option value="" disabled>
        -- Select Result Type --
      </option>
      <option value="general">General Term Result</option>
      <option value="midterm">Midterm Result</option>
    </select>
  </div>
</div>
{resultType && (
  <div style={{ margin: "18px 0" }}>
    <label style={{ fontWeight: 700, color: "#4e73df" }}>Select Term Result to View</label>
    <div
      style={{
        marginTop: 8,
        width: "100%",
        borderRadius: 10,
        border: "1.5px solid #e3e9f7",
        background: "#fff",
        boxShadow: "0 2px 8px rgba(44,62,80,0.07)",
        padding: "10px 14px",
        fontSize: 16,
        color: "#222",
        cursor: "pointer",
      }}
    >
      <select
        value={selectedTerm}
        onChange={e => setSelectedTerm(e.target.value)}
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          width: "100%",
          fontSize: 16,
          color: selectedTerm ? "#222" : "#888",
        }}
        required={!!resultType}
      >
        <option value="" disabled>
          -- Select Term --
        </option>
        <option value="1st term">1st Term</option>
        <option value="2nd term">2nd Term</option>
        <option value="3rd term">3rd Term</option>
      </select>
    </div>
  </div>
)}
                <Button variant="primary" type="submit" className="w-100" disabled={lock}>
                  Submit
                </Button>
              </Form>
            </Modal.Body>
          </div>
        }
      </Modal>
    </>
  );
};