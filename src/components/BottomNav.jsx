"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../supabaseClient";
import "../styles/BottomNav.css";
import {
  RiDashboardLine,
  RiCalendarCheckLine,
  RiTeamLine,
  RiCustomerService2Line,
  RiMessage2Line,
  RiMoneyDollarCircleLine,
  RiUserAddLine,
  RiWallet3Line,
  RiBillLine,
  RiSchoolLine,
  RiBankLine,
  RiArchiveStackLine,
  RiContactsBookLine,
  RiComputerLine,
  RiBarChart2Line,
  RiDraftLine,
  RiBookOpenLine,
  RiFileTextLine,
  RiSettings4Line,
  RiIdCardLine,
  RiDatabase2Line,
  RiShieldCheckLine,
  RiShieldUserLine,
  RiShieldKeyholeLine,
  RiRocketLine,
  RiLogoutBoxRLine,
} from "react-icons/ri";

// Navigation shown to everyone who can reach the dashboard. Because the sidebar
// is hidden on mobile, this bar is the only way to navigate — so it mirrors the
// full admin toolset. Teachers can no longer access the dashboard, so there is
// no teacher filtering here anymore.
const MAIN_NAV = [
  { path: "/home", icon: RiDashboardLine, label: "Home" },
  { path: "/attendance", icon: RiCalendarCheckLine, label: "Attendance" },
  { path: "/staff_accounts", icon: RiTeamLine, label: "Staff" },
  { path: "/enquiries", icon: RiCustomerService2Line, label: "Enquiries" },
  { path: "/messages", icon: RiMessage2Line, label: "Messages" },
  { path: "/payments", icon: RiMoneyDollarCircleLine, label: "New Payment" },
  { path: "/student", icon: RiUserAddLine, label: "New Student" },
  { path: "/termly_fees", icon: RiWallet3Line, label: "Termly Fees" },
  { path: "/receipt", icon: RiBillLine, label: "Receipts" },
  { path: "/class_payment", icon: RiSchoolLine, label: "Class Fees" },
  { path: "/other_payment", icon: RiBankLine, label: "Other Pay" },
  { path: "/full_payment", icon: RiArchiveStackLine, label: "Full Payment" },
  { path: "/full_student", icon: RiContactsBookLine, label: "Students" },
  { path: "/CBTQuestions", icon: RiComputerLine, label: "CBT" },
  { path: "/result", icon: RiBarChart2Line, label: "Results" },
  { path: "/result_archive", icon: RiArchiveStackLine, label: "Archive" },
  { path: "/lesson_plans", icon: RiDraftLine, label: "Lessons" },
  { path: "/notes", icon: RiBookOpenLine, label: "E-Notes" },
  { path: "/assignments", icon: RiFileTextLine, label: "Assignments" },
];

// Sensitive tools – visible only to super_admins (developers).
const DEV_NAV = [
  { path: "/idcards", icon: RiIdCardLine, label: "ID Cards" },
  { path: "/data_tools", icon: RiDatabase2Line, label: "Data Tools" },
  { path: "/auditlogs", icon: RiShieldCheckLine, label: "Audit Logs" },
  { path: "/session_tools", icon: RiRocketLine, label: "Session" },
];

// Account access control – visible only to the ultimate super_admin (owner).
const OWNER_NAV = [
  { path: "/roles_access", icon: RiShieldKeyholeLine, label: "Roles" },
];

// Settings stays available to all admins (not developer-gated).
const SETTINGS = { path: "/setting", icon: RiSettings4Line, label: "Settings" };

// Secretary: strictly the read-only view + attendance.
const SECRETARY_NAV = [
  { path: "/secretary", icon: RiShieldUserLine, label: "My View" },
  { path: "/attendance", icon: RiCalendarCheckLine, label: "Attendance" },
];

const BottomNav = ({ isDev, isSecretary, isOwner }) => {
  const router = useRouter();
  const pathname = usePathname();

  const signOutUser = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const items = isSecretary && !isDev
    ? SECRETARY_NAV
    : [...MAIN_NAV, ...(isDev ? DEV_NAV : []), ...(isOwner ? OWNER_NAV : []), SETTINGS];

  return (
    <nav className="bnav" role="navigation" aria-label="Mobile navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.path;
        return (
          <button
            key={item.path}
            type="button"
            className={"bnav-item" + (active ? " active" : "")}
            aria-current={active ? "page" : undefined}
            onClick={() => router.push(item.path)}
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
      })}
      <button type="button" className="bnav-item bnav-signout" onClick={signOutUser} aria-label="Sign out">
        <RiLogoutBoxRLine />
        <span>Sign Out</span>
      </button>
    </nav>
  );
};

export default BottomNav;
