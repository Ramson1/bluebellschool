import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
// import { NavbarComponent } from "../components/Navbar.jsx"; // Unused import removed
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  RiPriceTagLine,
  RiSaveLine,
  RiAddCircleLine,
  RiStackLine,
  RiErrorWarningLine,
  RiBookOpenLine,
} from 'react-icons/ri';
import '../styles/AdminPages.css';

// Fee fields grouped for the update / create forms: [key, label, input type]
const FEE_GROUPS = [
  {
    title: 'School Fees',
    fields: [
      ['creche', 'Crèche School Fee', 'number'],
      ['prenursery1', 'Pre-Nursery 1 School Fee', 'number'],
      ['prenursery2', 'Pre-Nursery 2 School Fee', 'number'],
      ['nursery1', 'Nursery 1 School Fee', 'number'],
      ['nursery2', 'Nursery 2 School Fee', 'number'],
      ['year1', 'Year 1 School Fee', 'number'],
      ['year2', 'Year 2 School Fee', 'number'],
      ['year3', 'Year 3 School Fee', 'number'],
      ['year4', 'Year 4 School Fee', 'number'],
      ['year5', 'Year 5 School Fee', 'number'],
      ['year6', 'Year 6 School Fee', 'number'],
      ['year7', 'Year 7 School Fee', 'number'],
      ['year8', 'Year 8 School Fee', 'number'],
      ['year9', 'Year 9 School Fee', 'number'],
      ['clubFee', 'Club Fee', 'number'],
    ],
  },
  {
    title: 'Uniform & Party',
    fields: [
      ['prenursery1uniform', 'Pre-Nursery 1 Uniform', 'text'],
      ['prenursery2uniform', 'Pre-Nursery 2 Uniform', 'text'],
      ['nurseryuniform', 'Nursery Uniform', 'text'],
      ['yearuniform', 'Year Uniform', 'text'],
      ['partyfee', 'Party Fee', 'text'],
    ],
  },
  {
    title: 'Textbooks',
    fields: [
      ['prenursery1textbook', 'Pre-Nursery 1 Textbook', 'text'],
      ['prenursery2textbook', 'Pre-Nursery 2 Textbook', 'text'],
      ['nursery1textbook', 'Nursery 1 Textbook', 'text'],
      ['nursery2textbook', 'Nursery 2 Textbook', 'text'],
      ['year1textbook', 'Year 1 Textbook', 'text'],
      ['year2textbook', 'Year 2 Textbook', 'text'],
      ['year3textbook', 'Year 3 Textbook', 'text'],
      ['year4textbook', 'Year 4 Textbook', 'text'],
      ['year5textbook', 'Year 5 Textbook', 'text'],
      ['year6textbook', 'Year 6 Textbook', 'text'],
      ['year7textbook', 'Year 7 Textbook', 'text'],
      ['year8textbook', 'Year 8 Textbook', 'text'],
      ['year9textbook', 'Year 9 Textbook', 'text'],
    ],
  },
  {
    title: 'Exercise Books',
    fields: [
      ['prenursery1exercisebook', 'Pre-Nursery 1 Exercise Book', 'text'],
      ['prenursery2exercisebook', 'Pre-Nursery 2 Exercise Book', 'text'],
      ['nurseryexercisebook', 'Nursery Exercise Book', 'text'],
      ['yearexercisebook', 'Year Exercise Book', 'text'],
      ['year6exercisebook', 'Year 6 Exercise Book', 'text'],
      ['year7exercisebook', 'Year 7 Exercise Book', 'text'],
      ['year8exercisebook', 'Year 8 Exercise Book', 'text'],
      ['year9exercisebook', 'Year 9 Exercise Book', 'text'],
    ],
  },
  {
    title: 'Other Levies',
    fields: [
      ['excursionfees', 'Excursion Fees', 'text'],
      ['admissionForm', 'Admission Form', 'text'],
      ['tuitionFee', 'Tuition Fee', 'text'],
      ['learningResources', 'Learning Resources', 'text'],
      ['lessonFee', 'Lesson Fee', 'text'],
      ['afterSchoolCare', 'After School Care', 'text'],
      ['busFee', 'Bus Fee', 'text'],
    ],
  },
];

const EMPTY_NEW_FEE = { creche: '', prenursery1: '', prenursery2: '', nursery1: '', nursery2: '', year1: '', year2: '', year3: '', year4: '', year5: '', year6: '', year7: '', year8: '', year9: '', clubFee: '', prenursery1uniform: '', prenursery2uniform: '', nurseryuniform: '', yearuniform: '', partyfee: '', prenursery1textbook: '', prenursery2textbook: '', nursery1textbook: '', nursery2textbook: '', year1textbook: '', year2textbook: '', year3textbook: '', year4textbook: '', year5textbook: '', year6textbook: '', year7textbook: '', year8textbook: '', year9textbook: '', prenursery1exercisebook: '', prenursery2exercisebook: '', nurseryexercisebook: '', yearexercisebook: '', year6exercisebook: '', year7exercisebook: '', year8exercisebook: '', year9exercisebook: '', excursionfees: '', admissionForm: '', tuitionFee: '', learningResources: '', lessonFee: '', afterSchoolCare: '', busFee: '' };

