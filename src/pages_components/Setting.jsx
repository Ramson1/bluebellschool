// Importing necessary libraries and modules
import React, { useEffect, useState } from 'react';
// import { NavbarComponent } from '../components/Navbar'; // Unused import removed
import { useRouter } from "next/router";
import { supabase } from '../supabaseClient';
import { CLASS_OPTIONS } from '../utils/classOptions';
import '../styles/settings.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from 'react-bootstrap/Modal';
import { logAction } from '../api/auditLog';
import { DEV_EMAILS } from '../utils/authUtils';
import {
  RiUserLine,
  RiSettings3Line,
  RiRocketLine,
  RiMoneyDollarCircleLine,
  RiGlobalLine,
  RiCameraLine,
  RiSaveLine,
  RiLockLine,
  RiLockUnlockLine,
  RiEditLine,
  RiCheckLine,
  RiCloseLine,
  RiArrowRightLine,
  RiHistoryLine,
  RiRecordCircleLine,
  RiCalendarLine,
  RiStackLine,
} from 'react-icons/ri';
// import XLSX from 'xlsx'; // Unused import removed

// Main Settings Component
function Setting() {
  // State for managing user and various settings
  const [user, setUser] = useState();
  const [teacherAuth, setTeacherAuth] = useState([]);
  const [session, setSession] = useState('');
  const [term, setTerm] = useState('');
  const [nextTermBegins, setNextTermBegins] = useState('');
  const [nextTermFees, setNextTermFees] = useState(0);
  const [classFees, setClassFees] = useState([]);
  const [schoolOpened, setSchoolOpened] = useState(0);
  const [checkResult, setCheckResult] = useState(""); // State for storing checkResult date
  const [heroContent, setHeroContent] = useState([{ image: '', heading: '', content: '' }]);
  const [aboutContent, setAboutContent] = useState({ text: '', text2: '', details: [{ heading: '', content: '' }] });
  const [newDetailHeading, setNewDetailHeading] = useState('');
const [newDetailContent, setNewDetailContent] = useState('');
  const [facilitiesContent, setFacilitiesContent] = useState([{ image: '', heading: '', content: '' }]);
  const [galleryContent, setGalleryContent] = useState([{ image: '', content: '' }]);
  const [testimonialContent, setTestimonialContent] = useState([{ text: '', image: '' }]);
  const [contactContent, setContactContent] = useState({ email: '', phone: '', address: '' });
  const [adminEmail, setAdminEmail] = useState(''); // State for admin email
  // const [image, setImage] = useState(null); // Unused state removed
  const [loading, setLoading] = useState(false); // State for tracking loading state
  const [userauth, setUserAuth] = useState([]); // State for userauth
  const [cbtPassword, setCbtPassword] = useState(''); // State for cbtPassword
  // Tabbed settings navigation + account profile (signed-in admin)
  const [activeTab, setActiveTab] = useState('general');
  const [profileName, setProfileName] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [picBusy, setPicBusy] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false); 
  // Safely initialize router
  let router;
  let isRouterAvailable = false;
  
  try {
    router = useRouter();
    isRouterAvailable = router && router.push;
  } catch (error) {
    console.warn('NextRouter not available in this context');
  }  const [devAuth, setDevAuth] = useState([]);  const [lockResult, setLockResult] = useState(false); // Default to false

  // Developer check: DEV_EMAILS list or devauth table (same logic as FullStudent)
  const isDevUser = DEV_EMAILS.includes((user?.user_metadata?.email || '').toLowerCase()) ||
    (devAuth || []).some((auth) => (auth.email || '').toLowerCase() === (user?.user_metadata?.email || '').toLowerCase());

  // Fetch user data from Supabase
  useEffect(() => {
    const getUserData = async () => {
      const {
        data: { user },
        // error, // Unused variable removed
      } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
      }
    };

    const fetchTeacherAuth = async () => {
      try {
        const { data, error } = await supabase
          .from('bluebell_teacherauth')
          .select('email');
        if (error) throw error;
        setTeacherAuth(data);
      } catch (error) {}
    };

    const fetchData = async () => {
      try {
        const { data: settings } = await supabase
        .from('bluebell_settings')
        .select('*')
        .single();

      if (settings) {
        setSession(settings.session || '');
        setTerm(settings.term || '');
        setNextTermBegins(settings.nextTermBegins || '');
        setNextTermFees(settings.nextTermFees || 0);
        setSchoolOpened(settings.schoolOpened || 0);
        setCheckResult(settings.checkResult || '');
        setHeroContent(settings.heroContent || [{ image: '', heading: '', content: '' }]);
        setFacilitiesContent(settings.facilitiesContent || [{ image: '', heading: '', content: '' }]);
        setGalleryContent(settings.galleryContent || [{ image: '', content: '' }]);
        setTestimonialContent(settings.testimonialContent || [{ text: '', image: '' }]);
        // Fix the aboutContent initialization to ensure details array exists
        setAboutContent({
          text: settings.aboutContent?.text || '',
          text2: settings.aboutContent?.text2 || '',
          details: settings.aboutContent?.details || [{ heading: '', content: '' }]
        });
        setContactContent(settings.contactContent || { email: '', phone: '', address: '' });
        setAdminEmail(settings.adminEmail || ''); // Set admin email
        setCbtPassword(settings.cbtPassword || '');
        setLockResult(settings.lockResult || false); // Fetch lockResult value
      }
      
      // Fetch class-specific fees
      try {
        const { data: classFeesData, error: classFeesError } = await supabase
          .from('bluebell_class_specific_fees')
          .select('*');
          
        if (classFeesError) throw classFeesError;
        
        setClassFees(Array.isArray(classFeesData) ? classFeesData.map(fee => ({
                ...fee,
                next_term_fees: fee.next_term_fees || 0
              })) : []);
      } catch (feeError) {
        console.error('Error fetching class fees:', feeError);
        toast.error('Error fetching class fees');
      }
      } catch (e) {
      console.error('Error fetching data:', e);
      }
    };

    const fetchUserAuth = async () => {
      try {
        const { data, error } = await supabase
          .from('bluebell_userauth') // Assuming 'userauth' is the table name
          .select('email');
        if (error) throw error;
        setUserAuth(data); // Set userauth from Supabase
      } catch (error) {
        toast.error("Failed to fetch data. Please check your internet connection."); // Added alert for fetch failure
      }
    };

    const fetchDevAuth = async () => {
      try {
        const { data, error } = await supabase
          .from('devauth')
          .select('*');
        if (error) throw error;
        setDevAuth(data);
      } catch (error) {
        toast.error("Failed to fetch developer data. Please check your internet connection.");
      }
    };

    fetchDevAuth();
    fetchUserAuth();
    fetchTeacherAuth();
    getUserData();
    fetchData();
  }, []);

  // If user is a teacher, redirect to home
  useEffect(() => {
    const isTeacher = user && teacherAuth && teacherAuth.some && teacherAuth.some(auth => auth.email === user?.user_metadata?.email);
    if (isTeacher) {
      if (isRouterAvailable) {
        router.push('/home');
      } else {
        // Fallback to window.location for cases where router is not available
        window.location.href = '/home';
      }
    }
  }, [user, teacherAuth]);

  // Function to upload an image to Supabase storage and return its public URL
