import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { NavbarComponent } from "../components/Navbar.jsx";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  RiHandCoinLine,
  RiPrinterLine,
  RiTimeLine,
  RiUserLine,
  RiGraduationCapLine,
  RiBookOpenLine,
  RiErrorWarningLine,
  RiInboxLine,
  RiWalletLine,
} from 'react-icons/ri';
import '../styles/AdminPages.css';

export default function OtherPayment() {
  const [user, setUser] = useState();
  const [payments, setPayments] = useState([]); // State to hold payment data
  const [loading, setLoading] = useState(true); // State to track loading
  const [classFilter, setClassFilter] = useState(''); // State for class filter
  const [classFees, setClassFees] = useState([]); // State to hold class fees data
  const [descriptionFilter, setDescriptionFilter] = useState(''); // State for description filter
  const [nameFilter, setNameFilter] = useState(''); // State for name filter
  const [termFilter, setTermFilter] = useState(''); // State for term filter
  const [teacherAuth, setTeacherAuth] = useState([]); // State for teacherAuth
  const [userAuth, setUserAuth] = useState([]); // State for userAuth
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
        const [teacherData, userData, paymentsData, classFeesData] = await Promise.all([
          supabase.from('jmis_teacherauth').select('email'),
          supabase.from('jmis_userauth').select('email'),
          supabase.from('jmis_paymentsinfo').select('*'),
          supabase.from('jmis_classfees').select('*')
        ]);
        
        // Handle teacher auth data
        if (teacherData.error) throw teacherData.error;
        setTeacherAuth(teacherData.data || []);
        
        // Handle user auth data
        if (userData.error) throw userData.error;
        setUserAuth(userData.data || []);
        
        // Handle payments data
        if (paymentsData.error) throw paymentsData.error;
        // Filter payments to show only those with description other than "School Fees"
        const filteredPayments = paymentsData.data.filter(payment => payment.description !== 'School Fees');
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

  const filteredPayments = payments.filter(payment =>
    payment.class.toLowerCase().includes(classFilter.toLowerCase()) &&
    payment.description.toLowerCase().includes(descriptionFilter.toLowerCase()) &&
    payment.name.toLowerCase().includes(nameFilter.toLowerCase())&&
    payment.currentterm.includes(termFilter.toLowerCase()) // Filter by term
  );

  const totalAmount = filteredPayments.reduce((total, payment) => {
    const amountPaid = Number(payment.amountpaid) || 0; // Convert to number
    return total + amountPaid; // Sum up the amount paid
  }, 0);

  const signOutUser = async () => {
    const { error } = await supabase.auth.signOut();
    if (isRouterAvailable) {
      router.push("/login");
    } else {
      // Fallback to window.location for cases where router is not available
      window.location.href = "/login";
    }
  };

 const printFilteredPayments = () => {
    const printWindow = window.open('', '_blank'); // Open a new window
    printWindow.document.write('<html><head><title>Print</title>');
    printWindow.document.write('<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">'); // Include Bootstrap for styling
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h1>Class School Fees Payments</h1>');
    printWindow.document.write('<table class="table table-striped">');
    printWindow.document.write('<thead><tr><th>Serial No</th><th>Name</th><th>Class</th><th>Term</th><th>Amount Paid</th><th>Debit</th></tr></thead><tbody>');

    filteredPayments.forEach((payment, index) => {
      const amountPaid = Number(payment.amountpaid) || 0; // Convert to number
      const descriptionKey = payment.description.toLowerCase().replace(/\s+/g, ''); // Remove spaces
      const feeAmount = classFees[0][descriptionKey] || 0; // Access fee dynamically using description
      const debit = amountPaid - feeAmount; // Calculate debit
      const debitDisplay = debit === 0 ? `<span style="color: green">Paid</span>` : debit > 0 ? `<span style="color: blue;">₦ +${debit}</span>` : `<span style="color: red;">₦ ${debit}</span>`; 

      printWindow.document.write(`<tr>
        <td>${index + 1}</td>
        <td>${payment.name}</td>
        <td>${payment.class}</td>
        <td>${payment.currentterm}</td>
        <td style={{color: 'green'}}>₦ ${amountPaid}</td>
        <td>${debitDisplay}</td> <!-- Display debit -->
      </tr>`);
    });

    printWindow.document.write('</tbody></table>');
    printWindow.document.write('</body></html>');
    printWindow.document.close(); // Close the document
    printWindow.print(); // Trigger the print dialog
  };

  return (
    <>
      <ToastContainer />
      {loading ? (
        <div className="ap-loading">
          <div className="ap-spinner" />
          <div>Verifying credentials...</div>
        </div>
      ) : isAuthorized ? (
        <div className="ap-page">
          <div className="ap-head">
            <div>
              <h1 className="ap-title">
                <span className="ap-title-ic amber"><RiHandCoinLine /></span>
                Other Payments Record
              </h1>
              <p className="ap-sub">All payments recorded outside of regular school fees.</p>
            </div>
            <div className="ap-pills">
              <span className="ap-pill"><RiInboxLine /> {filteredPayments.length} record(s)</span>
              <span className="ap-pill blue">
                <RiWalletLine /> ₦ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="ap-toolbar">
            <div className="ap-search">
              <RiUserLine />
              <input
                type="text"
                className="ap-input"
                placeholder="Filter by name"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)} // Update name filter
              />
            </div>
            <div className="ap-search">
              <RiGraduationCapLine />
              <input
                type="text"
                className="ap-input"
                placeholder="Filter by class"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)} // Update class filter
              />
            </div>
            <div className="ap-search">
              <RiBookOpenLine />
              <input
                type="text"
                className="ap-input"
                placeholder="Filter by description"
                value={descriptionFilter}
                onChange={(e) => setDescriptionFilter(e.target.value)} // Update description filter
              />
            </div>
            <div className="ap-search">
              <RiTimeLine />
              <input
                type="text"
                className="ap-input"
                placeholder="Filter by term"
                value={termFilter}
                onChange={(e) => setTermFilter(e.target.value)} // Update term filter
              />
            </div>
            <button onClick={printFilteredPayments} className="ap-btn green">
              <RiPrinterLine /> Print Filtered Payments
            </button>
          </div>

          <div className="ap-card">
            <div className="ap-card-head">
              <span className="ic amber"><RiHandCoinLine /></span>
              Payments Table
              <span className="ap-card-sub">{filteredPayments.length} matching record(s)</span>
            </div>
            {filteredPayments.length === 0 ? (
              <div className="ap-empty">
                <RiInboxLine />
                No other payments match the current filters.
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment, index) => (
                      <tr key={payment.id}>
                        <td className="ap-num">{index + 1}</td>
                        <td>{payment.name}</td>
                        <td><span className="ap-badge info">{payment.class}</span></td>
                        <td>{payment.description}</td>
                        <td>{payment.currentterm}</td>
                        <td className="ap-money">₦ {Number(payment.amountpaid || 0).toLocaleString()}</td>
                        <td>{payment.date}</td>
                        <td className="ap-num">{payment.invoiceno}</td>
                        <td>{payment.paymentdescription}</td>
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
              <span className="ap-money" style={{ color: '#1f4fd8', fontSize: '1.05rem' }}>₦ {totalAmount.toFixed(2)}</span>
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