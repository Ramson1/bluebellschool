// Import necessary modules and components
import "../styles/fullpayment.css";
import {
  RiHistoryLine,
  RiSearchLine,
  RiTimeLine,
  RiFileExcelLine,
  RiErrorWarningLine,
  RiInboxLine,
  RiWalletLine,
} from 'react-icons/ri';
import '../styles/AdminPages.css';
import * as XLSX from "xlsx";
import React, { useEffect, useState } from "react";
import ReactDOMServer from "react-dom/server";
import backgroundImage from "../assets/bgtest.png";
import { useRouter } from "next/router";
import { NavbarComponent } from "../components/Navbar.jsx";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { sendEmailNotification } from '../api/emailNotificationService';

export default function FullPayment() {
  const [user, setUser] = useState();
  const [teacherAuth, setTeacherAuth] = useState([]);
  const [loading, setLoading] = useState(true); // Add loading state
  // Safely initialize router
    let router;
    let isRouterAvailable = false;
    
    try {
      router = useRouter();
      isRouterAvailable = router && router.push;
    } catch (error) {
      console.warn('NextRouter not available in this context');
    }
  const [pay, setPay] = useState([]);
  const [editedPayment, setEditedPayment] = useState(null); // Edited payment state
  const [searchTerm, setSearchTerm] = useState(""); // State for search filter
  const [termFilter, setTermFilter] = useState(""); // State for term filter
  const [totalAmountPaid, setTotalAmountPaid] = useState(0); // State for total amount paid

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
        const [teacherData] = await Promise.all([
          supabase.from('jmis_teacherauth').select('email')
        ]);
        
        // Handle teacher auth data
        if (teacherData.error) throw teacherData.error;
        setTeacherAuth(teacherData.data || []);
        
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
      } finally {
        // Only set loading to false after all verification is complete
        setLoading(false);
      }
    };
    
    initializeData();
  }, [router]);

  useEffect(() => {
    // Fetch all payment records
    async function fetchPayments() {
      try {
        const { data, error } = await supabase.from("jmis_paymentsinfo").select("*");
        if (error) throw error;
        if (data != null) {
          setPay(data);
          // Calculate total amount paid
          const total = data.reduce((sum, payment) => sum + parseFloat(payment.amountpaid || 0), 0);
          setTotalAmountPaid(total);
        }
      } catch (error) {
        console.error("Error fetching payments:", error);
        toast.error(error.message);
      }
    }
    fetchPayments();
  }, []);

  // Get current user's email for audit trail
  const getCurrentUserEmail = () => {
    return user?.user_metadata?.email || 'Unknown User';
  };

  const handleDelete = async (id) => {
    try {
      // First, get the payment details before deleting
      const { data: paymentData, error: fetchError } = await supabase
        .from("jmis_paymentsinfo")
        .select('*')
        .eq("id", id)
        .single();
      
      if (fetchError) {
        toast.error("Error fetching payment details: " + fetchError.message);
        return;
      }
      
      const { error } = await supabase.from("jmis_paymentsinfo").delete().eq("id", id);
      if (error) {
        toast.error("Error deleting payment: " + error.message);
        return;
      }
      setPay(pay.filter(payment => payment.id !== id));
      toast.success("Payment deleted successfully!");
      
      // Send email notification for deleted payment
      const currentUserEmail = getCurrentUserEmail();
      const emailSubject = 'Payment Record Deleted';
      const emailMessage = `A payment record has been deleted by ${currentUserEmail}:

Student Name: ${paymentData.name}
Class: ${paymentData.class}
Payment Type: ${paymentData.description}
Amount: ${paymentData.amountpaid}
Term: ${paymentData.currentterm}
Date: ${paymentData.date}`;
      await sendEmailNotification(supabase, emailSubject, emailMessage);
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast.error("Error deleting payment: " + error.message);
    }
  };

  function handleEdit(payment) {
    // Set edited payment details
    setEditedPayment({ ...payment });
  }

  async function handleSave(paymentId) {
    // Save updated payment details
    const { data, error } = await supabase.from("jmis_paymentsinfo").update(editedPayment).eq("id", paymentId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Payment updated successfully!");
      setEditedPayment(null);
      window.location.reload();
    }
  };

  const [userauth, setUserAuth] = useState([]);

  useEffect(() => {
    // Fetch user authorization data
    const fetchUserAuth = async () => {
      try {
        const { data, error } = await supabase.from("jmis_userauth").select("email");
        if (error) throw error;
        setUserAuth(data);
      } catch (error) {
        toast.error("Failed to fetch data. Please check your internet connection.");
      }
    };
    fetchUserAuth();
  }, []);


  const handleExportToExcel = () => {
    // Export payment data to Excel file
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(pay);
    XLSX.utils.book_append_sheet(wb, ws, "Payments");
    const fileName = `Payments_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  function handlePrintReceipt(payment) {
    // Print receipt for a payment
    const Receipt = () => (
      <div className="container mt-4" style={{ backgroundColor: "var(--container-bg, #f8f9fa)", padding: "20px", borderRadius: "5px" }}>
        <div className="receipt border p-4" style={{ backgroundImage: `url(${backgroundImage})`, backgroundSize: "cover", color: "#333" }}>
          <h2 className="text-center bold" style={{ marginTop: "130px", color: 'green' }}>
            Receipt
          </h2>
          <hr />
          <div className="row">
            <div className="col-6">
              <h5>
                Name: <strong>{payment.name}</strong>{" "}
              </h5>
              <h5>
                Class: <strong>{payment.class}</strong>{" "}
              </h5>
              <h5>
                Term: <strong>{payment.currentterm}</strong>{" "}
              </h5>
            </div>
            <div className="col-6 text-end">
              <h5>
                Invoice No: <strong>{payment.invoiceno}</strong>{" "}
              </h5>
              <h5>
                Date: <strong>{payment.date}</strong>{" "}
              </h5>
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <h5>
                Amount Paid:<strong> ₦ {payment.amountpaid}</strong>
              </h5>
              <h5>
                Description: <strong>{payment.description}</strong>{" "}
              </h5>
              <h5>
                Payment Description: <strong>{payment.paymentdescription}</strong>{" "}
              </h5>
            </div>
          </div>
          <hr />
          <div className="text-center" style={{marginTop: '20px',
        textAlign: 'center',
        backgroundColor: 'rgb(3, 148, 25)',
        padding: '10px',
        fontSize: '20px',
        color: 'white',
        fontWeight: 'bold'}}>
            <h6>Thank you for doing business!</h6>
          </div>
        </div>
      </div>
    );

    const printWindow = window.open("", "_blank");
    printWindow.document.write("<html><head><title>Receipt</title>");
    printWindow.document.write('<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">');
    printWindow.document.write(
      '<style>@media print { .receipt { background-image: url(`url(${backgroundImage})`); background-size: cover; } }</style>'
    );
    printWindow.document.write("</head><body>");
    printWindow.document.write(ReactDOMServer.renderToString(<Receipt />));
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  }

  // Filter payments based on search term and term filter
  const filteredPayments = pay.filter((payment) => {
    const matchesSearch = payment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.class.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTerm = termFilter ? payment.currentterm.includes(termFilter) : true;

    return matchesSearch && matchesTerm;
  });

  return (
    <>
      <ToastContainer />
      {/* Show loading indicator while verifying credentials */}
      {loading ? (
        <div className="ap-loading">
          <div className="ap-spinner" />
          <div>Verifying credentials...</div>
        </div>
      ) : (userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email)) ? (
        <div className="ap-page">
          <div className="ap-head">
            <div>
              <h1 className="ap-title">
                <span className="ap-title-ic"><RiHistoryLine /></span>
                Full Payment Record
              </h1>
              <p className="ap-sub">Every payment ever recorded — search, edit, print or export.</p>
            </div>
            <div className="ap-pills">
              <span className="ap-pill"><RiInboxLine /> {filteredPayments.length} record(s)</span>
              <span className="ap-pill blue">
                <RiWalletLine /> ₦ {totalAmountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="ap-toolbar">
            <div className="ap-search">
              <RiSearchLine />
              <input
                type="text"
                placeholder="Search by name, class, or description"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ap-input"
              />
            </div>
            <div className="ap-search">
              <RiTimeLine />
              <input
                type="text"
                placeholder="Filter by term"
                value={termFilter}
                onChange={(e) => setTermFilter(e.target.value)}
                className="ap-input"
              />
            </div>
            {userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email) ? (
              <button onClick={handleExportToExcel} className="ap-btn green">
                <RiFileExcelLine /> Export to Excel
              </button>
            ) : (
              <button className="ap-btn ghost" disabled>Only For Admins</button>
            )}
          </div>

          <div className="ap-card">
            <div className="ap-card-head">
              <span className="ic"><RiHistoryLine /></span>
              Payment Records
              <span className="ap-card-sub">{filteredPayments.length} shown of {pay.length} total</span>
            </div>
            {filteredPayments.length === 0 ? (
              <div className="ap-empty">
                <RiInboxLine />
                No payments match the current filters.
              </div>
            ) : (
              <div className="ap-tablewrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>Serial No</th>
                      <th>Name</th>
                      <th>Class</th>
                      <th>Description</th>
                      <th>Term</th>
                      <th>Amount Paid</th>
                      <th>Date</th>
                      <th>Invoice No</th>
                      <th>Payment Description</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment, index) => (
                      <tr key={payment.id}>
                        {editedPayment && editedPayment.id === payment.id ? (
                          <>
                            <td className="ap-num">{index + 1}</td>
                            <td>
                              <input
                                type="text"
                                value={editedPayment.name}
                                onChange={(e) => setEditedPayment({ ...editedPayment, name: e.target.value })}
                                className="form-control"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editedPayment.class}
                                onChange={(e) => setEditedPayment({ ...editedPayment, class: e.target.value })}
                                className="form-control"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editedPayment.description}
                                onChange={(e) => setEditedPayment({ ...editedPayment, description: e.target.value })}
                                className="form-control"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editedPayment.currentterm}
                                onChange={(e) => setEditedPayment({ ...editedPayment, currentterm: e.target.value })}
                                className="form-control"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editedPayment.amountpaid}
                                onChange={(e) => setEditedPayment({ ...editedPayment, amountpaid: e.target.value })}
                                className="form-control"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editedPayment.date}
                                onChange={(e) => setEditedPayment({ ...editedPayment, date: e.target.value })}
                                className="form-control"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editedPayment.invoiceno}
                                onChange={(e) => setEditedPayment({ ...editedPayment, invoiceno: e.target.value })}
                                className="form-control"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editedPayment.paymentdescription}
                                onChange={(e) => setEditedPayment({ ...editedPayment, paymentdescription: e.target.value })}
                                className="form-control"
                              />
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <button onClick={() => handleSave(payment.id)} className="ap-btn primary sm">
                                Save
                              </button>{' '}
                              <button onClick={() => setEditedPayment(null)} className="ap-btn ghost sm">
                                Cancel
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="ap-num">{index + 1}</td>
                            <td>{payment.name}</td>
                            <td><span className="ap-badge info">{payment.class}</span></td>
                            <td>{payment.description}</td>
                            <td>{payment.currentterm}</td>
                            <td className="ap-money">₦ {Number(payment.amountpaid || 0).toLocaleString()}</td>
                            <td>{payment.date}</td>
                            <td className="ap-num">{payment.invoiceno}</td>
                            <td>{payment.paymentdescription}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email) ? (
                                <>
                                  <button onClick={() => handleEdit(payment)} className="ap-btn blue sm">
                                    Edit
                                  </button>{' '}
                                  <button onClick={() => handleDelete(payment.id)} className="ap-btn red sm">
                                    Delete
                                  </button>{' '}
                                  <button onClick={() => handlePrintReceipt(payment)} className="ap-btn soft sm">
                                    Print Receipt
                                  </button>
                                </>
                              ) : (
                                <button className="ap-btn ghost sm" disabled>Only For Admins</button>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderTop: '1px solid var(--card-border, #e5e7eb)',
                background: 'linear-gradient(120deg, rgba(1, 27, 151, 0.06), rgba(2, 42, 161, 0.06))',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Total Amount Paid:</span>
              <span className="ap-money" style={{ color: '#1f4fd8', fontSize: '1.05rem' }}>₦ {totalAmountPaid.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : (
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
      )}
    </>
  );
}