"use client";

import React, { useState } from "react";
import { RiFileTextLine, RiUserStarLine } from "react-icons/ri";
import AdminAssignments from "./AdminAssignments.jsx";
import StaffAssignments from "./StaffAssignments.jsx";
import "../styles/AdminPages.css";

// One Assignments page, two tabs:
//   Student Homework      -> jmis_assignments      (class work set by teachers)
//   Teaching Assignments  -> jmis_staff_assignments (which teacher owns which class/subject)
// They are different data sets, so instead of merging the logic each tab renders
// its original, untouched management component — every function of both pages
// is preserved. `initialTab` lets the legacy /staff_assignments route open the
// teaching tab directly.
const TABS = [
  {
    id: "student",
    label: "Student Homework",
    hint: "Assignments, assessments and projects set to classes",
    icon: RiFileTextLine,
  },
  {
    id: "teaching",
    label: "Teaching Assignments",
    hint: "Which staff member teaches which class/subject",
    icon: RiUserStarLine,
  },
];

export default function AssignmentsHub({ initialTab = "student" }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <>
      <div className="ah-tabs" role="tablist" aria-label="Assignments sections">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={"ah-tab" + (tab === t.id ? " active" : "")}
              onClick={() => setTab(t.id)}
              title={t.hint}
            >
              <Icon /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === "student" ? <AdminAssignments /> : <StaffAssignments />}
    </>
  );
}
