import React from "react";
import { CheckCircle2, LogOut, Users } from "lucide-react";

import { panelStyle, startButtonStyle } from "../main-menu/styles";

export type DayActivity = {
  label: string;
  value: number;
};

export type WeeklyCheckinBranchOption = {
  id: string;
  name: string;
  currentOccupancy?: number;
  capacity?: number;
  occupancyRate?: number;
  isCrowded?: boolean;
};

export function ProgressWeeklyActivity({
  days,
  summary,
  branchOptions,
  selectedBranchId,
  onBranchChange,
  onCheckin,
  onCheckout,
  isSubmitting,
  checkinMessage,
  checkinError,
  isCheckedIn,
  selfCheckinEnabled = true,
}: {
  days: DayActivity[];
  summary: string;
  branchOptions: WeeklyCheckinBranchOption[];
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  onCheckin: () => void;
  onCheckout: () => void;
  isSubmitting?: boolean;
  checkinMessage?: string | null;
  checkinError?: string | null;
  isCheckedIn?: boolean;
  // Self-check-in is temporarily disabled backend-side (checkin/checkout are
  // admin-only for now) — set to true again once that's revisited.
  selfCheckinEnabled?: boolean;
}) {
  const maxValue = Math.max(...days.map((day) => day.value), 1);
  const selectedBranch = branchOptions.find((branch) => branch.id === selectedBranchId);

  return (
    <section className="interactive-card dashboard-card-enter" style={{ ...panelStyle, marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-0.03em",
          }}
        >
          Weekly Activity
        </div>
        <div style={{ color: "#ff7a1a", fontWeight: 800, fontSize: 16 }}>
          {summary}
        </div>
      </div>

      {selfCheckinEnabled ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 12,
            marginBottom: 18,
            alignItems: "end",
          }}
        >
          <label style={{ display: "block" }}>
            <div
              style={{
                color: "#9ca8b7",
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Check-in branch
            </div>
            <select
              value={selectedBranchId}
              onChange={(event) => onBranchChange(event.target.value)}
              disabled={branchOptions.length === 0 || isCheckedIn}
              style={{
                width: "100%",
                minHeight: 48,
                borderRadius: 14,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f5f5f5",
                padding: "0 14px",
                fontSize: 14,
                opacity: branchOptions.length === 0 || isCheckedIn ? 0.7 : 1,
              }}
            >
              {branchOptions.length === 0 ? (
                <option value="">No branch available</option>
              ) : (
                branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))
              )}
            </select>
          </label>

          {isCheckedIn ? (
            <button
              type="button"
              onClick={onCheckout}
              disabled={isSubmitting}
              style={{
                ...startButtonStyle,
                minHeight: 48,
                background: "transparent",
                color: "#f87171",
                border: "1px solid rgba(248,113,113,0.32)",
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              <LogOut size={16} />
              {isSubmitting ? "Checking out..." : "Check out"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onCheckin}
              disabled={!selectedBranchId || branchOptions.length === 0 || isSubmitting}
              style={{
                ...startButtonStyle,
                minHeight: 48,
                opacity: !selectedBranchId || branchOptions.length === 0 || isSubmitting ? 0.6 : 1,
              }}
            >
              <CheckCircle2 size={16} />
              {isSubmitting ? "Checking in..." : "Check in"}
            </button>
          )}
        </div>
      ) : null}

      {selfCheckinEnabled && selectedBranch && selectedBranch.capacity !== undefined ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 18,
            color: selectedBranch.isCrowded ? "#fca5a5" : "#8d98a7",
            fontSize: 13,
          }}
        >
          <Users size={14} />
          {selectedBranch.currentOccupancy ?? 0} / {selectedBranch.capacity} currently at{" "}
          {selectedBranch.name}
          {selectedBranch.isCrowded ? " · Crowded" : ""}
        </div>
      ) : null}

      {selfCheckinEnabled && checkinMessage ? (
        <div
          style={{
            marginBottom: 18,
            color: "#ffd7b5",
            fontSize: 13,
          }}
        >
          {checkinMessage}
        </div>
      ) : null}

      {selfCheckinEnabled && checkinError ? (
        <div
          style={{
            marginBottom: 18,
            color: "#fca5a5",
            fontSize: 13,
          }}
        >
          {checkinError}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 10,
          alignItems: "end",
          height: 140,
        }}
      >
        {days.map((day) => {
          const heightPercent = Math.round((day.value / maxValue) * 100);
          return (
            <div
              key={day.label}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "center",
                height: "100%",
                gap: 8,
              }}
            >
              <div
                style={{
                  color: "#d3dae5",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {day.value}
              </div>
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(heightPercent, 4)}%`,
                  borderRadius: 8,
                  background:
                    day.value > 0
                      ? "linear-gradient(180deg, #ff9a3d 0%, #ff7a1a 60%, #dd7418 100%)"
                      : "rgba(255,255,255,0.08)",
                  border: day.value > 0 ? "1px solid rgba(255,146,66,0.22)" : "1px solid rgba(255,255,255,0.04)",
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 10,
          marginTop: 8,
        }}
      >
        {days.map((day) => (
          <div
            key={day.label}
            style={{
              textAlign: "center",
              color: "#8d98a7",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {day.label}
          </div>
        ))}
      </div>
    </section>
  );
}
