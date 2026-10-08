import "bootstrap/dist/css/bootstrap.min.css";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../supabaseClient";
import { DEV_EMAILS, OWNER_EMAIL } from "../utils/authUtils";
// Vector icon set (Remix Line) — consistent single-family icons
import {
  RiDashboardLine,
  RiCalendarCheckLine,
  RiMoneyDollarCircleLine,
  RiUserAddLine,
  RiWallet3Line,
  RiBillLine,
  RiSchoolLine,
  RiBankLine,
  RiArchiveStackLine,
  RiContactsBookLine,
  RiSettings4Line,
  RiComputerLine,
  RiBarChart2Line,
  RiBriefcaseLine,
  RiDatabase2Line,
  RiShieldCheckLine,
  RiShieldUserLine,
  RiShieldKeyholeLine,
  RiRocketLine,
  RiTeamLine,
  RiCustomerService2Line,
  RiExternalLinkLine,
  RiIdCardLine,
  RiLogoutBoxRLine,
  RiMenuFoldLine,
  RiMenuUnfoldLine,
  RiSunLine,
  RiMoonLine,
  RiMessage2Line,
  RiDraftLine,
  RiBookOpenLine,
  RiFileTextLine,
} from "react-icons/ri";
import { getEffectiveTheme, toggleTheme } from "../utils/theme";

const SIDEBAR_WIDTH_EXPANDED = 252;
const SIDEBAR_WIDTH_COLLAPSED = 76;

// Single nav entry: vector icon + label (icon-only, centered, when collapsed)
const NavItem = ({ href, icon: Icon, label, active, collapsed }) => (
  <li>
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={
        "sidenav-link" +
        (active ? " active" : "") +
        (collapsed ? " sidenav-link--collapsed" : "")
      }
    >
      <span className="sidenav-icon">
        <Icon />
      </span>
      {!collapsed && <span className="sidenav-label">{label}</span>}
    </Link>
  </li>
);

// Section heading; collapses to a subtle divider to keep spacing even
const SectionTitle = ({ title, collapsed }) =>
  collapsed ? (
    <li className="sidenav-divider" aria-hidden="true" />
  ) : (
    <li className="sidenav-section-title">{title}</li>
  );

