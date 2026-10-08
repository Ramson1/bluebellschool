"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import SideNav from "../src/components/SideNav";
import BottomNav from "../src/components/BottomNav";
import { supabase } from "../src/supabaseClient";
import UnauthorizedModal from "../src/components/UnauthorizedModal";
import { fetchAuthRoles, isAdmin, isDev, isSecretary, OWNER_EMAIL } from "../src/utils/authUtils";
import 'bootstrap/dist/css/bootstrap.min.css';

const SIDEBAR_WIDTH_EXPANDED = 252; // keep in sync with SideNav.jsx
const SIDEBAR_WIDTH_COLLAPSED = 76; // keep in sync with SideNav.jsx

// Routes the secretary is allowed to open. Everything else bounces back to
// the read-only view — individual pages also carry their own admin checks.
const SECRETARY_ALLOWED_PATHS = ["/secretary", "/attendance"];

const isAuthorizedSecretaryPath = (path: string | null) =>
  !!path && SECRETARY_ALLOWED_PATHS.some((p) => path.startsWith(p));

interface UserAuth {
  email: string;
}

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userAuth, setUserAuth] = useState<UserAuth[]>([]);
  const [teacherAuth, setTeacherAuth] = useState<UserAuth[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isDevUser, setIsDevUser] = useState(false);
  const [isSecretaryUser, setIsSecretaryUser] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  // Reactive mobile detection — follows window resizes so the sidebar and the
  // content offset always match (a one-off innerWidth check could leave page
  // content sitting under the fixed sidebar after a resize).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    // Safari < 14 fallback
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

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

        // Admin dashboard lockdown: only admin (jmis_userauth), developer
        // (devauth + hard-coded fallback) and the secretary (jmis_secretaryauth)
        // may enter. Teachers are no longer admitted — the Staff Portal
        // (separate project) is their home. fetchAuthRoles tolerates the
        // secretary table missing until the SQL migration has been run.
        const email = currentUser?.user_metadata?.email;
        const roles = await fetchAuthRoles(supabase);
        setUserAuth(roles.adminEmails.map((e: string) => ({ email: e })));
        setTeacherAuth(roles.teacherEmails.map((e: string) => ({ email: e })));

        const admin = isAdmin(email, roles.adminEmails) || isDev(email, roles.devEmails);
        const dev = isDev(email, roles.devEmails);
        const secretary = !admin && isSecretary(email, roles.secretaryEmails);

        setIsTeacher(admin || secretary ? false : !!email && roles.teacherEmails.includes(email));
        setIsAdminUser(admin);
        setIsDevUser(dev);
        setIsSecretaryUser(secretary);
        setIsAuthorized(admin || secretary);
      } catch (error) {
        console.error('Error checking authorization:', error);
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuthorization();
  }, []);

  // Secretaries must not browse admin routes by typing a URL — bounce them
  // back to their read-only view.
  const router = useRouter();
  useEffect(() => {
    if (!loading && isSecretaryUser && !isAuthorizedSecretaryPath(pathname)) {
      router.replace("/secretary");
    }
  }, [loading, isSecretaryUser, pathname, router]);

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

  // Ultimate super_admin (owner) — gates the Roles & Access mobile entry.
  const isOwner = !!user &&
    ((user.user_metadata?.email || user.email || "").toLowerCase() === OWNER_EMAIL.toLowerCase());

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {!isMobile && (
        <aside
          style={{
            width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
            // never shrink: guarantees the main content starts beside the
            // fixed sidebar instead of sliding underneath it
            flex: "0 0 auto",
            transition: "width 0.2s",
          }}
        >
          <SideNav collapsed={collapsed} setCollapsed={setCollapsed} />
        </aside>
      )}
      <main
        style={{
          flex: 1,
          // allow shrinking below intrinsic content width so wide children
          // (tables) scroll inside their own containers, never under the nav
          minWidth: 0,
          padding: 24,
          transition: "margin-left 0.2s",
          minHeight: "100vh",
          marginBottom: isMobile ? 70 : 0, // space for bottom nav
        }}
      >
        {children}
      </main>
      {isMobile && <BottomNav isDev={isDevUser} isSecretary={isSecretaryUser} isOwner={isOwner} />}
    </div>
  );
};

export default AdminLayout;