const uploadImage = async (file, fileName) => {
  try {
    const { /* data, */ error } = await supabase.storage.from("setting").upload(fileName, file);
    if (error) throw error;

    // Generate the public URL of the uploaded file
    const { publicUrl, error: urlError } = supabase.storage.from("setting").getPublicUrl(fileName);
    if (urlError) throw urlError;
    return publicUrl;
  } catch (err) {
    console.error(err);
    toast.error('Error uploading image: ' + err.message);
  }
};

// Utility function to handle uploading images for content arrays
const processImages = async (contentArray) => {
  return await Promise.all(
    contentArray.map(async (item) => {
      if (item.image && item.image.startsWith("data:")) {
        const base64Response = await fetch(item.image); // Fetch base64 image
        const blob = await base64Response.blob(); // Convert it to a Blob
        const fileExt = blob.type.split("/").pop(); // Extract file extension from Blob type
        const fileName = `${Date.now()}.${fileExt}`; // Generate a unique filename for the image
        const file = new File([blob], fileName, { type: blob.type }); // Convert Blob to File
        await uploadImage(file, fileName); // Upload and get public URL
        return { ...item, image: fileName }; // Update item with the uploaded image's filename
      }
      return item;
    })
  );
};

// Function to handle saving/updating settings, including heroContent which may contain images
  const handleSave = async () => {
    setLoading(true); // Set loading state to true
    try {
      // Process images for heroContent, facilitiesContent, galleryContent, and testimonialContent
      const updatedHeroContent = await processImages(heroContent);
      const updatedFacilitiesContent = await processImages(facilitiesContent);
      const updatedGalleryContent = await processImages(galleryContent);
      const updatedTestimonialContent = await processImages(testimonialContent);

      // Prepare data to save in the database
      const settingsData = {
        session,
        term,
        nextTermBegins,
        nextTermFees,
        schoolOpened,
        aboutContent,
        checkResult, 
        heroContent: updatedHeroContent,
        facilitiesContent: updatedFacilitiesContent,
        galleryContent: updatedGalleryContent,
        testimonialContent: updatedTestimonialContent,
        contactContent,
        adminEmail,
        cbtPassword,
        use_class_specific_fees: true, // Enable class-specific fees
        user_id: user.id,
      };
    // Check if settings for the user already exist
    const { data: existingSettingsData, error: fetchError } = await supabase.from('bluebell_settings').select('*').eq('user_id', user.id);
    
    if (fetchError) {
      console.error('Error fetching existing settings:', fetchError);
      throw fetchError;
    }
    
    // Use the first row if data exists, otherwise null
    const existingSettings = existingSettingsData && existingSettingsData.length > 0 ? existingSettingsData[0] : null;
    
    const query = existingSettings
      ? supabase.from('bluebell_settings').update(settingsData).eq('user_id', user.id) // Update existing settings
      : supabase.from('bluebell_settings').insert([settingsData]); // Insert new settings if none exist

          const { error: saveError } = await query;
      if (saveError) {
        console.error('Error saving settings:', saveError);
        throw saveError;
      }
      
      // Save class-specific fees
      for (const fee of classFees) {
        const { error: feeError } = await supabase
          .from('bluebell_class_specific_fees')
          .update({ next_term_fees: fee.next_term_fees })
          .eq('class_name', fee.class_name);
          
        if (feeError) {
          console.error('Error saving class fee:', feeError);
          toast.error(`Error saving fee for ${fee.class_name}`);
        }
      }

    toast.success('Settings saved successfully!');
    
    // Audit: settings saved
    logAction(supabase, {
      email: user?.user_metadata?.email,
      role: 'admin',
      action: 'settings_save',
      targetTable: 'bluebell_settings',
      details: { session, term },
    });
  } catch (e) {
    console.error('Error saving settings:', e);
    toast.error('Failed to save settings. Please try again.');
  } finally {
      setLoading(false); // Set loading state to false
  }
};

