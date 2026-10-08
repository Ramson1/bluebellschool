import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../supabaseClient';

const ProtectedRoute = ({ children, allowedRoles = ['admin'] }) => {
  const [user, setUser] = useState(null);
  const [userAuth, setUserAuth] = useState([]);
  const [teacherAuth, setTeacherAuth] = useState([]);
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

  useEffect(() => {
    const checkUser = async () => {
      try {
        // Get current user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) {
          if (isRouterAvailable) {
            router.push('/login');
          } else {
            // Fallback to window.location for cases where router is not available
            window.location.href = '/login';
          }
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
        
        // Check user roles
        const isTeacher = teacherData && teacherData.some(auth => auth.email === currentUser?.user_metadata?.email);
        const isAdmin = userData && userData.some(auth => auth.email === currentUser?.user_metadata?.email);
        
        // Check if user has required role
        const hasRequiredRole = allowedRoles.some(role => {
          if (role === 'admin' && isAdmin) return true;
          if (role === 'teacher' && isTeacher) return true;
          return false;
        });
        
        if (!hasRequiredRole) {
          // Redirect to home/dashboard if user doesn't have required role
          if (isRouterAvailable) {
            router.push('/home');
          } else {
            // Fallback to window.location for cases where router is not available
            window.location.href = '/home';
          }
        }
      } catch (error) {
        console.error('Error checking user authorization:', error);
        // Still show loading indicator instead of immediately redirecting
        setTimeout(() => {
          if (isRouterAvailable) {
            router.push('/login');
          } else {
            // Fallback to window.location for cases where router is not available
            window.location.href = '/login';
          }
        }, 2000); // Give user time to see the loading indicator
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();
  }, [navigate, allowedRoles]);

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

  return children;
};

export default ProtectedRoute;