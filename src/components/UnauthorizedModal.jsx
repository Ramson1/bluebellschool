import React from "react";
import { useRouter } from "next/router";
import { supabase } from "../supabaseClient";

const UnauthorizedModal = () => {
  // Safely initialize router
  let router;
  let isRouterAvailable = false;
  
  try {
    router = useRouter();
    isRouterAvailable = router && router.push;
  } catch (error) {
    console.warn('NextRouter not available in this context');
  }

  const handleReturnHome = async () => {
    if (isRouterAvailable) {
      router.push("/");
    } else {
      // Fallback to window.location for cases where router is not available
      window.location.href = "/";
    }
  };

  const handleLogin = async () => {
    // Sign out current user and redirect to login
    await supabase.auth.signOut();
    if (isRouterAvailable) {
      router.push("/login");
    } else {
      // Fallback to window.location for cases where router is not available
      window.location.href = "/login";
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "10px",
          padding: "40px",
          textAlign: "center",
          maxWidth: "500px",
          width: "90%",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
        }}
      >
        <h2
          style={{
            marginBottom: "12px",
            color: "#333",
            fontSize: "24px",
            fontWeight: "bold",
          }}
        >
          You are not authorized to access the admin panel
        </h2>
        <p style={{ marginBottom: "20px", color: "#666", fontSize: "15px" }}>
          This dashboard is for administrators, the school secretary and developers.
          {process.env.NEXT_PUBLIC_STAFF_PORTAL_URL
            ? " Staff and teachers — please use the Staff Portal instead."
            : " Staff and teachers will sign in through the dedicated Staff Portal (coming soon)."}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          {process.env.NEXT_PUBLIC_STAFF_PORTAL_URL && (
            <a
              href={process.env.NEXT_PUBLIC_STAFF_PORTAL_URL}
              style={{
                padding: "12px 24px",
                backgroundColor: "#011b97",
                color: "#fff",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                textDecoration: "none",
              }}
            >
              Staff Portal
            </a>
          )}
          <button
            onClick={handleReturnHome}
            style={{
              padding: "12px 24px",
              backgroundColor: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500",
              transition: "background-color 0.2s",
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = "#0056b3")}
            onMouseOut={(e) => (e.target.style.backgroundColor = "#007bff")}
          >
            Return Home
          </button>
          <button
            onClick={handleLogin}
            style={{
              padding: "12px 24px",
              backgroundColor: "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500",
              transition: "background-color 0.2s",
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = "#1e7e34")}
            onMouseOut={(e) => (e.target.style.backgroundColor = "#28a745")}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedModal;