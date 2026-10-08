import React, { useState, useEffect } from "react";
import SideNav from "../components/SideNav";
import BottomNav from "../components/BottomNav";
import { supabase } from "../supabaseClient";
import UnauthorizedModal from "../components/UnauthorizedModal";

const SIDEBAR_WIDTH_EXPANDED = 252; // keep in sync with SideNav.jsx
const SIDEBAR_WIDTH_COLLAPSED = 76; // keep in sync with SideNav.jsx

const AdminLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const [userAuth, setUserAuth] = useState([]);
  const [teacherAuth, setTeacherAuth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isTeacherUser, setIsTeacherUser] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Detect mobile device (simple approach)
  const isMobile = window.innerWidth <= 768;

  useEffect(() => {
    const checkAuthorization = async () => {
      try {
        // Get current user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) {
          setIsAuthorized(false);
          setLoading(false);
          return;
        }
        
        setUser(currentUser);
        
        // Fetch user authorization data
        const { data: userData, error: userError } = await supabase
          .from('bluebell_userauth')
          .select('email');
        
        if (userError) throw userError;
        setUserAuth(userData || []);
        
        // Fetch teacher authorization data
        const { data: teacherData, error: teacherError } = await supabase
          .from('bluebell_teacherauth')
          .select('email');
        
        if (teacherError) throw teacherError;
        setTeacherAuth(teacherData || []);
        
        // Check if user is authorized (either admin or teacher)
        const isTeacher = teacherData && teacherData.some(auth => auth.email === currentUser?.user_metadata?.email);
        const isAdmin = userData && userData.some(auth => auth.email === currentUser?.user_metadata?.email);
        
        setIsTeacherUser(isTeacher);
        setIsAdminUser(isAdmin);
        
        // User is authorized if they are either an admin or a teacher
        setIsAuthorized(isTeacher || isAdmin);
      } catch (error) {
        console.error('Error checking authorization:', error);
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuthorization();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem',
        flexDirection: 'column'
      }}>
        <div className="spinner-border" role="status" style={{ width: '3rem', height: '3rem', marginBottom: '1rem' }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <div>Verifying credentials...</div>
      </div>
    );
  }

  // If user is not authorized (not a teacher and not in userauth), show the unauthorized modal
  if (!isAuthorized) {
    return <UnauthorizedModal />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {!isMobile && (
        <aside
          style={{
            width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
            transition: "width 0.2s",
          }}
        >
          <SideNav collapsed={collapsed} setCollapsed={setCollapsed} />
        </aside>
      )}
      <main
        style={{
          flex: 1,
          padding: 24,
          transition: "margin-left 0.2s",
          minHeight: "100vh",
          marginBottom: isMobile ? 70 : 0, // space for bottom nav,
        }}
      >
        {children}
      </main>
      {isMobile && <BottomNav isTeacher={isTeacherUser} isAdmin={isAdminUser} />}
    </div>
  );
};

export default AdminLayout;