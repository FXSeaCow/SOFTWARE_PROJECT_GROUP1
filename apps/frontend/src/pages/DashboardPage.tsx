import React from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/Button";
import { getCurrentUser, logout } from "../services/authService";

export function DashboardPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "48px auto",
          background: "#fff",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Dashboard</h1>
        <p style={{ color: "#475569" }}>
          Signed in as <strong>{user?.email ?? "unknown user"}</strong>.
        </p>
        <div style={{ maxWidth: 180 }}>
          <Button
            type="button"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}
