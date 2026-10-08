import "bootstrap/dist/css/bootstrap.min.css";
import React, { useEffect, useState } from "react";
import backgroundImage from "../assets/bgtest.png";
import { useRouter } from "next/router";
import { v4 as uuid } from "uuid";
import { supabase } from "../supabaseClient.js";
import { CLASS_OPTIONS } from "../utils/classOptions";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { sendEmailNotification } from "../api/emailNotificationService";
import { logAction } from "../api/auditLog";
import "../styles/NewPayment.css";
import {
  RiMoneyDollarCircleLine,
  RiWalletLine,
  RiCheckboxCircleLine,
  RiSecurePaymentLine,
  RiReceiptLine,
  RiUploadCloud2Line,
  RiErrorWarningLine,
} from 'react-icons/ri';
import "../styles/AdminPages.css";

const NewPayment = () => {
    const [user, setUser] = useState();
    const [teacherAuth, setTeacherAuth] = useState([]);
    const [userAuth, setUserAuthState] = useState([]);
    const [loading, setLoading] = useState(true);
    // Safely initialize router
    let router;
    let isRouterAvailable = false;
    
    try {
      router = useRouter();
      isRouterAvailable = router && router.push;
    } catch (error) {
      console.warn('NextRouter not available in this context');
    }

    const formattedDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    const [selectedPayments, setSelectedPayments] = useState([]);
    const [paymentAmounts, setPaymentAmounts] = useState({});
    const [currentTerm, setCurrentTerm] = useState('');
    const [name, setName] = useState('');
    const [newclass, setNewClass] = useState('');
    const [newSex, setNewSex] = useState('');
    const [newInvoiceNO, setNewInvoiceNO] = useState('');
    const [newDate, setNewDate] = useState(formattedDate);
    const [newPaymentDescription, setNewPaymentDescription] = useState('');
    const [studentsOptions, setStudentsOptions] = useState([]);
    const [image, setImage] = useState(null);
    const [receiptImageUrl, setReceiptImageUrl] = useState(null);

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
                const [userData, teacherData] = await Promise.all([
                    supabase.from('jmis_userauth').select('email'),
                    supabase.from('jmis_teacherauth').select('email')
                ]);
                
                // Handle user auth data
                if (userData.error) throw userData.error;
                setUserAuthState(userData.data || []);
                
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
                
                // Fetch students data
                const { data: studentsData, error: studentsError } = await supabase
                    .from('jmis_student')
                    .select('name');
                if (studentsError) throw studentsError;
                const sortedStudents = studentsData.map(student => student.name).sort();
                setStudentsOptions(sortedStudents);
                
                InvoiceGenerator();
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

    // Check if the current user is a teacher
    const isTeacher = user && teacherAuth && teacherAuth.some && teacherAuth.some(auth => auth.email === user?.user_metadata?.email);
    
    // If user is a teacher, redirect to home - this useEffect is no longer needed since we handle it in initializeData
    
    const InvoiceGenerator = () => {
        const randomCode = Math.floor(100000 + Math.random() * 900000);
        setNewInvoiceNO(randomCode);
    };

    const handlePaymentCheckboxChange = (payment) => {
        setSelectedPayments((prevSelected) => {
            if (prevSelected.includes(payment)) {
                const updatedSelected = prevSelected.filter((item) => item !== payment);
                const updatedAmounts = { ...paymentAmounts };
                delete updatedAmounts[payment];
                setPaymentAmounts(updatedAmounts);
                return updatedSelected;
            } else {
                return [...prevSelected, payment];
            }
        });
    };

    const handleAmountChange = (payment, amount) => {
        setPaymentAmounts((prev) => ({
            ...prev,
            [payment]: amount,
        }));
    };

    // Get current user's email for audit trail
    const getCurrentUserEmail = () => {
        return user?.user_metadata?.email || 'Unknown User';
    };

    // Resolve the acting user's role for audit logging
    const getAuditRole = () => {
        const em = getCurrentUserEmail();
        if ((userAuth || []).some((a) => a.email === em)) return "admin";
        if ((teacherAuth || []).some((a) => a.email === em)) return "teacher";
        return "";
    };

    const createPayments = async (receiptImageUrl) => {
        if (
            selectedPayments.length === 0 ||
            currentTerm === "" ||
            name === "" ||
            newclass === "" ||
            newSex === ""
        ) {
            toast.error("Please fill all the fields");
            return null;
        }

        const paymentsToUpload = selectedPayments.map((payment) => ({
            description: payment,
            currentterm: currentTerm,
            name: name,
            class: newclass,
            sex: newSex,
            invoiceno: newInvoiceNO,
            date: newDate,
            amountpaid: paymentAmounts[payment],
            paymentdescription: newPaymentDescription,
            receiptimage: receiptImageUrl, // Add the receipt image URL to the payment record
            user_id: user.id, // Use the actual user ID instead of name/email
        }));

        try {
            for (const paymentData of paymentsToUpload) {
                const { data: existingPayments, error: fetchError } = await supabase
                    .from("jmis_paymentsinfo")
                    .select("*")
                    .eq("name", paymentData.name)
                    .eq("description", paymentData.description)
                    .eq("class", paymentData.class)
                    .eq("currentterm", paymentData.currentterm);

                if (fetchError) {
                    toast.error("Error fetching existing payments: " + fetchError.message);
                    return;
                }

                if (existingPayments.length > 0) {
                    const oldAmount = existingPayments[0].amountpaid;
                    const updatedAmount = parseFloat(oldAmount) + parseFloat(paymentData.amountpaid);

                    const { error: updateError } = await supabase
                        .from("jmis_paymentsinfo")
                        .update({
                            amountpaid: updatedAmount,
                            date: newDate,
                            paymentdescription: newPaymentDescription,
                        })
                        .eq("id", existingPayments[0].id);

                    if (updateError) {
                        toast.error("Error updating payment: " + updateError.message);
                    } else {
                        toast.success(`Payment for ${paymentData.description} updated successfully!`);
                        
                        // Send email notification for payment update
                        const currentUserEmail = getCurrentUserEmail();
                        const emailSubject = 'Payment Updated';
                        const emailMessage = `A payment record has been updated by ${currentUserEmail}:

Student Name: ${paymentData.name}
Class: ${paymentData.class}
Payment Type: ${paymentData.description}
Amount: ${paymentData.amountpaid}
Term: ${paymentData.currentterm}
Date: ${paymentData.date}`;
                        await sendEmailNotification(supabase, emailSubject, emailMessage);

                        // Audit: payment updated
                        logAction(supabase, {
                            email: currentUserEmail,
                            role: getAuditRole(),
                            action: "payment_update",
                            targetTable: "jmis_paymentsinfo",
                            recordId: existingPayments[0].id,
                            details: { name: paymentData.name, class: paymentData.class, description: paymentData.description, amountpaid: paymentData.amountpaid, term: paymentData.currentterm },
                        });
                    }
                } else {
                    const { error } = await supabase.from("jmis_paymentsinfo").insert([paymentData]);

                    if (error) {
                        toast.error("Error creating payment: " + error.message);
                    } else {
                        toast.success(`Payment for ${paymentData.description} created successfully!`);
                        
                        // Send email notification for new payment
                        const currentUserEmail = getCurrentUserEmail();
                        const emailSubject = 'New Payment Created';
                        const emailMessage = `A new payment record has been created by ${currentUserEmail}:

Student Name: ${paymentData.name}
Class: ${paymentData.class}
Payment Type: ${paymentData.description}
Amount: ${paymentData.amountpaid}
Term: ${paymentData.currentterm}
Date: ${paymentData.date}`;
                        await sendEmailNotification(supabase, emailSubject, emailMessage);

                        // Audit: payment created
                        logAction(supabase, {
                            email: currentUserEmail,
                            role: getAuditRole(),
                            action: "payment_create",
                            targetTable: "jmis_paymentsinfo",
                            details: { name: paymentData.name, class: paymentData.class, description: paymentData.description, amountpaid: paymentData.amountpaid, term: paymentData.currentterm },
                        });
                    }
                }
            }

            setSelectedPayments([]);
            setPaymentAmounts({});
            setCurrentTerm("");
            setName("");
            setNewClass("");
            setNewSex("");
            setNewInvoiceNO("");
            setNewPaymentDescription("");
            setNewDate(formattedDate);
            if (isRouterAvailable) {
                router.push("/payments");
            } else {
                // Fallback to window.location for cases where router is not available
                window.location.href = "/payments";
            }
        } catch (error) {
            console.error("Error handling payment creation:", error);
            toast.error("Error creating payments: " + error.message);
        }
    };

    let printWindowRef = null;

    const printReceipt = (receiptData) => {
        if (printWindowRef && !printWindowRef.closed) {
            printWindowRef.focus();
            return;
        }

        printWindowRef = window.open("", "_blank");
        if (printWindowRef) {
            printWindowRef.document.write(`
            <html>
  <head>
    <title>Receipt</title>
    <link
      rel="stylesheet"
      href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css"
    />
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 20px;
      }
      .receipt {
        margin: 20px;
        padding: 20px;
        border: 1px solid #ccc;
        border-radius: 5px;
        background-image: url('${backgroundImage}');
        background-size: cover;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      }
      .receipt h2 {
        text-align: center;
        margin-top: 130px;
        font-weight: 900;
        color: green;
      }
      .form-group {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        padding: 20px;
        padding-right: 70px
      }
      .receipt h5 {
        margin: 5px 0;
      }
      .receipt .header {
        font-weight: bold;
        margin-top: 15px;
        margin-bottom: 15px;
      }
      .receipt .footer {
        margin-top: 20px;
        text-align: center;
        background-color: rgb(3, 148, 25);
        padding: 10px;
        font-size: 20px;
        color: white;
        font-weight: bold;
      }
        span{
        margin-left: 30px;
        padding: 3px 10px;
        font-weight: 700;
        }
        .span{
        width: 150px;
        font-weight: 400;
        }
    </style>
  </head>
  <body>
    <div class="receipt">
      <h2 class="mb-4">Receipt</h2>
      <div class="form-group">
      <h5 class="header"><span class='span'>Name: </span><span>${receiptData.name}</span></h5>
      <h5 class="header"><span class='span'>Description: </span><span>${receiptData.description}</span></h5>
      <h5 class="header"><span class='span'>Term: </span><span>${receiptData.currentterm}</span></h5>
      <h5 class="header"><span class='span'>Invoice No: </span><span>${receiptData.invoiceno}</span></h5>
      <h5 class="header"><span class='span'>Class: </span><span>${receiptData.class}</span></h5>
      <h5 class="header"><span class='span'>Amount Paid: </span><span>${receiptData.amountpaid}</span></h5>
      <h5 class="header"><span class='span'>Date: </span><span>${receiptData.date}</span></h5>
      <h5 class="header">
        <span class='span'>Payment Description: </span><span>${receiptData.paymentdescription}</span>
      </h5>
      </div>
      <div class="footer">Thank you for doing business!</div>
    </div>
  </body>
</html>
        `);

            printWindowRef.document.close();

            const intervalCheck = setInterval(() => {
                const receiptElem = printWindowRef.document.querySelector(".receipt");
                if (receiptElem && getComputedStyle(receiptElem).backgroundImage !== "none") {
                    clearInterval(intervalCheck);
                    setTimeout(() => {
                        printWindowRef.print();
                    }, 500);
                }
            }, 100);
        } else {
            toast.error("Failed to open print window. Please check your browser settings.");
        }
    };

    // Canonical Creche → Year 12 list (see utils/classOptions.js)
    const classOptions = CLASS_OPTIONS;

    const sexOptions = ['Male', 'Female'];

    const paymentOptions = [
        'School Fees', 'Skill acquisition', 'Exam fee', 'Nursery Uniform', 'Primary Uniform', 'Js Uniform', 'Ss Uniform',
        'PreNursery1 Textbook', 'PreNursery2 Textbook', 'Nursery Textbook', 'Primary Textbook', 'Js Textbook', 'Ss Textbook',
        'Nursery Exercise Book', 'Primary Exercise Book', 'Secondary Exercise Book', 'Waec Fee Art', 'Waec Fee Science',
        'Bus Fee', 'Excursion Fee', 'Party Fee', 'Inter-house Sport Fee', 'Development Levy', 'Medicals', 'PTA', 'Admission Form'
    ];

    const currentTermOptions = ['1st Term', '2nd Term', '3rd Term'];

    const paymentDescriptionOptions = ['Paid via Cash', 'Paid via POS', 'Paid via Bank Transfer', 'Paid via Bank Deposit'];

    const formItems = [
        { type: "studentsdropdown", label: "NAME", placeholder: "Select Student Name", value: name, setValue: setName, option: studentsOptions },
        { type: "dropdown", label: "CLASS", value: newclass, setValue: setNewClass, placeholder: "Select Student Class", option: classOptions },
        { type: "termdropdown", label: "CURRENT TERM", placeholder: "Select Current Term", value: currentTerm, setValue: setCurrentTerm, option: currentTermOptions },
        { type: "sexDropdown", label: "GENDER", value: newSex, setValue: setNewSex, placeholder: "Select Student Gender", option: sexOptions },
        { type: "input", label: "INVOICE NO", placeholder: "Enter invoice/receipt number", value: newInvoiceNO, setValue: setNewInvoiceNO },
        { type: "display", label: "DATE", placeholder: "DATE", value: newDate, setValue: setNewDate },
        { type: "paymentDescriptionDropdown", label: "PAYMENT DESCRIPTION", placeholder: "Enter payment description", value: newPaymentDescription, setValue: setNewPaymentDescription, option: paymentDescriptionOptions },
    ];

    const uploadImage = async () => {
        if (!image) return null;

        try {
            const fileExt = image.name.split('.').pop();
            const fileName = `${uuid()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            const { data, error } = await supabase
                .storage
                .from('images')
                .upload(filePath, image);

            if (error) {
                toast.error('Error uploading image: ' + error.message);
                return null;
            } else {
                // Get the public URL of the uploaded image using the correct CDN URL
                const publicUrl = `https://BLUEBELL_SUPABASE_REF_PLACEHOLDER.supabase.co/storage/v1/object/public/images/${filePath}`;
                
                setReceiptImageUrl(publicUrl);
                toast.success('Image uploaded successfully!');
                return publicUrl; // Return the image URL
            }
        } catch (error) {
            toast.error('Error uploading image: ' + error.message);
            return null;
        }
    };

    const selectedTotal = selectedPayments.reduce((sum, p) => sum + (parseFloat(paymentAmounts[p]) || 0), 0);

    return (
        <>
            <ToastContainer />
            {loading ? (
                <div className="ap-loading">
                    <div className="ap-spinner" />
                    <div>Verifying credentials...</div>
                </div>
            ) : user && Object.keys(user).length !== 0 && userAuth && userAuth.some && userAuth.some(auth => auth.email === user?.user_metadata?.email) ? (
                <div className="ap-page">
                    <div className="ap-head">
                        <div>
                            <h1 className="ap-title">
                                <span className="ap-title-ic"><RiMoneyDollarCircleLine /></span>
                                Record New Payment
                            </h1>
                            <p className="ap-sub">Use Chrome Browser for Payments!</p>
                        </div>
                        <div className="ap-pills">
                            <span className="ap-pill"><RiCheckboxCircleLine /> {selectedPayments.length} item(s) selected</span>
                            <span className="ap-pill blue"><RiWalletLine /> ₦ {selectedTotal.toLocaleString()}</span>
                        </div>
                    </div>

                    <form>
                        {/* Payment Options Grid */}
                        <div className="ap-card">
                            <div className="ap-card-head">
                                <span className="ic"><RiWalletLine /></span>
                                Select Payment Titles &amp; Enter Amounts
                                <span className="ap-card-sub">{selectedPayments.length} selected</span>
                            </div>
                            <div className="ap-card-body">
                                <div className="ap-form-grid three">
                                    {paymentOptions.map((payment, index) => (
                                        <div
                                            key={index}
                                            className="ap-field"
                                            style={{ padding: '9px 11px', border: '1px solid var(--card-border, #e5e7eb)', borderRadius: 10, marginBottom: 0 }}
                                        >
                                            <label className="ap-label" htmlFor={`payment-${index}`} style={{ cursor: 'pointer', textTransform: 'none', fontSize: '0.8rem', letterSpacing: 0 }}>
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input me-2"
                                                    id={`payment-${index}`}
                                                    checked={selectedPayments.includes(payment)}
                                                    onChange={() => handlePaymentCheckboxChange(payment)}
                                                />
                                                {payment}
                                            </label>
                                            {selectedPayments.includes(payment) && (
                                                <input
                                                    type="number"
                                                    className="ap-input"
                                                    placeholder={`Amount for ${payment}`}
                                                    value={paymentAmounts[payment] || ""}
                                                    onChange={(e) => handleAmountChange(payment, e.target.value)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Other Form Fields */}
                        <div className="ap-card">
                            <div className="ap-card-head">
                                <span className="ic blue"><RiSecurePaymentLine /></span>
                                Payment Details
                            </div>
                            <div className="ap-card-body">
                                <div className="ap-form-grid">
                                    {formItems.map((item, index) => (
                                        <label className="ap-field" key={index}>
                                            <span className="ap-label">{item.label}</span>
                                            {item.type === "dropdown" ||
                                                item.type === "termdropdown" ||
                                                item.type === "studentsdropdown" ||
                                                item.type === "sexDropdown" ||
                                                item.type === "paymentDescriptionDropdown" ? (
                                                <select
                                                    id={`input-${index}`}
                                                    className="ap-input"
                                                    value={item.value}
                                                    onChange={(e) => item.setValue(e.target.value)}
                                                >
                                                    <option value="" disabled>{item.placeholder}</option>
                                                    {item.option &&
                                                        item.option.map((op, idx) => <option key={idx} value={op}>{op}</option>)}
                                                </select>
                                            ) : (
                                                <input
                                                    type={item.mainType || "text"}
                                                    id={`input-${index}`}
                                                    className="ap-input"
                                                    placeholder={item.placeholder}
                                                    value={item.value}
                                                    onChange={(e) => item.setValue(e.target.value)}
                                                />
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Display uploaded receipt image */}
                        {receiptImageUrl && (
                            <div className="ap-card">
                                <div className="ap-card-head">
                                    <span className="ic amber"><RiReceiptLine /></span>
                                    Uploaded Receipt
                                </div>
                                <div className="ap-card-body">
                                    <img
                                        src={receiptImageUrl}
                                        alt="Uploaded Receipt"
                                        style={{ maxWidth: '100%', maxHeight: '300px', border: '1px solid var(--card-border, #e5e7eb)', borderRadius: '10px' }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Upload Image */}
                        <div className="ap-card">
                            <div className="ap-card-head">
                                <span className="ic amber"><RiUploadCloud2Line /></span>
                                Upload Receipt Image
                            </div>
                            <div className="ap-card-body">
                                <input
                                    type="file"
                                    className="ap-input"
                                    accept="image/*"
                                    onChange={(e) => setImage(e.target.files[0])}
                                />
                                {image && (
                                    <button
                                        type="button"
                                        className="ap-btn soft"
                                        style={{ marginTop: 12 }}
                                        onClick={async () => {
                                            await uploadImage();
                                        }}
                                        disabled={loading}
                                    >
                                        {loading ? "Uploading..." : "Upload Receipt"}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Submission Button */}
                        <button
                            type="button"
                            className="ap-btn primary"
                            style={{ padding: '12px 26px', fontSize: '1rem' }}
                            onClick={async () => {
                                setLoading(true);
                                const imageUrl = await uploadImage(); // Upload image first
                                await createPayments(imageUrl); // Pass image URL to createPayments
                                setLoading(false);
                            }}
                            disabled={loading}
                        >
                            {loading ? "Processing..." : "Create Payment"}
                        </button>
                    </form>
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
};

export default NewPayment;