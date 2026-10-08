"use client";

// RolesAccess — access control for the ultimate super_admin (OWNER_EMAIL).
// Only blackboxinfo01@gmail.com can open this page (gated client-side here AND
// server-side in app/api/access-control/route.ts). It lists every other admin
// and super_admin and lets the owner suspend or restore their dashboard access.
// Disabling is reversible: the account's login and data stay intact — we only
// remove it from its role table and record a snapshot for one-click restore.

import React, { useEffect, useState, useMemo } from "react";
import { Modal } from "react-bootstrap";
import { supabase } from "../supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  RiShieldKeyholeLine,
  RiShieldUserLine,
  RiAdminLine,
  RiUserLine,
  RiSearchLine,
  RiForbidLine,
  RiPlayCircleLine,
  RiErrorWarningLine,
  RiCloseLine,
  RiLockLine,
  RiLoader4Line,
  RiTimeLine,
  RiInboxLine,
} from "react-icons/ri";
import "../styles/AdminPages.css";
import { OWNER_EMAIL } from "../utils/authUtils";

const norm = (e) => (e || "").toLowerCase().trim();

export default function RolesAccess() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const [data, setData] = useState({ admins: [], superAdmins: [], disabled: [] });
  const [loadingData, setLoadingData] = useState(false);
  const [search, setSearch] = useState("");

  // disable confirmation modal -> { show, target, reason, busy }
  const [disable, setDisable] = useState(null);

  const email = user?.user_metadata?.email || user?.email;
  const isOwner = norm(email) === norm(OWNER_EMAIL);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user: cu } } = await supabase.auth.getUser();
        setUser(cu);
      } catch (e) {
        console.error(e);
      } finally {
        setReady(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (isOwner) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  // Call the owner-only service-role API route with the bearer token.
  const api = async (url, method, body) => {
    const { data: { session: sess } } = await supabase.auth.getSession();
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sess?.access_token || ""}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  };

  const load = async () => {
    setLoadingData(true);
    try {
      const json = await api("/api/access-control", "GET");
      setData({
        admins: json.admins || [],
        superAdmins: json.superAdmins || [],
        disabled: json.disabled || [],
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to load accounts: " + e.message);
    } finally {
      setLoadingData(false);
    }
  };

  const openDisable = (row, role) => setDisable({ show: true, target: { ...row, role }, reason: "", busy: false });
  const closeDisable = () => setDisable(null);

  const confirmDisable = async () => {
    if (!disable) return;
    setDisable((d) => ({ ...d, busy: true }));
    try {
      const { target, reason } = disable;
      await api("/api/access-control", "POST", {
        action: "disable",
        email: target.email,
        role: target.role,
        name: target.name || "",
        reason: reason || "",
      });
      toast.success(`${target.name || target.email} has been disabled`);
      closeDisable();
      load();
    } catch (e) {
      console.error(e);
      toast.error(e.message);
      setDisable((d) => (d ? { ...d, busy: false } : d));
    }
  };

  const enable = async (row) => {
    try {
      await api("/api/access-control", "POST", { action: "enable", email: row.email });
      toast.success(`${row.name || row.email} has been re-enabled`);
      load();
    } catch (e) {
      console.error(e);
      toast.error(e.message);
    }
  };

  const fmtDate = (d) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleString(); } catch { return d; }
  };

  const match = (r) => {
    const q = search.toLowerCase();
    return !q || (r.email || "").toLowerCase().includes(q) || (r.name || "").toLowerCase().includes(q);
  };

  const admins = useMemo(() => data.admins.filter(match), [data.admins, search]);
  const superAdmins = useMemo(() => data.superAdmins.filter(match), [data.superAdmins, search]);
  const disabled = useMemo(() => data.disabled.filter(match), [data.disabled, search]);

  if (!ready) {
    return (
      <>
        <ToastContainer />
        <div className="ap-loading"><div className="ap-spinner" /><div>Verifying credentials...</div></div>
      </>
    );
  }

  if (!isOwner) {
    return (
      <>
        <ToastContainer />
        <div className="ap-denied">
          <RiErrorWarningLine />
          <h2>Not authorised</h2>
          <p>Account access control is reserved for the ultimate super administrator.</p>
          <button className="ap-btn ghost" onClick={() => (window.location.href = "/home")}>Back to Dashboard</button>
        </div>
      </>
    );
  }

  const AccountTable = ({ rows, role, emptyText }) => (
    <div className="ap-card">
      <div className="ap-tablewrap">
        {rows.length === 0 ? (
          <div className="ap-empty"><RiInboxLine /> {emptyText}</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th style={{ minWidth: 160 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.email}>
                  <td style={{ fontWeight: 700 }}>{r.name || <span className="ap-hint">—</span>}</td>
                  <td style={{ fontSize: "0.85rem" }}>{r.email}</td>
                  <td>
                    <button
                      className="ap-btn sm ghost"
                      style={{ color: "#a13834" }}
                      title="Suspend this account's dashboard access"
                      onClick={() => openDisable(r, role)}
                    >
                      <RiForbidLine /> Disable
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <>
      <ToastContainer />
      <div className="ap-page">
        <div className="ap-head">
          <div>
            <h1 className="ap-title">
              <span className="ap-title-ic"><RiShieldKeyholeLine /></span>
              Roles &amp; Access
            </h1>
            <p className="ap-sub">Suspend or restore dashboard access for admin and super admin accounts. Disabling is reversible — logins and data are kept intact.</p>
          </div>
          <div className="ap-actions">
            <span className="ap-pill blue"><RiUserLine /> {data.admins.length} admins</span>
            <span className="ap-pill"><RiShieldUserLine /> {data.superAdmins.length} super admins</span>
            <span className="ap-pill"><RiForbidLine /> {data.disabled.length} disabled</span>
          </div>
        </div>

        <div className="ap-toolbar">
          <div className="ap-search">
            <RiSearchLine />
            <input
              type="text"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ap-input"
            />
          </div>
          <button className="ap-btn ghost" onClick={load} disabled={loadingData}>
            {loadingData ? <><RiLoader4Line className="spin" /> Refreshing...</> : "Refresh"}
          </button>
        </div>

        {loadingData ? (
          <div className="ap-loading"><div className="ap-spinner" /><div>Loading accounts...</div></div>
        ) : (
          <>
            <div className="ap-card-head" style={{ marginTop: 8 }}>
              <span className="ic"><RiShieldUserLine /></span>
              Super Admins
              <span className="ap-card-sub">developers with full system access</span>
            </div>
            <AccountTable rows={superAdmins} role="super_admin" emptyText="No other super admin accounts." />

            <div className="ap-card-head" style={{ marginTop: 18 }}>
              <span className="ic"><RiAdminLine /></span>
              Admins
              <span className="ap-card-sub">dashboard administrators</span>
            </div>
            <AccountTable rows={admins} role="admin" emptyText="No admin accounts found." />

            <div className="ap-card-head" style={{ marginTop: 18 }}>
              <span className="ic"><RiForbidLine /></span>
              Disabled Accounts
              <span className="ap-card-sub">suspended — restore to reinstate access</span>
            </div>
            <div className="ap-card">
              <div className="ap-tablewrap">
                {disabled.length === 0 ? (
                  <div className="ap-empty"><RiInboxLine /> No disabled accounts.</div>
                ) : (
                  <table className="ap-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Reason</th>
                        <th>Disabled</th>
                        <th style={{ minWidth: 140 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disabled.map((r) => (
                        <tr key={r.email}>
                          <td style={{ fontWeight: 700 }}>{r.name || <span className="ap-hint">—</span>}</td>
                          <td style={{ fontSize: "0.85rem" }}>{r.email}</td>
                          <td>
                            <span className={`ap-badge ${r.role === "super_admin" ? "info" : "neutral"}`}>
                              {r.role === "super_admin" ? "Super Admin" : "Admin"}
                            </span>
                          </td>
                          <td className="ap-hint">{r.reason || "—"}</td>
                          <td><span className="ap-hint"><RiTimeLine /> {fmtDate(r.disabled_at)}</span></td>
                          <td>
                            <button
                              className="ap-btn sm ghost"
                              style={{ color: "#0f5132" }}
                              title="Restore this account's access"
                              onClick={() => enable(r)}
                            >
                              <RiPlayCircleLine /> Enable
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Disable confirmation modal (captures an optional reason) */}
      <Modal show={!!disable} onHide={closeDisable} centered contentClassName="ap-modal-content">
        {disable && (
          <>
            <Modal.Header className="ap-modal-head red" closeButton closeVariant="white">
              <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 800 }}>
                <RiLockLine /> Disable {disable.target.name || disable.target.email}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="ap-modal-body">
              <p style={{ marginTop: 0 }}>
                Suspend dashboard access for <b>{disable.target.email}</b>
                {disable.target.role === "super_admin" ? " (super admin)" : " (admin)"}?
                They will be signed out immediately and blocked from signing back in.
                Their login and data are kept so you can restore access later.
              </p>
              <div className="ap-field">
                <label className="ap-label">Reason (optional)</label>
                <input
                  className="ap-input"
                  value={disable.reason}
                  onChange={(e) => setDisable((d) => ({ ...d, reason: e.target.value }))}
                  placeholder="e.g. left the school, security concern"
                />
              </div>
            </Modal.Body>
            <Modal.Footer className="ap-modal-foot">
              <button className="ap-btn ghost" onClick={closeDisable} disabled={disable.busy}><RiCloseLine /> Cancel</button>
              <button className="ap-btn red" onClick={confirmDisable} disabled={disable.busy}>
                {disable.busy ? <><RiLoader4Line className="spin" /> Disabling...</> : <><RiForbidLine /> Yes, disable</>}
              </button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </>
  );
}