// ---------- Academic Session management has moved to /session_tools (Session Tools → Academic Session) ----------

// Function to add a new item to the heroContent array
const addHeroItem = () => {
  setHeroContent([...heroContent, { image: '', heading: '', content: '' }]);
};

  // Function to remove a hero item
  const removeHeroItem = (index) => {
    setHeroContent(heroContent.filter((_, idx) => idx !== index));
  };

  // Funtion to add a new item to the aboutContent details array
const addDetailsItems = (newItems) => {
  setAboutContent((prevState) => ({
    ...prevState,
    details: [...prevState.details, ...newItems]
  }));
};

// const removeDetailsItems = (condition) => { // Unused function removed
//   setAboutContent((prevState) => ({
//     ...prevState,
//     details: prevState.details.filter(item => !condition(item))
//   }));
// };

const handleAddDetail = () => {
  addDetailsItems([{ heading: newDetailHeading, content: newDetailContent }]);
  setNewDetailHeading('');
  setNewDetailContent('');
};

const handleRemoveDetail = (index) => {
  const newDetails = aboutContent.details.filter((_, i) => i !== index);
  setAboutContent({ ...aboutContent, details: newDetails });
};

   // Function to add a new facilities item
  const addFacilityItem = () => {
    setFacilitiesContent([...facilitiesContent, { image: '', heading: '', content: '' }]);
  };

  // Function to remove a facility item
  const removeFacilityItem = (index) => {
    setFacilitiesContent(facilitiesContent.filter((_, idx) => idx !== index));
  };

  // Function to add a new testimonial item
  const addTestimonialItem = () => {
    setTestimonialContent([...testimonialContent, { text: '', image: '' }]);
  };

  // Function to remove a testimonial item
  const removeTestimonialItem = (index) => {
    setTestimonialContent(testimonialContent.filter((_, idx) => idx !== index));
  };

  // Function to add a new gallery item
  const addGalleryItem = () => {
    setGalleryContent([...galleryContent, { image: '', content: '' }]);
  };

  // Function to remove a gallery item
  const removeGalleryItem = (index) => {
    setGalleryContent(galleryContent.filter((_, idx) => idx !== index));
  };

  // Resolves a setting-bucket image: seeded /site/* paths and absolute URLs
  // are used as-is, a bare filename still comes from the public setting bucket.
  const getPublicUrl = (file) => {
    if (!file) return '';
    const value = String(file);
    if (value.startsWith('/') || /^https?:\/\//i.test(value)) return value;
    return 'https://BLUEBELL_SUPABASE_REF_PLACEHOLDER.supabase.co/storage/v1/object/public/setting//'.replace(/\/+$/, '/') + value;
  };

  // Function to update class fees
  const updateClassFee = (className, newFee) => {
    setClassFees(prevFees => 
      prevFees.map(fee => 
        fee.class_name === className 
          ? { ...fee, next_term_fees: newFee === '' ? 0 : parseFloat(newFee) || 0 } 
          : fee
      )
    );
  };

  // ---------- Profile: signed-in admin account ----------
  // Reflect the current auth user's metadata into the profile form once known.
  useEffect(() => {
    if (user) {
      setProfileName(user.user_metadata?.full_name || '');
      setProfilePic(user.user_metadata?.avatar_url || '');
    }
  }, [user]);

  // Upload to the public `setting` bucket, then persist the URL on the auth
  // user's metadata (client-side, works with the anon key for the signed-in user).
  const uploadProfilePic = async (file) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.warn('Please choose an image file'); return; }
    setPicBusy(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `profiles/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('setting').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('setting').getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: uErr } = await supabase.auth.updateUser({ data: { avatar_url: url } });
      if (uErr) throw uErr;
      setProfilePic(url);
      const { data: fresh } = await supabase.auth.getUser();
      if (fresh.user) setUser(fresh.user);
      logAction(supabase, { email: user?.user_metadata?.email, role: 'admin', action: 'profile_pic_update', targetTable: 'auth', details: {} });
      toast.success('Profile photo updated');
    } catch (e) {
      console.error('Profile photo update failed:', e);
      toast.error('Could not update photo: ' + (e.message || e));
    } finally {
      setPicBusy(false);
    }
  };

  const saveProfileName = async () => {
    const name = profileName.trim();
    if (!name) { toast.warn('Enter your name first'); return; }
    setNameBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
      if (error) throw error;
      const { data: fresh } = await supabase.auth.getUser();
      if (fresh.user) setUser(fresh.user);
      logAction(supabase, { email: user?.user_metadata?.email, role: 'admin', action: 'profile_name_update', targetTable: 'auth', details: { full_name: name } });
      toast.success('Name updated');
    } catch (e) {
      console.error('Name update failed:', e);
      toast.error('Could not update name: ' + (e.message || e));
    } finally {
      setNameBusy(false);
    }
  };

  const changePassword = async () => {
    if (pw.next.length < 6) { toast.warn('Password must be at least 6 characters'); return; }
    if (pw.next !== pw.confirm) { toast.error('Passwords do not match'); return; }
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw error;
      logAction(supabase, { email: user?.user_metadata?.email, role: 'admin', action: 'profile_password_change', targetTable: 'auth', details: {} });
      setPw({ next: '', confirm: '' });
      toast.success('Password updated. Use it the next time you sign in.');
    } catch (e) {
      console.error('Password update failed:', e);
      toast.error('Could not update password: ' + (e.message || e));
    } finally {
      setPwBusy(false);
    }
  };

  const TABS = [
    { id: 'general', label: 'General', icon: <RiSettings3Line /> },
    // Academic Session management now lives on the dedicated /session_tools page (Session Tools → Academic Session).
    { id: 'fees', label: 'Fees', icon: <RiMoneyDollarCircleLine /> },
    { id: 'website', label: 'Website', icon: <RiGlobalLine /> },
    { id: 'profile', label: 'Profile', icon: <RiUserLine /> },
  ];

  return (
    <div className="settings-container">
      <div className="settings-card">
        {(userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email)) ? (
          <div>
            {/* <NavbarComponent /> */}
                  <ToastContainer />
              <h1 className="settings-heading">Settings</h1>

              {/* Tab navigation */}
              <div className="settings-tabs" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    aria-selected={activeTab === t.id}
                    className={`settings-tab${activeTab === t.id ? ' active' : ''}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Profile tab — signed-in admin account */}
              {activeTab === 'profile' && (
              <div className="settings-section">
                <h2 className="settings-subheading"><RiUserLine /> My Profile</h2>
                <p>Manage your account photo, display name and sign-in password.</p>
                <div className="profile-grid">
                  <div className="profile-card profile-identity">
                    <div className={`settings-avatar${picBusy ? ' busy' : ''}`}>
                      {profilePic
                        ? <img src={profilePic} alt="Profile" />
                        : (profileName.trim() ? profileName.trim().charAt(0).toUpperCase() : <RiUserLine />)}
                    </div>
                    <div className="profile-name">{profileName || 'Administrator'}</div>
                    <div className="profile-email">{user?.user_metadata?.email}</div>
                    <div className="profile-actions">
                      <label className="profile-btn" style={{ cursor: picBusy ? 'progress' : 'pointer' }}>
                        <RiCameraLine /> {picBusy ? 'Uploading…' : 'Change photo'}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          disabled={picBusy}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProfilePic(f); e.target.value = ''; }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="profile-card">
                    <div className="profile-field">
                      <label>Display name</label>
                      <input className="settings-input" type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Your full name" />
                    </div>
                    <button type="button" className="profile-btn primary" style={{ width: 'auto' }} onClick={saveProfileName} disabled={nameBusy}>
                      <RiSaveLine /> {nameBusy ? 'Saving…' : 'Save name'}
                    </button>

                    <div className="profile-divider" />

                    <div className="profile-field">
                      <label>New password</label>
                      <input className="settings-input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} placeholder="At least 6 characters" />
                    </div>
                    <div className="profile-field">
                      <label>Confirm new password</label>
                      <input className="settings-input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} placeholder="Re-enter new password" />
                    </div>
                    <p className="profile-hint">You must be signed in to change your password — the new one takes effect next time you sign in.</p>
                    <button type="button" className="profile-btn primary" style={{ width: 'auto' }} onClick={changePassword} disabled={pwBusy || !pw.next}>
                      <RiLockLine /> {pwBusy ? 'Updating…' : 'Update password'}
                    </button>
                  </div>
                </div>
              </div>
              )}

              {/* General Settings Input Fields (Session, Term, Next Term Begins, Fees, School Opened) */}
              {activeTab === 'general' && (
              <div className="settings-section">
              <h2 className="settings-subheading">General Settings</h2>
              <div className="settings-input-group">
                  <label>Session:</label>
                  <input
                    type="text"
                    placeholder="Session"
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                  className="settings-input"
                  />
                </div>
                <div className="settings-input-group">
                  <label>Term:</label>
                  <input
                    type="text"
                    placeholder="Term"
                    value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="settings-input"
                  />
              </div>
                <div className="settings-input-group">
                  <label>School Opened Days:</label>
                  <input
                    type="number"
                    placeholder="School Opened"
                    value={schoolOpened}
                    onChange={(e) => setSchoolOpened(Number(e.target.value))}
                  className="settings-input"
                  />
              </div>
              <div>
                <label htmlFor="checkResult">Check Result Date:</label>
                <input
                  type="date"
                  id="checkResult"
                  value={checkResult}
                  onChange={(e) => setCheckResult(e.target.value)}
                />
              </div>
                <div className="settings-input-group">
                  <label>Next Term Begins:</label>
                  <input
                    type="text"
                    placeholder="Next Term Begins"
                    value={nextTermBegins}
                  onChange={(e) => setNextTermBegins(e.target.value)}
                  className="settings-input"
                  />
                </div>
                {/* <div className="settings-input-group">
                  <label>Next Term Fees:</label>
                  <input
                    type="number"
                    placeholder="Next Term Fees"
                    value={nextTermFees}
                    onChange={(e) => setNextTermFees(Number(e.target.value))}
                  className="settings-input"
                  />
                </div> */}
                <div className="settings-input-group">
                  <label>Admin Email:</label>
                  <input
                    type="email"
                    placeholder="Admin Email for Notifications"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="settings-input"
                  />
                </div>
               <div className="settings-input-group">
                <label>CBT Exam Password:</label>
                <div className="password-input-container">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="CBT Exam Password"
                    value={cbtPassword}
                    onChange={(e) => setCbtPassword(e.target.value)}
                    className="settings-input"
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {devAuth && devAuth.some && devAuth.some((auth) => auth.email === user?.user_metadata?.email) && (
                <div className="lock-result-group">
                  <div className="lock-result-text">
                    <span className="lock-result-title"><RiLockLine /> Lock Result</span>
                    <span className="lock-result-desc">When locked, students cannot view their results.</span>
                  </div>
                  <label className="lock-toggle" htmlFor="lockResultSwitch" title={lockResult ? 'Results are locked — click to unlock' : 'Results are open — click to lock'}>
                    <input
                      type="checkbox"
                      id="lockResultSwitch"
                      className="lock-toggle-input"
                      checked={lockResult}
                      onChange={async () => {
                        try {
                          const newLockResult = !lockResult; // Toggle the value
                          setLockResult(newLockResult); // Update state

                          // Save the updated value to Supabase
                          const { error } = await supabase
                            .from('bluebell_settings')
                            .update({ lockResult: newLockResult })
                            .eq('user_id', user.id);

                          if (error) throw error;

                          toast.success(`Result ${newLockResult ? 'locked' : 'unlocked'}`);
                        } catch (err) {
                          console.error('Error updating lock result:', err);
                          toast.error('Failed to update lock result. Please try again.');
                        }
                      }}
                    />
                    <span className="lock-toggle-track" aria-hidden="true">
                      <span className="lock-toggle-thumb">
                        {lockResult ? <RiLockLine /> : <RiLockUnlockLine />}
                      </span>
                    </span>
                    <span className={`lock-toggle-state ${lockResult ? 'on' : 'off'}`}>
                      {lockResult ? 'Locked' : 'Unlocked'}
                    </span>
                  </label>
                </div>
              )}

              {userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email) ? (
              <button onClick={handleSave} className="btn-save" disabled={loading}>
        {loading ? 'Loading...' : 'Save Changes'}
                  </button>
                  ) : (
                                    <button className="btn" disabled>Only For Admins</button>
                                )}
              </div>
              )}

              {/* Academic Session Manager (Start New Session rollover, session history correction, term switch) has moved to the dedicated /session_tools page (Session Tools → Academic Session). */}
              
              {/* Class-Specific Fees Section */}
              {activeTab === 'fees' && (
              <div className="settings-section">
                <h2 className="settings-subheading">Class-Specific Next Term Fees</h2>
                <p>Set different fees for each class level:</p>
                <div className="class-fees-container">
                  {classFees && classFees.length > 0 ? (
                    classFees.map((fee, index) => (
                      <div key={index} className="class-fee-item">
                        <label>{fee.class_name}:</label>
                        <input
                          type="number"
                          value={fee.next_term_fees || 0}
                          onChange={(e) => updateClassFee(fee.class_name, e.target.value)}
                          className="settings-input"
                          placeholder="Fee amount"
                        />
                      </div>
                    ))
                  ) : (
                    <p>No class fees configured yet.</p>
                  )}
                </div>
                <button onClick={handleSave} className="btn-save" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
              )}

              {/* Website content (Hero, About, Facilities, Gallery, Testimonials, Contact) */}
              {activeTab === 'website' && (
              <>
              
 {/* Hero Section */}
<div className="settings-section">
              <h2 className="settings-subheading">Hero Section</h2>            
              {(heroContent && Array.isArray(heroContent) ? heroContent : []).map((item, index) => (
              <div key={index}>
                <input
                  type="file"
                  accept="image/*"
                      className="settings-input"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        setHeroContent(
                          heroContent.map((i, idx) =>
                            idx === index ? { ...i, image: reader.result } : i
                          )
                        );
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {item.image ? <img src={getPublicUrl(item.image)} alt="Preview" className='preview-image' /> : null }
                <input
                  type="text"
                  placeholder="Heading"
                  value={item.heading}
                  onChange={(e) =>
                    setHeroContent(
                      heroContent.map((i, idx) =>
                        idx === index ? { ...i, heading: e.target.value } : i
                      )
                    )
                  }
                    className='settings-input'
                />
                <textarea
                  placeholder="Content"
                  value={item.content}
                    className='settings-input'
                  onChange={(e) =>
                    setHeroContent(
                      heroContent.map((i, idx) =>
                        idx === index ? { ...i, content: e.target.value } : i
                      )
                    )
                  }
                />
                <button onClick={() => removeHeroItem(index)} className='btn-remove'>Remove</button>
              </div>
              ))}
              <div style={{display: 'flex', justifyContent: 'left', gap: '10px', flexDirection: 'column'}}>
              <button onClick={addHeroItem} className='btn btn-primary'>Add Hero Item</button>
            {userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email) ? (
              <button onClick={handleSave} className="btn-save" disabled={loading}>
        {loading ? 'Loading...' : 'Save Changes'}
                  </button>
                  ) : (
                                    <button className="btn" disabled>Only For Admins</button>
                                )}
                </div>
              </div>


              {/* About Section */}
          <div className="settings-section">
              <h2 className="settings-subheading">About Content</h2>
              <label className="settings-label">Our Mission section:</label>
           <input
            type="text"
            placeholder="Mission Note"
                    className="settings-input"
            value={aboutContent.text}
            onChange={(e) => setAboutContent({ ...aboutContent, text: e.target.value })}
          />
              <label className="settings-label">Ending note section:</label>
          <input
            type="text"
            placeholder="Ending about note"
                    className="settings-input"
            value={aboutContent.text2}
            onChange={(e) => setAboutContent({ ...aboutContent, text2: e.target.value })}
          />
              <label className="settings-label">Why Choose Us section:</label>
            <div className="details-list">
              {(aboutContent?.details && Array.isArray(aboutContent.details) ? aboutContent.details : []).map((detail, index) => (
                <div key={index} className="detail-item">
                  <input
                    type="text"
                    placeholder="Detail Heading"
                    className="settings-input"
                    value={detail.heading}
                    onChange={(e) => {
                      const newDetails = [...aboutContent.details];
                      newDetails[index].heading = e.target.value;
                      setAboutContent({ ...aboutContent, details: newDetails });
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Detail Content"
                    className="settings-input"
                    value={detail.content}
                    onChange={(e) => {
                      const newDetails = [...aboutContent.details];
                      newDetails[index].content = e.target.value;
                      setAboutContent({ ...aboutContent, details: newDetails });
                    }}
                  />
                  <button onClick={() => handleRemoveDetail(index)} className='btn-remove'>Remove</button>
                </div>
              ))}
            </div>
              <div>
              <div style={{display: 'flex', justifyContent: 'left', gap: '10px', flexDirection: 'column'}}>
              <button onClick={handleAddDetail} className='btn btn-primary'>Add Detail Item</button></div>

              {userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email) ? (
              <button onClick={handleSave} className="btn-save" disabled={loading}>
        {loading ? 'Loading...' : 'Save Changes'}
                  </button>
                  ) : (
                                    <button className="btn" disabled>Only For Admins</button>
                                )}
                                </div>
          </div>

             {/* Facilities Section */}
<div className="settings-section">
              <h2 className="settings-subheading">Facilities Section</h2>
              {(facilitiesContent && Array.isArray(facilitiesContent) ? facilitiesContent : []).map((facility, index) => (
                <div key={index} className="settings-item">
                  <input
                    type="file"
                    accept="image/*"
                    className="settings-input"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setFacilitiesContent(
                            (facilitiesContent && Array.isArray(facilitiesContent) ? facilitiesContent : []).map((item, idx) =>
                              idx === index ? { ...item, image: reader.result } : item
                            )
                          );
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                {facility.image ? <img src={getPublicUrl(facility.image)} alt="Preview" className="preview-image" /> : null }
                  <input
                    type="text"
                    placeholder="Heading"
                    value={facility.heading}
                    className="settings-input"
                    onChange={(e) =>
                      setFacilitiesContent(
                        (facilitiesContent && Array.isArray(facilitiesContent) ? facilitiesContent : []).map((item, idx) =>
                          idx === index ? { ...item, heading: e.target.value } : item
                        )
                      )
                    }
                  />
                  <textarea
                    placeholder="Content"
                    value={facility.content}
                    className="settings-input"
                    onChange={(e) =>
                      setFacilitiesContent(
                        (facilitiesContent && Array.isArray(facilitiesContent) ? facilitiesContent : []).map((item, idx) =>
                          idx === index ? { ...item, content: e.target.value } : item
                        )
                      )
                    }
                  />
                  <button
                    onClick={() => removeFacilityItem(index)}
                    className="btn-remove"
                    style={{ marginTop: '5px' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              
              <div style={{display: 'flex', justifyContent: 'left', gap: '10px', flexDirection: 'column'}}>
              <button
                onClick={addFacilityItem}
                className="btn btn-primary"
                style={{ marginTop: '10px' }}
              >
                Add Facility Item
              </button>

              {userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email) ? (
              <button onClick={handleSave} className="btn-save" disabled={loading}>
        {loading ? 'Loading...' : 'Save Changes'}
                  </button>
                  ) : (
                                    <button className="btn" disabled>Only For Admins</button>
                                )}
                </div>
              </div>

               {/* Gallery Section */}
<div className="settings-section">
              <h2 className="settings-subheading">Gallery Section</h2>
              {(galleryContent && Array.isArray(galleryContent) ? galleryContent : []).map((item, index) => (
                <div key={index} className="settings-item">
                  <input
                    type="file"
                    accept="image/*"
                    className="settings-input"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setGalleryContent(
                            (galleryContent && Array.isArray(galleryContent) ? galleryContent : []).map((galleryItem, idx) =>
                              idx === index ? { ...galleryItem, image: reader.result } : galleryItem
                            )
                          );
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />                {item.image ? <img src={getPublicUrl(item.image)} alt="Preview" className='preview-image' /> : null }
                  <textarea
                    placeholder="Content"
                    value={item.content}
                    className="settings-input"
                    onChange={(e) =>
                      setGalleryContent(
                        (galleryContent && Array.isArray(galleryContent) ? galleryContent : []).map((galleryItem, idx) =>
                          idx === index ? { ...galleryItem, content: e.target.value } : galleryItem
                        )
                      )
                    }
                  />
                  <button
                    onClick={() => removeGalleryItem(index)}
                    className="btn-remove"
                    style={{ marginTop: '5px' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              
              <div style={{display: 'flex', justifyContent: 'left', gap: '10px', flexDirection: 'column'}}>
              <button onClick={addGalleryItem} className="btn btn-primary" style={{ marginTop: '10px' }}>
                Add Gallery Item
              </button>

              {userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email) ? (
              <button onClick={handleSave} className="btn-save" disabled={loading}>
        {loading ? 'Loading...' : 'Save Changes'}
                  </button>
                  ) : (
                                    <button className="btn" disabled>Only For Admins</button>
                                )}
            </div>
          </div>

              {/* Testimonial Section */}
<div className="settings-section">
              <h2 className="settings-subheading">Testimonials Settings</h2>
              {(testimonialContent && Array.isArray(testimonialContent) ? testimonialContent : []).map((testimonial, index) => (
                <div key={index} className="settings-item">
                  <textarea
                    placeholder="Testimonial Text"
                    value={testimonial.text}
                  className="settings-input"
                    onChange={(e) =>
                      setTestimonialContent(
                        (testimonialContent && Array.isArray(testimonialContent) ? testimonialContent : []).map((item, idx) =>
                          idx === index ? { ...item, text: e.target.value } : item
                        )
                      )
                    }
                  />
                {testimonial.image ? <img src={getPublicUrl(testimonial.image)} alt="Preview" className="preview-image" /> : null }
                  <input
                    type="file"
                    accept="image/*"
                  className="settings-input"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setTestimonialContent(
                            (testimonialContent && Array.isArray(testimonialContent) ? testimonialContent : []).map((item, idx) =>
                              idx === index ? { ...item, image: reader.result } : item
                            )
                          );
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <button
                    onClick={() => removeTestimonialItem(index)}
                    className="btn-remove"
                    style={{ marginTop: '5px' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              
              <div style={{display: 'flex', justifyContent: 'left', gap: '10px', flexDirection: 'column'}}>
              <button
                onClick={addTestimonialItem}
                className="btn btn-primary"
                style={{ marginTop: '10px' }}
              >
                Add Testimonial Item
              </button>

{userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email) ? (
              <button onClick={handleSave} className="btn-save" disabled={loading}>
        {loading ? 'Loading...' : 'Save Changes'}
                  </button>
                  ) : (
                                    <button className="btn" disabled>Only For Admins</button>
                                )}         </div>
</div>
              {/* Contact Section */}
<div className="settings-section">
                <h2 className="settings-subheading">Contact Section</h2>
                <input
                type="email"
                placeholder="Email"
                value={contactContent.email}
                    className="settings-input"
                onChange={(e) =>
                  setContactContent({ ...contactContent, email: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Phone"
                value={contactContent.phone}
                    className="settings-input"
                onChange={(e) =>
                  setContactContent({ ...contactContent, phone: e.target.value })
                }
              />
              <textarea
                placeholder="Address"
                value={contactContent.address}
                className="settings-input"
                onChange={(e) =>
                  setContactContent({ ...contactContent, address: e.target.value })
                }
              />
            </div>
            {/* Save Button */}
            {userauth && userauth.some && userauth.some(auth => auth.email === user?.user_metadata?.email) ? (
              <button onClick={handleSave} className="btn-save" disabled={loading}>
                {loading ? 'Loading...' : 'Save Changes'}
              </button>
            ) : (
              <button className="btn" disabled>Only For Admins</button>
            )}
              </>
              )}
          </div>
        ) : (
          <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#f0f2f5',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              // width: '60%',
              padding: '40px',
              backgroundColor: 'var(--card-bg, #fff)',
              borderRadius: '10px',
              boxShadow: '0 4px 8px var(--shadow-color, rgba(0, 0, 0, 0.1))',
              textAlign: 'center',
            }}
          >
            <h1 style={{ marginBottom: '20px', color: '#333' }}>
              User not authorised
            </h1>
            <p style={{ marginBottom: '40px', color: 'red' }}>
              Please login with proper credentials or check your internet connection.
            </p>
            <button
              onClick={() => {
                if (isRouterAvailable) {
                  router.push('/login');
                } else {
                  // Fallback to window.location for cases where router is not available
                  window.location.href = '/login';
                }
              }}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                borderRadius: '5px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }}
            >
              Go to Login
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default Setting;
