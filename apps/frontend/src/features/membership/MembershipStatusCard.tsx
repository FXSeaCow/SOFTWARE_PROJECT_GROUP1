import React from "react";
import { CalendarDays, Clock } from "lucide-react";

import { CurrentMembership } from "../../services/membershipService";

import { formatDate } from "./utils";

const STATUS_STYLES: Record<CurrentMembership["status"], { background: string; color: string; label: string }> = {
  active: { background: "rgba(34,197,94,0.16)", color: "#86efac", label: "Active" },
  expired: { background: "rgba(239,68,68,0.16)", color: "#fca5a5", label: "Expired" },
  suspended: { background: "rgba(245,158,11,0.16)", color: "#fbbf24", label: "Suspended" },
  cancelled: { background: "rgba(148,163,184,0.16)", color: "#cbd5e1", label: "Cancelled" },
};

export function MembershipStatusCard({
  membership,
  isLoading = false,
}: {
  membership: CurrentMembership | null;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div
        className="interactive-card dashboard-card-enter"
        style={{
          borderRadius: 24,
          background: "#151515",
          border: "1px solid rgba(255,255,255,0.08)",
          padding: 24,
          marginBottom: 24,
          color: "#9ca3af",
          fontSize: 15,
        }}
      >
        Loading your membership...
      </div>
    );
  }

  if (!membership) {
    return (
      <div
        className="interactive-card dashboard-card-enter"
        style={{
          borderRadius: 24,
          background: "#151515",
          border: "1px solid rgba(255,255,255,0.08)",
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div style={{ color: "#9ca8b7", fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Your membership
        </div>
        <div style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 800, color: "#f8fafc" }}>
          You don't have an active membership yet
        </div>
        <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 14 }}>
          Choose a plan below to get started.
        </div>
      </div>
    );
  }

  const status = STATUS_STYLES[membership.status];
  const totalDays = Math.max(membership.duration_days, 1);
  const elapsedDays = Math.min(Math.max(totalDays - membership.days_remaining, 0), totalDays);
  const progressPercent = Math.round((elapsedDays / totalDays) * 100);

  return (
    <div
      className="interactive-card dashboard-card-enter"
      style={{
        borderRadius: 24,
        background: "#151515",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: 24,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ color: "#9ca8b7", fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Your membership
          </div>
          <div style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 900, color: "#f8fafc" }}>
            {membership.plan_name}
          </div>
        </div>

        <span
          style={{
            borderRadius: 999,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            ...status,
          }}
        >
          {status.label}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#d1d5db", fontSize: 14 }}>
          <CalendarDays size={16} />
          <span>
            {formatDate(membership.start_date)} - {formatDate(membership.end_date)}
          </span>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 800,
            color: membership.expiring_soon ? "#fbbf24" : "#d1d5db",
          }}
        >
          <Clock size={16} />
          <span>
            {membership.status === "active"
              ? membership.days_remaining > 0
                ? `${membership.days_remaining} day${membership.days_remaining === 1 ? "" : "s"} remaining`
                : "Expires today"
              : `${Math.max(membership.days_remaining, 0)} day${membership.days_remaining === 1 ? "" : "s"} left in cycle`}
          </span>
        </div>
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(Math.max(progressPercent, 0), 100)}%`,
            borderRadius: 999,
            background: membership.expiring_soon ? "#f59e0b" : "#ff6a13",
            transition: "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
}
