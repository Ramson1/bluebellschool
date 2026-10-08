import React, { useEffect, useState } from "react";
import { Bar, Pie, Line, Doughnut } from "react-chartjs-2";
import { supabase } from "../supabaseClient";
import { CLASS_OPTIONS } from "../utils/classOptions";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import "../styles/AdminDashboardGraphs.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title
);

// Legacy label kept ahead of the canonical Creche → Year 12 list
const gradeLabels = ["Daycare", ...CLASS_OPTIONS];

// Stored class values vary in case/spacing ("YEAR 7", "nursery1"), so match
// on a stripped-lowercase key instead of raw string equality.
const classKey = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const AdminDashboardGraphs = () => {
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    // Fetch all students
    supabase
      .from("jmis_student")
      .select("*")
      .then(({ data, error }) => {
        if (!error && data) setStudents(data);
      });

    // Fetch all payments
    supabase
      .from("jmis_paymentsinfo")
      .select("*")
      .then(({ data, error }) => {
        if (!error && data) setPayments(data);
      });
  }, []);

  // --- Data Processing for Graphs ---

  // 1. Students by Grade (Bar)
  const studentsByGrade = gradeLabels.map(
    (label) => students.filter((s) => classKey(s.class) === classKey(label)).length
  );

  // 2. Payment Status (Pie)
  const paidCount = payments.filter((p) => Number(p.amountpaid) > 0).length;
  const unpaidCount = students.length - paidCount;

  // 3. Monthly Revenue (Line)
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const revenueByMonth = months.map((m, idx) => {
    const monthPayments = payments.filter((p) => {
      const d = new Date(p.date);
      return d.getMonth() === idx;
    });
    return monthPayments.reduce(
      (sum, p) => sum + Number(p.amountpaid || 0),
      0
    );
  });

  // 4. Payment Methods (Doughnut)
  const methodLabels = [
    "Paid via Cash",
    "Paid via POS",
    "Paid via Bank Transfer",
    "Paid via Bank Deposit",
  ];
  const methodCounts = methodLabels.map(
    (label) => payments.filter((p) => p.paymentdescription === label).length
  );

  // --- Chart Data ---
  const barData = {
    labels: gradeLabels,
    datasets: [
      {
        label: "Total Students",
        data: studentsByGrade,
        backgroundColor: "#4e73df",
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const pieData = {
    labels: ["Paid", "Unpaid"],
    datasets: [
      {
        label: "Payment Status",
        data: [paidCount, unpaidCount],
        backgroundColor: ["#1cc88a", "#e74a3b"],
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  const lineData = {
    labels: months,
    datasets: [
      {
        label: "Monthly Revenue (₦)",
        data: revenueByMonth,
        fill: true,
        borderColor: "#4e73df",
        backgroundColor: "rgba(78, 115, 223, 0.1)",
        tension: 0.4,
        pointBackgroundColor: "#fff",
        pointBorderColor: "#4e73df",
        pointRadius: 5,
      },
    ],
  };

  const doughnutData = {
    labels: methodLabels,
    datasets: [
      {
        label: "Payment Methods",
        data: methodCounts,
        backgroundColor: [
          "#36b9cc",
          "#f6c23e",
          "#4e73df",
          "#1cc88a",
        ],
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  const chartOptions = {
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          color: "#444",
          font: { size: 14, weight: "bold" },
          padding: 20,
        },
      },
      title: { display: false },
      tooltip: {
        backgroundColor: "#222",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "#4e73df",
        borderWidth: 1,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  return (
    <div className="dashboard-graphs-container">
      <div className="dashboard-graph-card">
        <h5 className="dashboard-graph-title">Students by Grade</h5>
        <Bar data={barData} options={chartOptions} height={220} />
      </div>
      <div className="dashboard-graph-card">
        <h5 className="dashboard-graph-title">Payment Status</h5>
        <Pie data={pieData} options={chartOptions} height={220} />
      </div>
      <div className="dashboard-graph-card">
        <h5 className="dashboard-graph-title">Monthly Revenue Trend</h5>
        <Line data={lineData} options={chartOptions} height={220} />
      </div>
      <div className="dashboard-graph-card">
        <h5 className="dashboard-graph-title">Payment Methods</h5>
        <Doughnut data={doughnutData} options={chartOptions} height={220} />
      </div>
    </div>
  );
};

export default AdminDashboardGraphs;