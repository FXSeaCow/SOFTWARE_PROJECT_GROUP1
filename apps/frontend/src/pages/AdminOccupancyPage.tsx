import React, { useEffect, useMemo, useState } from "react";
import { Activity, Calendar, RotateCcw, TrendingUp, Users } from "lucide-react";

import { Skeleton } from "../components/Skeleton";
import { panelStyle } from "../components/main-menu/styles";
import { AdminPageLayout } from "../layouts/AdminPageLayout";
import {
  BranchOccupancy,
  CurrentOccupancy,
  DailyOccupancyReport,
  GymSession,
  OccupancyStatus,
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

export function AdminOccupancyPage() {
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
            Live occupancy
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{branch.branch_name}</div>
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

                  <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>
                    {branch.current_occupancy}
                    <span style={{ fontSize: 15, color: "#8d98a7", fontWeight: 700 }}> / {branch.capacity}</span>
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
                  {branch.branch_name}
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
                {branch.branch_name}
              </option>
            ))}
          </select>
        </div>

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