const SideNav = ({ collapsed, setCollapsed }) => {
  const [userauth, setUserAuth] = useState([]);
  const [teacherAuth, setTeacherAuth] = useState([]);
  const [devAuth, setDevAuth] = useState([]);
  const [secretaryAuth, setSecretaryAuth] = useState([]);
  const [user, setUser] = useState();
  const [loading, setLoading] = useState(true); // Add loading state
  const [theme, setThemeUI] = useState("light"); // dark/light toggle (src/utils/theme.js)

  // Sync the toggle button icon with the theme applied by the init script
  useEffect(() => {
    setThemeUI(getEffectiveTheme());
  }, []);

  // Safely initialize router
  let router;
  let isRouterAvailable = false;
  
  try {
    router = useRouter();
    isRouterAvailable = router && router.push;
  } catch (error) {
    console.warn('NextRouter not available in this context');
  }

  const signOutUser = async () => {
    await supabase.auth.signOut();
    if (isRouterAvailable) {
      router.push("/login");
    } else {
      // Fallback to window.location for cases where router is not available
      window.location.href = "/login";
    }
  };

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
        
        // Fetch all required data in parallel (devauth/secretaryauth failures are
        // tolerated – tables may not exist yet; the Supabase builder is a thenable
        // without .catch, so wrap it in a real Promise)
        const [userData, teacherData, devData, secretaryData] = await Promise.all([
          supabase.from('jmis_userauth').select('email'),
          supabase.from('jmis_teacherauth').select('email'),
          Promise.resolve(supabase.from('devauth').select('email')).catch(() => ({ data: [], error: null })),
          Promise.resolve(supabase.from('jmis_secretaryauth').select('email')).catch(() => ({ data: [], error: null }))
        ]);
        
        // Handle user auth data
        if (userData.error) throw userData.error;
        setUserAuth(userData.data || []);
        
        // Handle teacher auth data
        if (teacherData.error) throw teacherData.error;
        setTeacherAuth(teacherData.data || []);

        // Handle dev auth data (never fatal)
        if (!devData || devData.error) {
          setDevAuth([]);
        } else {
          setDevAuth(devData.data || []);
        }

        // Handle secretary auth data (never fatal)
        if (!secretaryData || secretaryData.error) {
          setSecretaryAuth([]);
        } else {
          setSecretaryAuth(secretaryData.data || []);
        }
      } catch (error) {
        console.error('Error initializing data:', error);
      } finally {
        // Only set loading to false after all verification is complete
        setLoading(false);
      }
    };
    
    initializeData();
  }, []);

  // Role helpers for the new feature pages
  const userEmail = user?.user_metadata?.email;
  const isAdminUser = !!(userauth && userauth.some && userauth.some(auth => auth.email === userEmail));
  const isDevUser = !!(
    DEV_EMAILS.includes((userEmail || "").toLowerCase()) ||
    DEV_EMAILS.includes((user?.email || "").toLowerCase()) ||
    (devAuth && devAuth.some && (devAuth.some(auth => auth.email === userEmail) || devAuth.some(auth => auth.email === user?.email)))
  );
  // Staff attendance / data tools / audit logs: admin + developer only
  const canManageStaff = isAdminUser || isDevUser;
  // Ultimate super_admin (owner) only — the Roles & Access surface
  const isOwnerUser = !!(
    (userEmail || "").toLowerCase() === OWNER_EMAIL.toLowerCase() ||
    (user?.email || "").toLowerCase() === OWNER_EMAIL.toLowerCase()
  );
  // Secretary: read-only view only — never the admin toolset
  const isSecretaryUser = !isAdminUser && !isDevUser && !!(
    secretaryAuth && secretaryAuth.some && secretaryAuth.some(auth => (auth.email || "").toLowerCase() === (userEmail || "").toLowerCase())
  );
  
  // Helper for active link styling
  const isActive = (path) => {
    if (!isRouterAvailable) return false;
    return router.pathname === path;
  };

  const goHome = () => {
    if (isRouterAvailable) {
      router.push("/home");
    } else {
      window.location.href = "/home";
    }
  };

  // Show loading indicator while verifying credentials
  if (loading) {
    return (
      <div
        style={{
          width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
          minHeight: "100vh",
          background: "var(--snav-bg)",
          color: "var(--snav-link)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: 1000,
          transition: "width 0.2s ease"
        }}
      >
        <div className="spinner-border" role="status" style={{ width: '2rem', height: '2rem' }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        {!collapsed && (
          <div style={{ marginTop: '12px', fontSize: '0.85rem', letterSpacing: '0.4px' }}>
            Verifying...
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
        minHeight: "100vh",
        background: "var(--snav-bg)",
        color: "var(--snav-fg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        padding: 0,
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 1000,
        borderRight: "1px solid var(--snav-border)",
        boxShadow: "var(--snav-shadow)",
        transition: "width 0.2s ease"
      }}
    >
      {/* Top section: logo / school name and collapse toggle */}
      <div
        style={{
          display: "flex",
          flexDirection: collapsed ? "column" : "row",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: collapsed ? 6 : 0,
          padding: collapsed ? "16px 0 12px" : "16px 14px 16px 16px",
          borderBottom: "1px solid var(--snav-border)",
          minHeight: 72,
        }}
      >
        <div
          onClick={goHome}
          title="Go to dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            minWidth: 0,
          }}
        >
          <img
            src="/logo.jpg"
            alt="School Logo"
            style={{
              width: 38,
              height: 38,
              flex: "0 0 auto",
              objectFit: "cover",
              display: "block",
              borderRadius: "50%",
              border: "1px solid var(--snav-logo-border)",
            }}
            onError={(e) => {
              console.error('Logo failed to load:', e);
            }}
          />
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: "var(--snav-heading)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  lineHeight: 1.25,
                }}
              >
                Bluebell
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--snav-muted)",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                }}
              >
                International School
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="sidenav-toggle"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <RiMenuUnfoldLine /> : <RiMenuFoldLine />}
        </button>
      </div>

      {/* Scrollable nav section */}
      <nav
        className="sidenav-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: collapsed ? "14px 0" : "14px 0",
          minHeight: 0, // Ensures flexbox allows scrolling
          maxHeight: "calc(100vh - 170px)", // Adjust based on header/footer height
        }}
      >
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {/* Secretary: strictly the read-only view (+ attendance) */}
          {isSecretaryUser ? (
            <>
              <SectionTitle title="Overview" collapsed={collapsed} />
              <NavItem href="/secretary" icon={RiShieldUserLine} label="My View (Read-only)" active={isActive("/secretary")} collapsed={collapsed} />
              <NavItem href="/attendance" icon={RiCalendarCheckLine} label="Attendance (View)" active={isActive("/attendance")} collapsed={collapsed} />
            </>
          ) : (
            <>
              <SectionTitle title="Main" collapsed={collapsed} />
              <NavItem href="/home" icon={RiDashboardLine} label="Dashboard" active={isActive("/home")} collapsed={collapsed} />
              {/* Attendance – available to every authenticated staff role */}
              <NavItem href="/attendance" icon={RiCalendarCheckLine} label="Attendance (Sign In/Out)" active={isActive("/attendance")} collapsed={collapsed} />

              <SectionTitle title="People & Enquiries" collapsed={collapsed} />
              <NavItem href="/staff_accounts" icon={RiTeamLine} label="Staff Accounts" active={isActive("/staff_accounts")} collapsed={collapsed} />
              <NavItem href="/enquiries" icon={RiCustomerService2Line} label="Enquiries & Admissions" active={isActive("/enquiries")} collapsed={collapsed} />
              <NavItem href="/messages" icon={RiMessage2Line} label="Messages" active={isActive("/messages")} collapsed={collapsed} />

              <SectionTitle title="Students & Payments" collapsed={collapsed} />
              <NavItem href="/payments" icon={RiMoneyDollarCircleLine} label="New Payment" active={isActive("/payments")} collapsed={collapsed} />
              <NavItem href="/student" icon={RiUserAddLine} label="New Student" active={isActive("/student")} collapsed={collapsed} />
              <NavItem href="/termly_fees" icon={RiWallet3Line} label="Set Termly Fees" active={isActive("/termly_fees")} collapsed={collapsed} />
              <NavItem href="/receipt" icon={RiBillLine} label="Upload/View Receipts" active={isActive("/receipt")} collapsed={collapsed} />

              {/* Records section - class/other payment records visible to everyone */}
              <SectionTitle title="Records" collapsed={collapsed} />
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                <NavItem href="/class_payment" icon={RiSchoolLine} label="Classes School Fees Record" active={isActive("/class_payment")} collapsed={collapsed} />
                <NavItem href="/other_payment" icon={RiBankLine} label="Other Payments Record" active={isActive("/other_payment")} collapsed={collapsed} />

                <NavItem href="/full_payment" icon={RiArchiveStackLine} label="Full Payment Record" active={isActive("/full_payment")} collapsed={collapsed} />
                <NavItem href="/full_student" icon={RiContactsBookLine} label="Full Student Record" active={isActive("/full_student")} collapsed={collapsed} />
              </ul>

              <SectionTitle title="Academics" collapsed={collapsed} />
              <NavItem href="/CBTQuestions" icon={RiComputerLine} label="CBT Questions" active={isActive("/CBTQuestions")} collapsed={collapsed} />
              <NavItem href="/result" icon={RiBarChart2Line} label="Results" active={isActive("/result")} collapsed={collapsed} />
              <NavItem href="/result_archive" icon={RiArchiveStackLine} label="Result Archive" active={isActive("/result_archive")} collapsed={collapsed} />
              <NavItem href="/lesson_plans" icon={RiDraftLine} label="Lesson Plans" active={isActive("/lesson_plans")} collapsed={collapsed} />
              <NavItem href="/notes" icon={RiBookOpenLine} label="E-Notes" active={isActive("/notes")} collapsed={collapsed} />
              <NavItem href="/assignments" icon={RiFileTextLine} label="Assignments" active={isActive("/assignments")} collapsed={collapsed} />

              {/* Administration – Attendance Records + Settings are visible to
                  every admin; the sensitive tools (Data Tools, Audit Logs, ID
                  Cards, Session Tools, Roles & Access) are developer-only. */}
              {canManageStaff && (
                <>
                  <SectionTitle title="Administration" collapsed={collapsed} />
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    <NavItem href="/staff_attendance" icon={RiBriefcaseLine} label="Attendance Records" active={isActive("/staff_attendance")} collapsed={collapsed} />
                    <NavItem href="/setting" icon={RiSettings4Line} label="Settings" active={isActive("/setting")} collapsed={collapsed} />
                    {isDevUser && (
                      <>
                        <NavItem href="/data_tools" icon={RiDatabase2Line} label="Data Tools" active={isActive("/data_tools")} collapsed={collapsed} />
                        <NavItem href="/auditlogs" icon={RiShieldCheckLine} label="Audit Logs" active={isActive("/auditlogs")} collapsed={collapsed} />
                        <NavItem href="/idcards" icon={RiIdCardLine} label="ID Cards" active={isActive("/idcards")} collapsed={collapsed} />
                        <NavItem href="/session_tools" icon={RiRocketLine} label="Session Tools" active={isActive("/session_tools")} collapsed={collapsed} />
                        {isOwnerUser && (
                          <NavItem href="/roles_access" icon={RiShieldKeyholeLine} label="Roles & Access" active={isActive("/roles_access")} collapsed={collapsed} />
                        )}
                      </>
                    )}
                  </ul>
                </>
              )}

              {/* External portals (separate projects) – shown once URLs are configured */}
              {(process.env.NEXT_PUBLIC_STAFF_PORTAL_URL || process.env.NEXT_PUBLIC_STUDENT_PORTAL_URL) && (
                <>
                  <SectionTitle title="Portals" collapsed={collapsed} />
                  {process.env.NEXT_PUBLIC_STAFF_PORTAL_URL && (
                    <li>
                      <a href={process.env.NEXT_PUBLIC_STAFF_PORTAL_URL} target="_blank" rel="noopener noreferrer" title={collapsed ? "Staff Portal" : undefined} className={"sidenav-link" + (collapsed ? " sidenav-link--collapsed" : "")}>
                        <span className="sidenav-icon"><RiExternalLinkLine /></span>
                        {!collapsed && <span className="sidenav-label">Staff Portal</span>}
                      </a>
                    </li>
                  )}
                  {process.env.NEXT_PUBLIC_STUDENT_PORTAL_URL && (
                    <li>
                      <a href={process.env.NEXT_PUBLIC_STUDENT_PORTAL_URL} target="_blank" rel="noopener noreferrer" title={collapsed ? "Student Portal" : undefined} className={"sidenav-link" + (collapsed ? " sidenav-link--collapsed" : "")}>
                        <span className="sidenav-icon"><RiExternalLinkLine /></span>
                        {!collapsed && <span className="sidenav-label">Student Portal</span>}
                      </a>
                    </li>
                  )}
                </>
              )}
            </>
          )}
        </ul>
      </nav>

      {/* Footer: signed-in user + sign out */}
      <div
        style={{
          borderTop: "1px solid var(--snav-border)",
          padding: collapsed ? "14px 10px" : "14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {user && (
          <div
            title={userEmail || ""}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: 10,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                flex: "0 0 auto",
                borderRadius: "50%",
                background: "var(--snav-chip-bg)",
                color: "var(--snav-chip-fg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {(userEmail || user?.email || "?").charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "var(--snav-muted)", textTransform: "uppercase", letterSpacing: "1px", lineHeight: 1.3 }}>
                  Signed in
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--snav-fg)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.3,
                  }}
                >
                  {userEmail || user?.email}
                </div>
              </div>
            )}
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexDirection: collapsed ? "column" : "row",
          }}
        >
          <button
            onClick={() => setThemeUI(toggleTheme())}
            className={"sidenav-theme" + (collapsed ? " sidenav-theme--collapsed" : "")}
            title={collapsed ? (theme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
            aria-label="Toggle dark/light mode"
          >
            <span className="sidenav-icon" style={{ fontSize: collapsed ? 20 : 17 }}>
              {theme === "dark" ? <RiSunLine /> : <RiMoonLine />}
            </span>
            {!collapsed && <span>{theme === "dark" ? "Light" : "Dark"}</span>}
          </button>
          <button
            onClick={signOutUser}
            className={"sidenav-signout" + (collapsed ? " sidenav-signout--collapsed" : "")}
            title={collapsed ? "Sign Out" : undefined}
            aria-label="Sign Out"
          >
            <span className="sidenav-icon" style={{ fontSize: collapsed ? 20 : 17 }}>
              <RiLogoutBoxRLine />
            </span>
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SideNav;
