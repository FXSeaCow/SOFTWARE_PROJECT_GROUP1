import React from "react";
import { Clock, MapPin, Users } from "lucide-react";

import { panelStyle } from "./styles";
import { BranchOccupancy, OccupancyStatus } from "../../services/occupancyService";

function statusAccent(status: OccupancyStatus): { background: string; color: string; label: string } {
  switch (status) {
    case "full":
      return { background: "rgba(239,68,68,0.16)", color: "#fca5a5", label: "Full" };
    case "near_full":
      return { background: "rgba(245,158,11,0.16)", color: "#fbbf24", label: "Nearly full" };
    case "busy":
      return { background: "rgba(250,204,21,0.16)", color: "#fde68a", label: "Busy" };
    case "empty":
      return { background: "rgba(148,163,184,0.16)", color: "#cbd5e1", label: "Quiet" };
    default:
      return { background: "rgba(34,197,94,0.16)", color: "#86efac", label: "Normal" };
  }
}

function formatBranchTime(value?: string | null) {
  if (!value) return "--:--";
  return value.slice(0, 5);
}

function formatBranchLocation(branch: BranchOccupancy) {
  return [branch.address, branch.city].filter(Boolean).join(", ") || "Address not provided";
}

export function MainMenuBranchCard({ branch }: { branch: BranchOccupancy }) {
  const accent = statusAccent(branch.status);

  return (
    <div
      className="interactive-card dashboard-card-enter"
      style={{
        ...panelStyle,
        width: "100%",
        minHeight: 128,
        display: "grid",
        gap: 14,
        alignContent: "space-between",
        background: "linear-gradient(180deg, rgba(22,22,22,0.95) 0%, rgba(13,13,13,0.95) 100%)",
        color: "#f5f5f5",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{branch.branch_name}</div>
        <div
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background: accent.background,
            color: accent.color,
            fontSize: 12,
            fontWeight: 800,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {accent.label}
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8d98a7", fontSize: 14 }}>
          <MapPin size={15} />
          <span>{formatBranchLocation(branch)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8d98a7", fontSize: 14 }}>
          <Clock size={15} />
          <span>
            {formatBranchTime(branch.opening_time)} - {formatBranchTime(branch.closing_time)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8d98a7", fontSize: 14 }}>
          <Users size={15} />
          <span>
            {branch.current_occupancy}/{branch.capacity} checked in
          </span>
        </div>
      </div>
    </div>
  );
}
