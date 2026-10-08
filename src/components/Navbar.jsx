import "bootstrap/dist/css/bootstrap.min.css";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Nav from "react-bootstrap/Nav";
import NavDropdown from "react-bootstrap/NavDropdown";
import Navbar from "react-bootstrap/Navbar";
import Offcanvas from "react-bootstrap/Offcanvas";
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { FaSync } from "react-icons/fa";
import { useRouter } from "next/router";
import { supabase } from "../supabaseClient";
// Using logo from public directory
const logo = '/logo.jpg';

export const NavbarComponent = () => {
  const [userauth, setUserAuth] = useState([]);
  const [user, setUser] = useState();

  
  // Safely initialize router
  let router;
  let isRouterAvailable = false;
  
  try {
    router = useRouter();
    isRouterAvailable = router && router.push;
  } catch (error) {
    console.warn('NextRouter not available in this context');
  }

  const refreshPage = () => {
    window.location.reload(); // Function to refresh the page
  };

  const signOutUser = async () => {
    const { error } = await supabase.auth.signOut();
    if (isRouterAvailable) {
      router.push("/login");
    } else {
      // Fallback to window.location for cases where router is not available
      window.location.href = "/login";
    }
  };
  useEffect(() => {
    const getUserData = async () => {
                await supabase.auth.getUser().then((value) => {
                    if (value.data?.user) {
                        setUser(value.data.user);
                    }
                });
            };
   const fetchUserAuth = async () => {
              try {
                  const { data, error } = await supabase
                      .from('jmis_userauth') // Assuming 'userauth' is the table name
                      .select('*');
                  if (error) throw error;
                  setUserAuth(data); // Set userauth from Supabase
              } catch (error) {
                  alert("Failed to fetch data. Please check your internet connection."); // Added alert for fetch failure
              }
    };
    getUserData();
          fetchUserAuth();  
}, [])

  return (
    <>
      {['md'].map((expand) => (
        <Navbar key={expand} expand={expand} className="bg-body-tertiary mb-3 px-5" fixed="top">
          <Container fluid>
            <Navbar.Brand href="#">
              <img 
                src={logo}
                alt="School Logo" 
                className="img-fluid"
                style={{ width: '50px', height: '50px', padding: 0, cursor: 'pointer', borderRadius: '100px' }}
                onClick={refreshPage}
              />
              {/* <FaSync onClick={refreshPage} style={{ cursor: 'pointer', marginLeft: '8px' }} /> */}
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
                <Nav className="justify-content-end flex-grow-1 pe-3">
                  <Nav.Link href="/home">Home</Nav.Link>
                  {(userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email)) && (
                    <>
                  <Nav.Link href="/payments">New Payment</Nav.Link>
                  <Nav.Link href="/student">New Student</Nav.Link>
                  <Nav.Link href="/termly_fees">Termly Fees</Nav.Link>
                      <Nav.Link href="/receipt">Upload/View Receipts</Nav.Link>
                      </>
                    )}
                  <NavDropdown
                    title="Records"
                    id={`offcanvasNavbarDropdown-expand-${expand}`}
                  >
                    <NavDropdown.Item href="/class_payment">Classes School Fees Record</NavDropdown.Item>
                    <NavDropdown.Item href="/other_payment">
                      Other Payments Record
                    </NavDropdown.Item>
                    <NavDropdown.Divider />
                    {(userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email)) && (
                    <>
                    <NavDropdown.Item href="/full_payment">
                      Full Payment Record
                    </NavDropdown.Item>
                    <NavDropdown.Divider />
                    <NavDropdown.Item href="/full_student">
                      Full Student Record
                    </NavDropdown.Item>
                    </>
                    )}
                  </NavDropdown>
                  <Nav.Link href="/CBTQuestions">CBT Questions</Nav.Link>
                  <Nav.Link href="/result">Results</Nav.Link>
                  {(userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email)) && (
                    <>
                  <Nav.Link href="/setting">Settings</Nav.Link>
                      </>
                    )}
                  <Button onClick={signOutUser}>Sign Out</Button>
                </Nav>
              </Offcanvas.Body>
            </Navbar.Offcanvas>
          </Container>
        </Navbar>
      ))}
    </>
  )
}

function CustomLink({ to, children, ...props }) {
  const resolvedPath = useResolvedPath(to)
  const isActive = useMatch({ path: resolvedPath.pathname, end: true })
  return (
    <li className={isActive ? "nav-item active" : "nav-item"}>
      <Link to={to} {...props}>{children}</Link>
    </li>
  )
}