export default function TermlyFees() {
    const [user, setUser] = useState();
    // const [teacherAuth, setTeacherAuth] = useState([]); // Unused variable removed
    const [classFees, setClassFees] = useState([]);
    const [editedFees, setEditedFees] = useState([]);
    const [newFee, setNewFee] = useState({ ...EMPTY_NEW_FEE }); // State for new fee entry
    const [loading, setLoading] = useState(true); // Add loading state
    const [userauth, setUserAuth] = useState([]); // State for userauth
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
                const [userData, teacherData, classFeesData] = await Promise.all([
                    supabase.from('jmis_userauth').select('email'),
                    supabase.from('jmis_teacherauth').select('email'),
                    supabase.from('jmis_classfees').select('*')
                ]);
                
                // Handle user auth data
                if (userData.error) throw userData.error;
                setUserAuth(userData.data || []);
                
                // Handle teacher auth data
                if (teacherData.error) throw teacherData.error;
                // setTeacherAuth(teacherData.data || []); // Unused variable assignment removed
                
                // Handle class fees data
                if (classFeesData.error) throw classFeesData.error;
                setClassFees(classFeesData.data || []);
                setEditedFees(classFeesData.data || []);
                
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

    // Check if the current user is a teacher
    // const isTeacher = user && teacherAuth && teacherAuth.some && teacherAuth.some(auth => auth.email === user?.user_metadata?.email); // Unused variable removed
    
    const handleChange = (index, field) => (e) => {
        const newFees = [...editedFees];
        newFees[index][field] = e.target.value;
        setEditedFees(newFees);
    };

    const handleNewFeeChange = (field) => (e) => {
        setNewFee({ ...newFee, [field]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        for (const fee of editedFees) {
            const { error } = await supabase
                .from('jmis_classfees') // Replace with your actual table name
                .update(fee)
                .eq('id', fee.id); // Assuming 'id' is the primary key
            if (error) console.error(error);
        }
        // Optionally, refetch the class fees after updating
        const { data } = await supabase.from('jmis_classfees').select('*');
        setClassFees(data);
        toast.success("Termly fees successfully updated!!");
        // navigate('/home');
    };

    const handleAddNewFee = async (e) => {
        e.preventDefault(); // Prevent default form submission
        const { error } = await supabase
            .from('jmis_classfees') // Ensure this matches your table name
            .insert([newFee]); // Insert the new fee
        if (error) {
            console.error("Error adding new fee:", error); // Log any errors
            toast.error("Failed to add fee. Please try again."); // Alert user
        } else {
            setClassFees([...classFees, newFee]); // Update local state
            
            setNewFee({ ...EMPTY_NEW_FEE });
            toast.success("Termly fees successfully created!!");
            // router.push('/home');
        }
    };

    // const signOutUser = async () => { // Unused function removed
    //     const { error } = await supabase.auth.signOut();
    //     router.push("/login");
    // };

    const isAdmin = userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email);

    // Shared field renderer for both the update and create forms
    const renderFeeForm = (source, onFieldChange) =>
        FEE_GROUPS.map((group) => (
            <div key={group.title}>
                <p className="ap-sub" style={{ fontWeight: 700, margin: '16px 0 10px' }}>{group.title}</p>
                <div className="ap-form-grid three">
                    {group.fields.map(([key, label, type]) => (
                        <label className="ap-field" key={key}>
                            <span className="ap-label">{label}</span>
                            <input
                                type={type}
                                className="ap-input"
                                value={source[key] ?? ''}
                                onChange={onFieldChange(key)}
                            />
                        </label>
                    ))}
                </div>
            </div>
        ));

    return (
        <>
            <ToastContainer />
            {loading ? (
                <div className="ap-loading">
                    <div className="ap-spinner" />
                    <div>Verifying credentials...</div>
                </div>
            ) : isAdmin ? (
                <div className="ap-page">
                    <div className="ap-head">
                        <div>
                            <h1 className="ap-title">
                                <span className="ap-title-ic"><RiPriceTagLine /></span>
                                Set Termly Fees
                            </h1>
                            <p className="ap-sub">Manage school fees and levies for every class, in one place.</p>
                        </div>
                        <div className="ap-pills">
                            <span className="ap-pill"><RiStackLine /> {editedFees.length} fee sheet(s)</span>
                        </div>
                    </div>

                    {editedFees.length >= 1 ? (
                        <form onSubmit={handleSubmit}>
                            {editedFees.map((fee, index) => (
                                <div key={fee.id} className="ap-card">
                                    <div className="ap-card-head">
                                        <span className="ic"><RiBookOpenLine /></span>
                                        Update Termly Fees — Sheet {index + 1}
                                        <span className="ap-card-sub">Edit values below and save</span>
                                    </div>
                                    <div className="ap-card-body">
                                        {renderFeeForm(fee, (key) => handleChange(index, key))}
                                    </div>
                                </div>
                            ))}
                            {isAdmin ? (
                                <button type="submit" className="ap-btn primary">
                                    <RiSaveLine /> Update Fees
                                </button>
                            ) : (
                                <button className="ap-btn ghost" disabled>Only For Admins</button>
                            )}
                        </form>
                    ) : (
                        <form onSubmit={handleAddNewFee}>
                            <div className="ap-card">
                                <div className="ap-card-head">
                                    <span className="ic"><RiPriceTagLine /></span>
                                    Create New Fee Sheet
                                    <span className="ap-card-sub">No fee sheet exists yet</span>
                                </div>
                                <div className="ap-card-body">
                                    {renderFeeForm(newFee, handleNewFeeChange)}
                                </div>
                            </div>
                            {isAdmin ? (
                                <button type="submit" className="ap-btn primary">
                                    <RiAddCircleLine /> Add Fee
                                </button>
                            ) : (
                                <button className="ap-btn ghost" disabled>Only For Admins</button>
                            )}
                        </form>
                    )}
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
    )
}
