import "bootstrap/dist/css/bootstrap.min.css";
import React, { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import { Card, Col, Container, Row } from "react-bootstrap";
import { useRouter } from "next/router";
import { v4 as uuid } from "uuid";
import { NavbarComponent } from "../components/Navbar.jsx";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  RiReceiptLine,
  RiUploadCloud2Line,
  RiEyeLine,
  RiDownloadLine,
  RiErrorWarningLine,
  RiInboxLine,
} from 'react-icons/ri';
import '../styles/AdminPages.css';

const CBTCdnUrl = 'https://BLUEBELL_SUPABASE_REF_PLACEHOLDER.supabase.co/storage/v1/object/public/cbt/';
const SHARED_FOLDER = '59426b4b-18cc-48d4-aac5-400c4276e688';

export default function Receipt() {
    const [user, setUser] = useState();
    const [teacherAuth, setTeacherAuth] = useState([]);
    const [loading, setLoading] = useState(true); // Single loading state
    // Safely initialize router
    let router;
    let isRouterAvailable = false;
    
    try {
        router = useRouter();
        isRouterAvailable = router && router.push;
    } catch (error) {
        console.warn('NextRouter not available in this context');
    }
    const [images, setImages] = useState([]);
    const [userauth, setUserAuth] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [allUsersImages, setAllUsersImages] = useState([]);
    const [paymentInfo, setPaymentInfo] = useState({});

    // Function to view receipt in full window
    const viewReceipt = (imageUrl) => {
        if (imageUrl) {
            window.open(imageUrl, '_blank'); // Opens receipt in a new tab
        } else {
            toast.error("Failed to load receipt URL");
        }
    }

    // Function to download receipt
    const downloadReceipt = async (imageUrl, imageName) => {
        try {
            if (imageUrl && imageName) {
                // Fetch the image as a Blob
                const response = await fetch(imageUrl, { mode: "cors" }); // Ensures cross-origin access
                if (!response.ok) {
                    throw new Error("Failed to fetch image for download.");
                }

                const blob = await response.blob(); // Converts the response into a Blob format

                // Create a temporary URL for the Blob
                const blobUrl = window.URL.createObjectURL(blob);

                // Create a download link element
                const link = document.createElement("a");
                link.href = blobUrl;
                link.download = imageName; // Sets the desired filename for the download
                document.body.appendChild(link); // Add the link element to the DOM
                link.click(); // Programmatically click on the link to trigger the download
                document.body.removeChild(link); // Remove the link element after the download is triggered

                // Revoke the Blob URL to free memory
                window.URL.revokeObjectURL(blobUrl);
            } else {
                throw new Error("Invalid URL or file name provided.");
            }
        } catch (error) {
            console.error("Error downloading receipt:", error.message); // Logs error for debugging
            toast.error("Failed to download receipt. Please try again later."); // Alerts the user
        }
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
                const [userData, teacherData] = await Promise.all([
                    supabase.from('bluebell_userauth').select('email'),
                    supabase.from('bluebell_teacherauth').select('email')
                ]);
                
                // Handle user auth data
                if (userData.error) throw userData.error;
                setUserAuth(userData.data || []);
                
                // Handle teacher auth data
                if (teacherData.error) throw teacherData.error;
                setTeacherAuth(teacherData.data || []);
                
                // Check if current user is admin (based on email match now)
                const isAdminUser = userData.data.some(auth => auth.email === currentUser?.user_metadata?.email);
                setIsAdmin(isAdminUser);
                
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
                
                // Fetch images after user data is loaded
                await fetchImages(currentUser);
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

    const fetchImages = async (currentUser) => {
        if (!currentUser?.id) return;
        
        try {
            // Fetch payment information for the user
            const { data: paymentData, error: paymentError } = await supabase
                .from('bluebell_paymentsinfo')
                .select('*');
            
            if (!paymentError && paymentData) {
                // Create a map of payment info by image name for easy lookup
                const paymentMap = {};
                paymentData.forEach(payment => {
                    if (payment.receiptimage) {
                        // Extract the image name from the URL
                        const imageName = payment.receiptimage.split('/').pop();
                        paymentMap[imageName] = payment;
                    }
                });
                setPaymentInfo(paymentMap);
            }
            
            // Fetch all images from the shared CBT folder for everyone
            try {
                const { data: cbtData, error: cbtError } = await supabase
                    .storage
                    .from('cbt')
                    .list(SHARED_FOLDER + '/', { limit: 1000 });
                
                if (!cbtError && cbtData) {
                    const cbtImages = cbtData.map(img => ({
                        name: img.name,
                        userId: SHARED_FOLDER,
                        paymentInfo: paymentInfo[img.name] || null,
                        isCbtImage: true
                    }));
                    
                    if (isAdmin) {
                        setAllUsersImages(cbtImages);
                    } else {
                        setImages(cbtImages);
                    }
                }
            } catch (error) {
                console.log('Could not fetch CBT images:', error);
                toast.error("Failed to fetch receipts. Please try again.");
            }
        } catch (error) {
            console.error('Error fetching images:', error);
            toast.error("Failed to fetch receipts. Please try again.");
        }
    };

    const handleUpload = async (file) => {
        if (file) {
            // Generate a unique filename with extension
            const fileExt = file.name.split('.').pop();
            const fileName = `${uuid()}.${fileExt}`;
            // Upload to the shared folder in CBT bucket for everyone
            const filePath = `${SHARED_FOLDER}/${fileName}`;

            const { data, error } = await supabase
                .storage
                .from('cbt')
                .upload(filePath, file);

            if (error) {
                console.error('Upload error:', error);
                toast.error("Upload failed: " + error.message);
            } else {
                await fetchImages(user); // Refresh images after upload
                toast.success('Receipt uploaded successfully');
            }
        }
    };

    const handleDelete = async (imageName, userId = null) => {
        // Everyone deletes from the same shared folder
        if (imageName) {
            const { error } = await supabase
                .storage
                .from('cbt')
                .remove([`${SHARED_FOLDER}/${imageName}`]);

            if (error) {
                console.error('Delete error:', error);
                toast.error("Delete failed: " + error.message);
            } else {
                await fetchImages(user); // Refresh images after delete
                toast.success('Receipt deleted successfully');
            }
        }
    };

    return (
        <>
            <ToastContainer />
            {/* Show loading indicator while verifying credentials */}
            {loading ? (
                <div className="ap-loading">
                    <div className="ap-spinner" />
                    <div>Verifying credentials...</div>
                </div>
            ) : userauth.some(auth => auth.email === user?.user_metadata?.email) ? (
                <div className="ap-page">
                    <div className="ap-head">
                        <div>
                            <h1 className="ap-title">
                                <span className="ap-title-ic amber"><RiReceiptLine /></span>
                                Upload / View Receipts
                            </h1>
                            <p className="ap-sub">Use the Choose File button below to upload a receipt to your database.</p>
                        </div>
                        <div className="ap-pills">
                            <span className="ap-pill"><RiInboxLine /> {(isAdmin ? allUsersImages : images).length} receipt(s)</span>
                        </div>
                    </div>

                    <div className="ap-toolbar">
                        <Form.Group style={{ flex: '2 1 260px', minWidth: 0, margin: 0 }}>
                            <Form.Control id='fileInput' className="ap-input" type='file' accept='image/png, image/jpeg' />
                        </Form.Group>
                        <button onClick={() => {
                            const fileInput = document.getElementById('fileInput');
                            if (fileInput.files[0]) {
                                handleUpload(fileInput.files[0]);
                            }
                        }} className="ap-btn primary">
                            <RiUploadCloud2Line /> Upload Image
                        </button>
                    </div>

                    <div className="ap-card">
                        <div className="ap-card-head">
                            <span className="ic amber"><RiReceiptLine /></span>
                            {isAdmin ? "All Users' Receipts" : "Your Receipts"}
                            <span className="ap-card-sub">{(isAdmin ? allUsersImages : images).length} total</span>
                        </div>
                        <div className="ap-card-body">
                            {(isAdmin ? allUsersImages : images).length === 0 ? (
                                <div className="ap-empty">
                                    <RiInboxLine />
                                    No receipts uploaded yet.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                                    {(isAdmin ? allUsersImages : images).map((image) => {
                                        // Get payment info for this image
                                        const payment = image.paymentInfo || paymentInfo[image.name];

                                        return (
                                            <div key={`${image.userId}-${image.name}`} className="ap-card" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
                                                <img
                                                    src={CBTCdnUrl + image.userId + "/" + image.name}
                                                    alt={image.name}
                                                    style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderBottom: '1px solid var(--card-border, #e5e7eb)' }}
                                                />
                                                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                                                    {/* Display payment information if available */}
                                                    {payment && (
                                                        <div>
                                                            <strong style={{ fontSize: '0.88rem' }}>{payment.description}</strong>
                                                            <p className="ap-sub" style={{ fontSize: '0.8rem', margin: '2px 0 0' }}>
                                                                Amount: <span className="ap-money">₦{payment.amountpaid}</span> · {payment.date}
                                                            </p>
                                                            <p className="ap-sub" style={{ fontSize: '0.8rem', margin: '2px 0 0' }}>
                                                                Term: {payment.currentterm}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {isAdmin && (
                                                        <div><small className="ap-sub" style={{ fontSize: '0.75rem' }}>User: {image.userId}</small></div>
                                                    )}
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                                                        <button
                                                            className="ap-btn green sm"
                                                            onClick={() => viewReceipt(CBTCdnUrl + image.userId + "/" + image.name)}
                                                        >
                                                            <RiEyeLine /> View
                                                        </button>
                                                        <button
                                                            className="ap-btn blue sm"
                                                            onClick={() =>
                                                                downloadReceipt(CBTCdnUrl + image.userId + "/" + image.name, image.name)
                                                            }
                                                        >
                                                            <RiDownloadLine /> Download
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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