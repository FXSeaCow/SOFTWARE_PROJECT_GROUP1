import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Calendar,
  Camera,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Phone,
  RotateCcw,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

import { QrScannerModal } from "../components/QrScannerModal";
import { Skeleton } from "../components/Skeleton";
import { panelStyle, startButtonStyle } from "../components/main-menu/styles";
import { useIsMobile } from "../hooks/useIsMobile";
import { AdminPageLayout } from "../layouts/AdminPageLayout";
import {
  BranchOccupancy,
  CurrentOccupancy,
  DailyOccupancyReport,
  GymSession,
  OccupancyStatus,
  checkInGym,
  checkOutGym,
  getAdminDailyReport,
  getCurrentOccupancy,
  listAdminGymSessions,
  resetOpenSessions,
} from "../services/occupancyService";

type SessionStatusFilter = "open" | "closed" | "all";

const STATUS_TABS: { id: SessionStatusFilter; label: string }[] = [
  { id: "open", label: "Currently in gym" },
  { id: "all", label: "All sessions" },
  { id: "closed", label: "Closed" },
];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function todayDateOnly() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusAccent(status: OccupancyStatus): { background: string; color: string } {
  switch (status) {
    case "full":
      return { background: "rgba(239,68,68,0.16)", color: "#fca5a5" };
    case "near_full":
      return { background: "rgba(245,158,11,0.16)", color: "#fbbf24" };
    case "busy":
      return { background: "rgba(250,204,21,0.16)", color: "#fde68a" };
    case "empty":
      return { background: "rgba(148,163,184,0.16)", color: "#cbd5e1" };
    default:
      return { background: "rgba(34,197,94,0.16)", color: "#86efac" };
  }
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return "In progress";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatBranchTime(value?: string | null) {
  if (!value) return "Not set";
  return value.slice(0, 5);
}

function formatBranchLocation(branch: BranchOccupancy) {
  return [branch.address, branch.city].filter(Boolean).join(", ") || "No address provided";
}

function formatBranchHours(branch: BranchOccupancy) {
  if (!branch.opening_time && !branch.closing_time) return "Hours not set";
  return `${formatBranchTime(branch.opening_time)} - ${formatBranchTime(branch.closing_time)}`;
}

function formatBranchOption(branch: BranchOccupancy) {
  const city = branch.city ? ` - ${branch.city}` : "";
  return `${branch.branch_name}${city} (${branch.current_occupancy}/${branch.capacity})`;
}

export function AdminOccupancyPage() {
  const isMobile = useIsMobile();
  const [occupancy, setOccupancy] = useState<CurrentOccupancy | null>(null);
  const [isLoadingOccupancy, setIsLoadingOccupancy] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  const [reportDate, setReportDate] = useState(todayDateOnly());
  const [reportBranchId, setReportBranchId] = useState("");
  const [report, setReport] = useState<DailyOccupancyReport | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(true);

  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<SessionStatusFilter>("open");
  const [sessionsBranchId, setSessionsBranchId] = useState("");
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [checkInBranchId, setCheckInBranchId] = useState("");
  const [isCheckInScannerOpen, setIsCheckInScannerOpen] = useState(false);
  const [isCheckOutScannerOpen, setIsCheckOutScannerOpen] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  async function loadOccupancy() {
    setIsLoadingOccupancy(true);

    try {
      const result = await getCurrentOccupancy();
      setOccupancy(result as CurrentOccupancy);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load live occupancy.");
    } finally {
      setIsLoadingOccupancy(false);
    }
  }

  async function loadReport(date = reportDate, branchId = reportBranchId) {
    setIsLoadingReport(true);

    try {
      const result = await getAdminDailyReport({ date, branchId: branchId || undefined });
      setReport(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load daily report.");
    } finally {
      setIsLoadingReport(false);
    }
  }

  async function loadSessions(status = statusFilter, branchId = sessionsBranchId) {
    setIsLoadingSessions(true);

    try {
      const result = await listAdminGymSessions({ status, branchId: branchId || undefined, limit: 20 });
      setSessions(result.sessions);
      setSessionsTotal(result.total);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load gym sessions.");
    } finally {
      setIsLoadingSessions(false);
    }
  }

  useEffect(() => {
    void loadOccupancy();
  }, []);

  useEffect(() => {
    void loadReport(reportDate, reportBranchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDate, reportBranchId]);

  useEffect(() => {
    void loadSessions(statusFilter, sessionsBranchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sessionsBranchId]);

  useEffect(() => {
    if (!checkInBranchId && occupancy?.branches.length) {
      setCheckInBranchId(occupancy.branches[0].branch_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occupancy]);

  const branchOptions: BranchOccupancy[] = occupancy?.branches ?? [];

  const maxHourly = useMemo(() => {
    if (!report) return 1;
    return Math.max(...report.hourly_occupancy.map((point) => point.occupancy), 1);
  }, [report]);

  async function handleResetOpenSessions(branchId?: string) {
    setIsResetting(true);
    setError(null);
    setFeedback(null);

    try {
      const result = await resetOpenSessions(branchId);
      setFeedback(`${result.closed_count} open session(s) closed.`);
      await Promise.all([loadOccupancy(), loadSessions(statusFilter, sessionsBranchId)]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to reset open sessions.");
    } finally {
      setIsResetting(false);
    }
  }

  async function handleScanCheckIn(token: string) {
    setIsCheckInScannerOpen(false);
    setIsProcessingScan(true);
    setError(null);
    setFeedback(null);

    try {
      const result = await checkInGym(checkInBranchId, token);
      setFeedback(`${result.member.full_name} checked in at ${result.branch.branch_name}.`);
      await Promise.all([loadOccupancy(), loadSessions(statusFilter, sessionsBranchId)]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to check in this member.");
    } finally {
      setIsProcessingScan(false);
    }
  }

  async function handleScanCheckOut(token: string) {
    setIsCheckOutScannerOpen(false);
    setIsProcessingScan(true);
    setError(null);
    setFeedback(null);

    try {
      const result = await checkOutGym(token);
      setFeedback(`${result.member.full_name} checked out of ${result.branch.branch_name}.`);
      await Promise.all([loadOccupancy(), loadSessions(statusFilter, sessionsBranchId)]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to check out this member.");
    } finally {
      setIsProcessingScan(false);
    }
  }

  return (
    <AdminPageLayout activeItem="occupancy">
      <section style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 6 }}>Occupancy</div>
        <div style={{ color: "#9ca8b7", fontSize: 14 }}>
          Live gym occupancy, daily reports, and session history across branches.
        </div>
      </section>

      {error ? (
        <div
          style={{
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
            background: "rgba(127,29,29,0.28)",
            color: "#fecaca",
          }}
        >
          {error}
        </div>
      ) : null}

      {feedback ? (
        <div
          style={{
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
            background: "rgba(6,95,70,0.28)",
            color: "#bbf7d0",
          }}
        >
          {feedback}
        </div>
      ) : null}

      <section className="dashboard-card-enter" style={{ ...panelStyle, marginBottom: 16 }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 900 }}>
            <Activity size={20} color="#86efac" />
            Gym branches
          </div>
          <button
            type="button"
            onClick={() => void handleResetOpenSessions()}
            disabled={isResetting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              background: "rgba(255,255,255,0.02)",
              color: "#d3dae5",
              fontSize: 13,
              fontWeight: 800,
              padding: "8px 14px",
              cursor: isResetting ? "not-allowed" : "pointer",
              opacity: isResetting ? 0.6 : 1,
            }}
          >
            <RotateCcw size={14} />
            {isResetting ? "Resetting..." : "Reset all open sessions"}
          </button>
        </div>

        {isLoadingOccupancy ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} height={100} width="100%" radius={14} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {branchOptions.map((branch) => {
              const accent = statusAccent(branch.status);
              return (
                <div
                  key={branch.branch_id}
                  className="interactive-card"
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)",
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>{branch.branch_name}</div>
                      <div style={{ display: "grid", gap: 6, color: "#9ca8b7", fontSize: 12, lineHeight: 1.35 }}>
                        <div style={{ display: "flex", alignItems: "start", gap: 7 }}>
                          <MapPin size={13} style={{ flex: "0 0 auto", marginTop: 2 }} />
                          <span>{formatBranchLocation(branch)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Clock size={13} />
                          <span>{formatBranchHours(branch)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Phone size={13} />
                          <span>{branch.phone || "No phone provided"}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: "3px 10px",
                        fontSize: 11,
                        fontWeight: 800,
                        ...accent,
                      }}
                    >
                      {branch.status.replace("_", " ")}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.03)",
                        padding: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8d98a7", fontSize: 11, marginBottom: 5 }}>
                        <UserCheck size={13} />
                        Active members
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900 }}>{branch.current_occupancy}</div>
                    </div>

                    <div
                      style={{
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.03)",
                        padding: 10,
                      }}
                    >
                      <div style={{ color: "#8d98a7", fontSize: 11, marginBottom: 5 }}>Capacity</div>
                      <div style={{ fontSize: 22, fontWeight: 900 }}>{branch.capacity}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      height: 6,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(branch.occupancy_rate, 100)}%`,
                        background: accent.color,
                        borderRadius: 999,
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#8d98a7", fontSize: 12 }}>{branch.available_slots} slots free</span>
                    <button
                      type="button"
                      onClick={() => void handleResetOpenSessions(branch.branch_id)}
                      disabled={isResetting}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#8d98a7",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: isResetting ? "not-allowed" : "pointer",
                      }}
                    >
                      Reset branch
                    </button>
                  </div>
                </div>
              );
            })}

            {branchOptions.length === 0 ? (
              <div style={{ color: "#9ca8b7", fontSize: 14 }}>No active branches.</div>
            ) : null}
          </div>
        )}
      </section>

      <section className="dashboard-card-enter" style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
          <Camera size={20} color="#ff9a3d" />
          Member check-in / check-out
        </div>
        <div style={{ color: "#9ca8b7", fontSize: 13, marginBottom: 16 }}>
          Scan a member's QR code (from their Account page) to check them in or out at a branch.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select
            value={checkInBranchId}
            onChange={(event) => setCheckInBranchId(event.target.value)}
            disabled={branchOptions.length === 0}
            style={{
              minHeight: 44,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              color: "#f5f5f5",
              padding: "0 12px",
              fontSize: 13,
            }}
          >
            {branchOptions.length === 0 ? <option value="">No active branches</option> : null}
            {branchOptions.map((branch) => (
              <option key={branch.branch_id} value={branch.branch_id}>
                {formatBranchOption(branch)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setIsCheckInScannerOpen(true)}
            disabled={isProcessingScan || !checkInBranchId}
            style={{
              ...startButtonStyle,
              width: "auto",
              opacity: isProcessingScan || !checkInBranchId ? 0.6 : 1,
              cursor: isProcessingScan || !checkInBranchId ? "not-allowed" : "pointer",
            }}
          >
            <LogIn size={18} />
            Scan to check in
          </button>

          <button
            type="button"
            onClick={() => setIsCheckOutScannerOpen(true)}
            disabled={isProcessingScan}
            style={{
              ...startButtonStyle,
              width: "auto",
              background: "#1f1f1f",
              color: "#f5f5f5",
              border: "1px solid rgba(255,255,255,0.08)",
              opacity: isProcessingScan ? 0.6 : 1,
              cursor: isProcessingScan ? "not-allowed" : "pointer",
            }}
          >
            <LogOut size={18} />
            Scan to check out
          </button>
        </div>
      </section>

      <section className="dashboard-card-enter" style={{ ...panelStyle, marginBottom: 16 }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 900 }}>
            <TrendingUp size={20} color="#93c5fd" />
            Daily report
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: 40,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                padding: "0 12px",
              }}
            >
              <Calendar size={14} color="#9ca8b7" />
              <input
                type="date"
                value={reportDate}
                max={todayDateOnly()}
                onChange={(event) => setReportDate(event.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "#f5f5f5",
                  fontSize: 13,
                  colorScheme: "dark",
                }}
              />
            </label>

            <select
              value={reportBranchId}
              onChange={(event) => setReportBranchId(event.target.value)}
              style={{
                minHeight: 40,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                color: "#f5f5f5",
                padding: "0 12px",
                fontSize: 13,
              }}
            >
              <option value="">All branches</option>
              {branchOptions.map((branch) => (
                <option key={branch.branch_id} value={branch.branch_id}>
                  {formatBranchOption(branch)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoadingReport ? (
          <Skeleton height={180} width="100%" radius={14} />
        ) : report ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 20 }}>
              <ReportStat label="Total visits" value={String(report.total_visits)} />
              <ReportStat label="Unique members" value={String(report.unique_members)} icon={<Users size={16} />} />
              <ReportStat label="Currently open" value={String(report.open_sessions)} />
              <ReportStat
                label="Peak hour"
                value={report.peak_hour.hour ? `${report.peak_hour.hour} (${report.peak_hour.occupancy})` : "—"}
              />
              <ReportStat label="Avg. occupancy" value={`${report.average_occupancy} (${report.average_occupancy_rate}%)`} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(24, minmax(0, 1fr))",
                gap: 3,
                alignItems: "end",
                height: 110,
              }}
            >
              {report.hourly_occupancy.map((point) => (
                <div
                  key={point.hour}
                  title={`${point.hour}: ${point.occupancy}`}
                  style={{
                    height: `${Math.max((point.occupancy / maxHourly) * 100, point.occupancy > 0 ? 6 : 2)}%`,
                    borderRadius: 4,
                    background:
                      point.occupancy > 0
                        ? "linear-gradient(180deg, #93c5fd 0%, #60a5fa 100%)"
                        : "rgba(255,255,255,0.06)",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, color: "#8d98a7", fontSize: 11 }}>
              <span>00:00</span>
              <span>12:00</span>
              <span>23:00</span>
            </div>
          </>
        ) : (
          <div style={{ color: "#9ca8b7", fontSize: 14 }}>No report data.</div>
        )}
      </section>

      <section className="dashboard-card-enter" style={panelStyle}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 18 }}>Gym sessions</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  borderRadius: 999,
                  border:
                    statusFilter === tab.id
                      ? "1px solid rgba(255,122,26,0.4)"
                      : "1px solid rgba(255,255,255,0.08)",
                  background: statusFilter === tab.id ? "rgba(255,122,26,0.16)" : "rgba(255,255,255,0.02)",
                  color: statusFilter === tab.id ? "#ffb15f" : "#9ca8b7",
                  fontWeight: 800,
                  fontSize: 13,
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={sessionsBranchId}
            onChange={(event) => setSessionsBranchId(event.target.value)}
            style={{
              minHeight: 40,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              color: "#f5f5f5",
              padding: "0 12px",
              fontSize: 13,
            }}
          >
            <option value="">All branches</option>
            {branchOptions.map((branch) => (
              <option key={branch.branch_id} value={branch.branch_id}>
                {formatBranchOption(branch)}
              </option>
            ))}
          </select>
        </div>

        {isMobile ? null : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
              gap: 12,
              padding: "0 12px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              color: "#9cc0e7",
              fontSize: 13,
            }}
          >
            <div>Member</div>
            <div>Branch</div>
            <div>Checked in</div>
            <div>Checked out</div>
            <div>Duration</div>
          </div>
        )}

        {isLoadingSessions ? (
          <div style={{ display: "grid" }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} style={{ padding: "14px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <Skeleton height={16} width="100%" radius={8} />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: "24px 12px", color: "#9ca8b7" }}>No sessions found.</div>
        ) : isMobile ? (
          <div style={{ display: "grid", gap: 10 }}>
            {sessions.map((session) => (
              <div
                key={session.id}
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                  padding: 12,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{session.user_name}</div>
                    <div style={{ color: "#9ca8b7", fontSize: 12 }}>{session.user_email}</div>
                  </div>
                  {session.checked_out_at ? null : (
                    <span style={{ color: "#86efac", fontWeight: 800, fontSize: 12, flex: "0 0 auto" }}>Open</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "#d4d4d8" }}>{session.branch_name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca8b7" }}>
                  <span>In: {formatDateTime(session.checked_in_at)}</span>
                  <span>
                    {session.checked_out_at ? `Out: ${formatDateTime(session.checked_out_at)}` : formatDuration(session.duration_minutes)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid" }}>
            {sessions.map((session, index) => (
              <div
                key={session.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
                  gap: 12,
                  alignItems: "center",
                  padding: "14px 12px",
                  borderBottom: index === sessions.length - 1 ? "none" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{session.user_name}</div>
                  <div style={{ color: "#9ca8b7", fontSize: 12 }}>{session.user_email}</div>
                </div>
                <div style={{ fontSize: 14 }}>{session.branch_name}</div>
                <div style={{ fontSize: 13, color: "#d4d4d8" }}>{formatDateTime(session.checked_in_at)}</div>
                <div style={{ fontSize: 13, color: "#d4d4d8" }}>
                  {session.checked_out_at ? (
                    formatDateTime(session.checked_out_at)
                  ) : (
                    <span style={{ color: "#86efac", fontWeight: 800 }}>Open</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "#d4d4d8" }}>{formatDuration(session.duration_minutes)}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, color: "#8d98a7", fontSize: 13 }}>
          Showing {sessions.length} of {sessionsTotal} sessions
        </div>
      </section>

      <QrScannerModal
        isOpen={isCheckInScannerOpen}
        title="Scan to check in"
        onClose={() => setIsCheckInScannerOpen(false)}
        onScan={(token) => void handleScanCheckIn(token)}
      />

      <QrScannerModal
        isOpen={isCheckOutScannerOpen}
        title="Scan to check out"
        onClose={() => setIsCheckOutScannerOpen(false)}
        onScan={(token) => void handleScanCheckOut(token)}
      />
    </AdminPageLayout>
  );
}

function ReportStat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8d98a7", fontSize: 12, marginBottom: 6 }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{value}</div>
    </div>
  );
}
