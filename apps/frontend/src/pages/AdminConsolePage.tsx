import React from "react";
import { BellRing, CreditCard, Shield, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "../layouts/AppShell";
import { getCurrentUser, logout } from "../services/authService";

type AdminEntry = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  accent: string;
};

const adminEntries: AdminEntry[] = [
  {
    title: "Admin Users",
    description: "Manage accounts, roles, locks, and membership assignment.",
    icon: <Users size={22} />,
    href: "/admin/users",
    accent: "#ff7a1a",
  },
  {
    title: "Payment Approvals",
    description: "Review pending transfers, approve payments, and issue activation codes.",
    icon: <CreditCard size={22} />,
    href: "/admin/payments",
    accent: "#22c55e",
  },
  {
    title: "Announcements",
    description: "Send system, membership, and schedule announcements to members.",
    icon: <BellRing size={22} />,
    href: "/admin/announcements",
    accent: "#60a5fa",
  },
];

export function AdminConsolePage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  return (
    <AppShell activeItem="none">
      <div style={{ display: "grid", gap: 20 }}>
        <section
          style={{
            borderRadius: 28,
            padding: "28px clamp(20px, 4vw, 36px)",
            background:
              "linear-gradient(135deg, rgba(28,16,9,0.98) 0%, rgba(57,31,14,0.94) 46%, rgba(14,14,14,0.94) 100%)",
            border: "1px solid rgba(255,122,26,0.18)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.24)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(255,122,26,0.18)",
              color: "#ffb15f",
              fontSize: 13,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              marginBottom: 18,
            }}
          >
            <Shield size={16} />
            Admin Console
          </div>

          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 3.2rem)", lineHeight: 0.95 }}>
            Control panel for gym operations
          </h1>
          <p style={{ margin: "14px 0 0", maxWidth: 760, color: "#d1d5db", fontSize: 16, lineHeight: 1.6 }}>
            Choose the admin area you want to work in. User management, payment approvals,
            and announcement publishing are grouped here instead of sending you straight to one page.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
            {currentUser ? (
              <div style={{ color: "#9ca3af", fontSize: 14 }}>
                Signed in as <strong style={{ color: "#f8fafc" }}>{currentUser.email}</strong>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => navigate("/membership")}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14,
                padding: "12px 16px",
                background: "transparent",
                color: "#f8fafc",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Back to membership
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              style={{
                border: "none",
                borderRadius: 14,
                padding: "12px 16px",
                background: "#ff7a1a",
                color: "#111111",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Log out
            </button>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
          {adminEntries.map((entry) => (
            <button
              key={entry.href}
              type="button"
              onClick={() => navigate(entry.href)}
              style={{
                textAlign: "left",
                borderRadius: 24,
                padding: 22,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(10,10,10,0.92)",
                color: "#f8fafc",
                cursor: "pointer",
                boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  display: "grid",
                  placeItems: "center",
                  background: `${entry.accent}22`,
                  color: entry.accent,
                  marginBottom: 18,
                }}
              >
                {entry.icon}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>{entry.title}</div>
              <div style={{ color: "#9ca3af", fontSize: 15, lineHeight: 1.55 }}>{entry.description}</div>
            </button>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
