"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { fetchAuthRoles, isAdmin, isDev, isSecretary } from "../utils/authUtils";
import {
  RiLockPasswordLine,
  RiMailLine,
  RiEyeLine,
  RiEyeOffLine,
  RiArrowRightLine,
  RiGoogleFill,
} from "react-icons/ri";
import "../styles/Login.css";

const logo = "/logo.jpg";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const go = (path) => { window.location.href = path; };

  // Admin dashboard lockdown: only admin / super_admin (developer) and the
  // secretary may enter. Teachers and other staff are signed back out — the
  // Staff Portal (separate project) is their home. This also drives the redirect
  // after a successful custom sign-in below.
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        try {
          const mail = session.user.user_metadata?.email || session.user.email;
          const roles = await fetchAuthRoles(supabase);
          const disabled = (roles.disabledEmails || []).map((e) => (e || "").toLowerCase());
          const isSuspended = mail && disabled.includes((mail || "").toLowerCase());
          // A suspended account has every role revoked — block before routing.
          if (isSuspended) {
            await supabase.auth.signOut();
            toast.error("Your account access has been disabled. Please contact the system administrator.");
            return;
          }
          const allowedAdmin = isAdmin(mail, roles.adminEmails, disabled) || isDev(mail, roles.devEmails, disabled);
          const allowedSecretary = !allowedAdmin && isSecretary(mail, roles.secretaryEmails || [], disabled);

          if (allowedAdmin) { go("/home"); return; }
          if (allowedSecretary) { go("/secretary"); return; }

          await supabase.auth.signOut();
          const staffPortalUrl = process.env.NEXT_PUBLIC_STAFF_PORTAL_URL;
          toast.error(
            staffPortalUrl
              ? "Admin access only. Staff and teachers please use the Staff Portal."
              : "Admin access only. Staff and teachers will use the dedicated Staff Portal (coming soon)."
          );
        } catch (err) {
          console.error("Role check failed after sign-in:", err);
          await supabase.auth.signOut();
          toast.error("Could not verify your role. Please check your internet connection and try again.");
        }
      }
    });
    return () => { if (typeof authListener === "function") authListener(); };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const mail = email.trim();
    if (!mail || !password) { toast.warn("Enter your email and password."); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Invalid email or password.");
      return;
    }
    // Success: the onAuthStateChange listener above performs the role check + redirect.
  };

  const onGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` },
    });
    setSubmitting(false);
    if (error) toast.error(error.message || "Google sign-in failed.");
  };

  return (
    <div className="adm-login-root">
      <ToastContainer position="top-center" />

      {/* Form panel */}
      <main className="adm-login-main">
        <form className="adm-login-card" onSubmit={onSubmit} noValidate>
          <div className="adm-login-head">
            <img src={logo} alt="Bluebell logo" className="adm-login-logo" />
            <h1>Admin Dashboard</h1>
            <p>Sign in to continue to <b>Bluebell International School</b></p>
          </div>

          <label className="adm-login-field">
            <span className="adm-login-label">Email address</span>
            <div className="adm-login-control">
              <RiMailLine className="adm-login-ic" />
              <input
                type="email"
                autoComplete="username"
                placeholder="you@school.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </label>

          <label className="adm-login-field">
            <span className="adm-login-label">Password</span>
            <div className="adm-login-control">
              <RiLockPasswordLine className="adm-login-ic" />
              <input
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="adm-login-eye"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                title={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <RiEyeOffLine /> : <RiEyeLine />}
              </button>
            </div>
          </label>

          <button type="submit" className="adm-login-submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
            {!submitting && <RiArrowRightLine />}
          </button>

          <div className="adm-login-divider"><span>or</span></div>

          <button type="button" className="adm-login-google" onClick={onGoogle} disabled={submitting}>
            <RiGoogleFill /> Continue with Google
          </button>

          <p className="adm-login-note">
            Access is restricted to administrators, the school secretary and developers.
            Teachers and staff should use the Staff Portal.
          </p>
        </form>
      </main>
    </div>
  );
}
