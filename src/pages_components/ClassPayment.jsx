import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { NavbarComponent } from "../components/Navbar.jsx";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  RiWalletLine,
  RiGraduationCapLine,
  RiPrinterLine,
  RiSearchLine,
  RiTimeLine,
  RiErrorWarningLine,
  RiInboxLine,
  RiCheckboxCircleLine,
} from 'react-icons/ri';
import '../styles/AdminPages.css';

export default function ClassPayment() {
  const [user, setUser] = useState();
  const [payments, setPayments] = useState([]); // State to hold payment data
  const [loading, setLoading] = useState(true); // State to track loading
  const [classFilter, setClassFilter] = useState(''); // State for class filter
  const [currentTerm, setCurrentTerm] = useState(''); // State for term filter
  const [classFees, setClassFees] = useState([]); // State to hold class fees data
  const [teacherAuth, setTeacherAuth] = useState([]); // Fixed: Initialize with useState
  const [userAuth, setUserAuth] = useState([]); // Add userAuth state
  
  // Safely initialize router
  let router;
  let isRouterAvailable = false;
  
  try {
    router = useRouter();
    isRouterAvailable = router && router.push;
  } catch (error) {
    console.warn('NextRouter not available in this context');
  }

  // Consolidate all data fetching into a single useEffect
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
        const [userData, teacherData, paymentsData, classFeesData] = await Promise.all([
          supabase.from('bluebell_userauth').select('email'),
          supabase.from('bluebell_teacherauth').select('email'),
          supabase.from('bluebell_paymentsinfo').select('*'),
          supabase.from('bluebell_classfees').select('*')
        ]);
        
        // Handle user auth data
        if (userData.error) throw userData.error;
        setUserAuth(userData.data || []);
        
        // Handle teacher auth data
        if (teacherData.error) throw teacherData.error;
        setTeacherAuth(teacherData.data || []);
        
        // Handle payments data
        if (paymentsData.error) throw paymentsData.error;
        // Filter payments to show only those with description "School Fees"
        const filteredPayments = paymentsData.data.filter(payment => payment.description === 'School Fees');
        setPayments(filteredPayments);
        
        // Handle class fees data
        if (classFeesData.error) throw classFeesData.error;
        setClassFees(classFeesData.data || []);
      } catch (error) {
        console.error('Error initializing data:', error);
        toast.error("Failed to fetch data. Please check your internet connection.");
      } finally {
        // Only set loading to false after all verification is complete
        setLoading(false);
      }
    };
    
    initializeData();
  }, []);

  // Check if the current user is authorized (either admin or teacher)
  const isAuthorized = (user && userAuth && userAuth.some && userAuth.some(auth => auth.email === user?.user_metadata?.email)) || 
                      (user && teacherAuth && teacherAuth.some && teacherAuth.some(auth => auth.email === user?.user_metadata?.email));

  // Filtered payment list based on class and current term
  const filteredPayments = payments.filter(payment =>
    payment.class.toLowerCase().includes(classFilter.toLowerCase()) &&
    payment.currentterm.includes(currentTerm.toLowerCase()) // Filter by current term
  );

  // Function to print the filtered payments
  const printFilteredPayments = () => {
    const printWindow = window.open('', '_blank'); // Open a new window
    printWindow.document.write('<html><head><title>Print</title>');
    printWindow.document.write('<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">'); // Include Bootstrap for styling
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h1>Class School Fees Payments</h1>');
    printWindow.document.write('<table class="table table-striped">');
    printWindow.document.write('<thead><tr><th>Serial No</th><th>Name</th><th>Class</th><th>Term</th><th>Amount Paid</th><th>Debt</th></tr></thead><tbody>');

    filteredPayments.forEach((payment, index) => {
      // Calculate debt based on classFees
      let classKey;
      const className = payment.class.toLowerCase().replace(/\s+/g, '');
      if (['creche', 'nursery', 'prenursery'].includes(className)) {
        classKey = className;
      } else {
        classKey = className.replace(/(\d+)[a-zA-Z]+$/, '$1').replace(/^[a-zA-Z]+$/, match => match);
      }
      
      const classFee = classFees && classFees.length > 0 ? classFees[0][classKey] : 0; // Access fee directly using class name
      const amountPaid = payment.amountpaid || 0; // Ensure amountPaid is defined
      const feeAmount = classFee !== undefined ? classFee : 0; // Get fee amount from classFees
      const debt = amountPaid - feeAmount;
      const debitDisplay = debt === 0 ? `<span style="color: green">Paid</span>` : debt > 0 ? `<span style="color: blue;">₦ +${debt}</span>` : `<span style="color: red;">₦ ${debt}</span>`;

      printWindow.document.write(`<tr>
        <td>${index + 1}</td>
        <td>${payment.name}</td>
        <td>${payment.class}</td>
        <td>${payment.currentterm}</td>
        <td>₦ ${amountPaid}</td>
        <td>${debitDisplay}</td>
      </tr>`);
    });

    printWindow.document.write('</tbody></table>');
    printWindow.document.write('</body></html>');
    printWindow.document.close(); // Close the document
    printWindow.print(); // Trigger the print dialog
  };

  // Debt for a payment row: positive = overpaid, negative = still owing
  const computeDebt = (payment) => {
    const className = (payment.class || '').toLowerCase().replace(/\s+/g, '');
    let classKey;
    if (['creche', 'nursery', 'prenursery'].includes(className)) {
      classKey = className;
    } else {
      classKey = className.replace(/(\d+)[a-zA-Z]+$/, '$1').replace(/^[a-zA-Z]+$/, (match) => match);
    }
    const classFee = classFees && classFees.length > 0 ? classFees[0][classKey] : 0;
    const amountPaid = payment.amountpaid || 0;
    const feeAmount = classFee !== undefined ? classFee : 0;
    return amountPaid - feeAmount;
  };

  const paidCount = filteredPayments.filter((p) => computeDebt(p) === 0).length;

  return (
    <>
      <ToastContainer />
      {loading ? (
        <div className="ap-loading">
          <div className="ap-spinner" role="status" />
          <div>Verifying credentials...</div>
        </div>
      ) : isAuthorized ? (
        <div className="ap-page">
          <div className="ap-head">
            <div>
              <h1 className="ap-title">
                <span className="ap-title-ic"><RiWalletLine /></span> Classes School Fees
              </h1>
              <p className="ap-sub">Payment records for school fees, class by class.</p>
            </div>
            <div className="ap-pills">
              <span className="ap-pill"><RiSearchLine /> {filteredPayments.length} record{filteredPayments.length === 1 ? "" : "s"}</span>
              <span className="ap-pill blue"><RiCheckboxCircleLine /> {paidCount} fully paid</span>
              {filteredPayments.length - paidCount > 0 && (
                <span className="ap-pill red">{filteredPayments.length - paidCount} outstanding</span>
              )}
            </div>
          </div>

          <div className="ap-toolbar">
            <div className="ap-search">
              <RiSearchLine />
              <input
                type="text"
                placeholder="Filter by class..."
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="ap-input"
                aria-label="Filter by class"
              />
            </div>
            <div className="ap-search">
              <RiTimeLine />
              <input
                type="text"
                placeholder="Filter by term..."
                value={currentTerm}
                onChange={(e) => setCurrentTerm(e.target.value)}
                className="ap-input"
                aria-label="Filter by term"
              />
            </div>
            <button onClick={printFilteredPayments} className="ap-btn green">
              <RiPrinterLine /> Print Filtered Payments
            </button>
          </div>

          <div className="ap-card">
            {filteredPayments.length === 0 ? (
              <div className="ap-empty">
                <RiInboxLine />
                <div>No school fees payments match the current filters.</div>
              </div>
            ) : (
              <div className="ap-tablewrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Class</th>
                      <th>Term</th>
                      <th>Amount Paid</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment, index) => {
                      const amountPaid = payment.amountpaid || 0;
                      const debt = computeDebt(payment);
                      const debitDisplay = debt === 0 ? 'Paid' : debt > 0 ? `₦ +${debt} overpaid` : `₦ ${Math.abs(debt)} owing`;

                      return (
                        <tr key={payment.id}>
                          <td className="ap-num">{index + 1}</td>
                          <td style={{ fontWeight: 600 }}>{payment.name}</td>
                          <td><span className="ap-badge info">{payment.class}</span></td>
                          <td>{payment.currentterm}</td>
                          <td className="ap-money">₦ {amountPaid.toLocaleString()}</td>
                          <td>
                            <span className={`ap-badge ${debt === 0 ? 'ok' : debt > 0 ? 'info' : 'danger'}`}>
                              {debt === 0 && <RiCheckboxCircleLine />}
                              {debitDisplay}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="ap-page">
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
              style={{ margin: '0 auto' }}
            >
              Go to Login
            </button>
          </div>
        </div>
      )}
    </>
  );
}