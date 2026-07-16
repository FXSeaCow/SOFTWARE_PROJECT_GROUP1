import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarClock,
  CreditCard,
  Dumbbell,
  Flame,
  Users,
} from "lucide-react";

import { Skeleton } from "../components/Skeleton";
import { panelStyle } from "../components/main-menu/styles";
import { FitnessMetricsChart } from "../components/progress/FitnessMetricsChart";
import { AdminPageLayout } from "../layouts/AdminPageLayout";
import {
  AdminDashboard,
  MembershipsReport,
  OccupancyReport,
  PaymentStatistics,
  ReportRangeParams,
  RevenueReport,
  StreakStatistics,
  UserStatistics,
  WorkoutStatistics,
  getAdminDashboard,
  getAdminMembershipsReport,
  getAdminOccupancyReport,
  getAdminPaymentStatistics,
  getAdminRevenueReport,
  getAdminStreakStatistics,
  getAdminUserStatistics,
  getAdminWorkoutStatistics,
} from "../services/adminAnalyticsService";

type ReportTab =
  | "overview"
  | "revenue"
  | "memberships"
  | "occupancy"
  | "users"
  | "workouts"
  | "streaks"
  | "payments";

const TABS: { id: ReportTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "revenue", label: "Revenue" },
  { id: "memberships", label: "Memberships" },
  { id: "occupancy", label: "Occupancy" },
  { id: "users", label: "Users" },
  { id: "workouts", label: "Workouts" },
  { id: "streaks", label: "Streaks" },
  { id: "payments", label: "Payments" },
];

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("en-US").format(Math.round(value))} VND`;
}

function formatPeriodLabel(period: string) {
  const date = new Date(period);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function titleCase(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [memberships, setMemberships] = useState<MembershipsReport | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [users, setUsers] = useState<UserStatistics | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutStatistics | null>(null);
  const [streaks, setStreaks] = useState<StreakStatistics | null>(null);
  const [payments, setPayments] = useState<PaymentStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const rangeParams: ReportRangeParams = useMemo(
    () => ({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      groupBy,
    }),
    [fromDate, toDate, groupBy],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        switch (activeTab) {
          case "overview": {
            const result = await getAdminDashboard();
            if (!cancelled) setDashboard(result);
            break;
          }
          case "revenue": {
            const result = await getAdminRevenueReport(rangeParams);
            if (!cancelled) setRevenue(result);
            break;
          }
          case "memberships": {
            const result = await getAdminMembershipsReport(rangeParams);
            if (!cancelled) setMemberships(result);
            break;
          }
          case "occupancy": {
            const result = await getAdminOccupancyReport(rangeParams);
            if (!cancelled) setOccupancy(result);
            break;
          }
          case "users": {
            const result = await getAdminUserStatistics(rangeParams);
            if (!cancelled) setUsers(result);
            break;
          }
          case "workouts": {
            const result = await getAdminWorkoutStatistics(rangeParams);
            if (!cancelled) setWorkouts(result);
            break;
          }
          case "streaks": {
            const result = await getAdminStreakStatistics(rangeParams);
            if (!cancelled) setStreaks(result);
            break;
          }
          case "payments": {
            const result = await getAdminPaymentStatistics(rangeParams);
            if (!cancelled) setPayments(result);
            break;
          }
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Unable to load report.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, rangeParams]);

  return (
    <AdminPageLayout activeItem="reports">
      <section style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 6 }}>Reports</div>
        <div style={{ color: "#9ca8b7", fontSize: 14 }}>
          Cross-cutting analytics across members, revenue, occupancy, and engagement.
        </div>
      </section>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                borderRadius: 999,
                border: activeTab === tab.id ? "1px solid rgba(255,122,26,0.4)" : "1px solid rgba(255,255,255,0.08)",
                background: activeTab === tab.id ? "rgba(255,122,26,0.16)" : "rgba(255,255,255,0.02)",
                color: activeTab === tab.id ? "#ffb15f" : "#9ca8b7",
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

        {activeTab !== "overview" ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              style={dateInputStyle}
            />
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              style={dateInputStyle}
            />
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as "day" | "month")}
              style={dateInputStyle}
            >
              <option value="day">By day</option>
              <option value="month">By month</option>
            </select>
          </div>
        ) : null}
      </div>

      {error ? (
        <div style={{ borderRadius: 14, padding: 14, marginBottom: 16, background: "rgba(127,29,29,0.28)", color: "#fecaca" }}>
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div style={{ display: "grid", gap: 12 }}>
          <Skeleton height={120} width="100%" radius={14} />
          <Skeleton height={220} width="100%" radius={14} />
        </div>
      ) : (
        <>
          {activeTab === "overview" ? <OverviewTab data={dashboard} /> : null}
          {activeTab === "revenue" ? <RevenueTab data={revenue} /> : null}
          {activeTab === "memberships" ? <MembershipsTab data={memberships} /> : null}
          {activeTab === "occupancy" ? <OccupancyTab data={occupancy} /> : null}
          {activeTab === "users" ? <UsersTab data={users} /> : null}
          {activeTab === "workouts" ? <WorkoutsTab data={workouts} /> : null}
          {activeTab === "streaks" ? <StreaksTab data={streaks} /> : null}
          {activeTab === "payments" ? <PaymentsTab data={payments} /> : null}
        </>
      )}
    </AdminPageLayout>
  );
}

const dateInputStyle: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
  color: "#f5f5f5",
  padding: "0 12px",
  fontSize: 13,
  colorScheme: "dark",
};

function StatGrid({ items }: { items: { label: string; value: string; icon?: React.ReactNode }[] }) {
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
      {items.map((item) => (
        <div key={item.label} className="interactive-card dashboard-card-enter" style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#8d98a7", fontSize: 13, marginBottom: 10 }}>
            {item.icon}
            {item.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{item.value}</div>
        </div>
      ))}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dashboard-card-enter" style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>{title}</div>
      {children}
    </section>
  );
}

function BreakdownBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  if (items.length === 0) {
    return <div style={{ color: "#9ca8b7", fontSize: 13 }}>No data.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => (
        <div key={item.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: "#d3dae5" }}>{titleCase(item.label)}</span>
            <span style={{ color: "#8d98a7", fontWeight: 700 }}>{item.value}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0)}%`,
                background: "linear-gradient(90deg, #ff9a3d, #ff7a1a)",
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({
  columns,
  rows,
  emptyLabel = "No data.",
}: {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, React.ReactNode>[];
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <div style={{ color: "#9ca8b7", fontSize: 13 }}>{emptyLabel}</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 480 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
            gap: 12,
            padding: "0 4px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            color: "#9cc0e7",
            fontSize: 12,
          }}
        >
          {columns.map((col) => (
            <div key={col.key} style={{ textAlign: col.align ?? "left" }}>
              {col.label}
            </div>
          ))}
        </div>
        {rows.map((row, index) => (
          <div
            key={index}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
              gap: 12,
              padding: "10px 4px",
              borderBottom: index === rows.length - 1 ? "none" : "1px solid rgba(255,255,255,0.05)",
              fontSize: 13,
              color: "#d4d4d8",
            }}
          >
            {columns.map((col) => (
              <div key={col.key} style={{ textAlign: col.align ?? "left" }}>
                {row[col.key]}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewTab({ data }: { data: AdminDashboard | null }) {
  if (!data) return null;
  const { overview } = data;

  return (
    <>
      <StatGrid
        items={[
          { label: "Total users", value: String(overview.total_users), icon: <Users size={16} /> },
          { label: "Active memberships", value: String(overview.active_memberships), icon: <CreditCard size={16} /> },
          { label: "Expiring soon", value: String(overview.memberships_expiring_soon), icon: <CalendarClock size={16} /> },
          { label: "Active branches", value: String(overview.active_branches), icon: <Activity size={16} /> },
          { label: "Currently in gym", value: String(overview.active_gym_sessions), icon: <Activity size={16} /> },
          { label: "Active workout plans", value: String(overview.active_workout_plans), icon: <Dumbbell size={16} /> },
          { label: "Today's check-ins", value: String(overview.today_checkins), icon: <Flame size={16} /> },
          { label: "Pending payments", value: String(overview.pending_payments), icon: <CreditCard size={16} /> },
        ]}
      />

      <StatGrid
        items={[
          { label: "Lifetime revenue", value: formatCurrency(overview.lifetime_revenue) },
          { label: "This month", value: formatCurrency(overview.month_revenue) },
          { label: "Today", value: formatCurrency(overview.today_revenue) },
        ]}
      />

      <Panel title="Recent revenue">
        <FitnessMetricsChart
          points={[...data.recent_revenue]
            .sort((left, right) => new Date(left.period).getTime() - new Date(right.period).getTime())
            .map((row) => ({ label: formatPeriodLabel(row.period), value: row.total_revenue }))}
          unit=" VND"
          accent="#60a5fa"
        />
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Memberships by status">
          <BreakdownBars items={data.membership_overview.map((row) => ({ label: row.status, value: row.member_count }))} />
        </Panel>

        <Panel title="Current occupancy">
          <div style={{ display: "grid", gap: 10 }}>
            {data.current_occupancy.map((branch) => (
              <div key={branch.branch_id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#d3dae5" }}>{branch.branch_name}</span>
                <span style={{ color: "#8d98a7", fontWeight: 700 }}>
                  {branch.active_members_in_gym} / {branch.capacity}
                </span>
              </div>
            ))}
            {data.current_occupancy.length === 0 ? <div style={{ color: "#9ca8b7", fontSize: 13 }}>No branches.</div> : null}
          </div>
        </Panel>
      </div>
    </>
  );
}

function RevenueTab({ data }: { data: RevenueReport | null }) {
  if (!data) return null;

  return (
    <>
      <StatGrid
        items={[
          { label: "Transactions", value: String(data.totals.transaction_count) },
          { label: "Total revenue", value: formatCurrency(data.totals.total_revenue) },
          { label: "Average transaction", value: formatCurrency(data.totals.average_transaction_amount) },
          { label: "Largest transaction", value: formatCurrency(data.totals.largest_transaction_amount) },
        ]}
      />

      <Panel title="Revenue trend">
        <FitnessMetricsChart
          points={[...data.rows]
            .sort((left, right) => new Date(left.period).getTime() - new Date(right.period).getTime())
            .map((row) => ({ label: formatPeriodLabel(row.period), value: row.total_revenue }))}
          unit=" VND"
          accent="#60a5fa"
        />
      </Panel>
    </>
  );
}

function MembershipsTab({ data }: { data: MembershipsReport | null }) {
  if (!data) return null;

  return (
    <>
      <Panel title="Memberships by status">
        <BreakdownBars items={data.overview.map((row) => ({ label: row.status, value: row.member_count }))} />
      </Panel>

      <Panel title="New memberships trend">
        <FitnessMetricsChart
          points={[...data.trend]
            .sort((left, right) => new Date(left.period).getTime() - new Date(right.period).getTime())
            .map((row) => ({ label: formatPeriodLabel(row.period), value: row.new_memberships }))}
          unit=""
          accent="#3ddc97"
        />
      </Panel>

      <Panel title="Plan breakdown">
        <SimpleTable
          columns={[
            { key: "plan", label: "Plan" },
            { key: "price", label: "Price", align: "right" },
            { key: "total", label: "Total", align: "right" },
            { key: "active", label: "Active", align: "right" },
          ]}
          rows={data.plan_breakdown.map((row) => ({
            plan: row.plan_name,
            price: formatCurrency(row.price),
            total: row.total_memberships,
            active: row.active_memberships,
          }))}
        />
      </Panel>

      <Panel title={`Expiring soon (next ${data.filters.expiring_days} days)`}>
        <SimpleTable
          columns={[
            { key: "member", label: "Member" },
            { key: "plan", label: "Plan" },
            { key: "end_date", label: "Ends" },
            { key: "days", label: "Days left", align: "right" },
          ]}
          rows={data.expiring_soon.map((row) => ({
            member: row.user_name,
            plan: row.plan_name,
            end_date: row.end_date,
            days: row.days_remaining,
          }))}
          emptyLabel="No memberships expiring soon."
        />
      </Panel>
    </>
  );
}

function OccupancyTab({ data }: { data: OccupancyReport | null }) {
  if (!data) return null;

  return (
    <>
      <StatGrid
        items={[
          { label: "Active members in gym", value: String(data.summary.total_active_members) },
          { label: "Total capacity", value: String(data.summary.total_capacity) },
          { label: "Branches", value: String(data.summary.branches_count) },
        ]}
      />

      <Panel title="Session trend">
        <FitnessMetricsChart
          points={[...data.trend]
            .sort((left, right) => new Date(left.period).getTime() - new Date(right.period).getTime())
            .map((row) => ({ label: formatPeriodLabel(row.period), value: row.total_sessions }))}
          unit=" sessions"
          accent="#93c5fd"
        />
      </Panel>

      <Panel title="By branch">
        <SimpleTable
          columns={[
            { key: "branch", label: "Branch" },
            { key: "sessions", label: "Sessions", align: "right" },
            { key: "unique", label: "Unique members", align: "right" },
            { key: "open", label: "Open now", align: "right" },
            { key: "avg", label: "Avg. duration", align: "right" },
          ]}
          rows={data.by_branch.map((row) => ({
            branch: row.branch_name,
            sessions: row.total_sessions,
            unique: row.unique_members,
            open: row.open_sessions,
            avg: `${Math.round(row.average_duration_minutes)}m`,
          }))}
        />
      </Panel>
    </>
  );
}

function UsersTab({ data }: { data: UserStatistics | null }) {
  if (!data) return null;

  return (
    <>
      <StatGrid
        items={[
          { label: "Total users", value: String(data.overview.total_users) },
          { label: "Members", value: String(data.overview.members) },
          { label: "Admins", value: String(data.overview.admins) },
          { label: "New today", value: String(data.overview.new_today) },
          { label: "New this month", value: String(data.overview.new_this_month) },
        ]}
      />

      <Panel title="New users trend">
        <FitnessMetricsChart
          points={[...data.trend]
            .sort((left, right) => new Date(left.period).getTime() - new Date(right.period).getTime())
            .map((row) => ({ label: formatPeriodLabel(row.period), value: row.new_users }))}
          unit=""
          accent="#a78bfa"
        />
      </Panel>

      <Panel title="Role breakdown">
        <BreakdownBars items={data.role_breakdown.map((row) => ({ label: row.role, value: row.user_count }))} />
      </Panel>
    </>
  );
}

function WorkoutsTab({ data }: { data: WorkoutStatistics | null }) {
  if (!data) return null;

  return (
    <>
      <StatGrid
        items={[
          { label: "Total plans", value: String(data.overview.total_plans) },
          { label: "Active plans", value: String(data.overview.active_plans) },
          { label: "Customized plans", value: String(data.overview.customized_plans) },
          { label: "Total exercises", value: String(data.overview.total_exercises) },
          { label: "Total check-ins", value: String(data.overview.total_checkins) },
          { label: "Members with check-ins", value: String(data.overview.members_with_checkins) },
        ]}
      />

      <Panel title="Workout check-in trend">
        <FitnessMetricsChart
          points={[...data.checkin_trend]
            .sort((left, right) => new Date(left.period).getTime() - new Date(right.period).getTime())
            .map((row) => ({ label: formatPeriodLabel(row.period), value: row.checkin_count }))}
          unit=""
          accent="#ffd166"
        />
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Plans by goal">
          <BreakdownBars items={data.plan_goal_breakdown.map((row) => ({ label: row.goal, value: row.plan_count }))} />
        </Panel>

        <Panel title="Exercises by muscle group">
          <SimpleTable
            columns={[
              { key: "muscle", label: "Muscle group" },
              { key: "difficulty", label: "Difficulty" },
              { key: "count", label: "Count", align: "right" },
            ]}
            rows={data.exercise_breakdown.map((row) => ({
              muscle: titleCase(row.muscle_group),
              difficulty: titleCase(row.difficulty),
              count: row.exercise_count,
            }))}
          />
        </Panel>
      </div>
    </>
  );
}

function StreaksTab({ data }: { data: StreakStatistics | null }) {
  if (!data) return null;

  return (
    <>
      <StatGrid
        items={[
          { label: "Streak records", value: String(data.overview.total_streak_records) },
          { label: "Active streaks", value: String(data.overview.active_streaks) },
          { label: "Active today", value: String(data.overview.active_today) },
          { label: "At risk", value: String(data.overview.at_risk) },
          { label: "Broken", value: String(data.overview.broken) },
          { label: "Longest ever", value: `${data.overview.max_longest_streak}d` },
        ]}
      />

      <Panel title="Workout check-in trend">
        <FitnessMetricsChart
          points={[...data.checkin_trend]
            .sort((left, right) => new Date(left.period).getTime() - new Date(right.period).getTime())
            .map((row) => ({ label: formatPeriodLabel(row.period), value: row.checkin_count }))}
          unit=""
          accent="#ff7a1a"
        />
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Status breakdown">
          <BreakdownBars items={data.status_breakdown.map((row) => ({ label: row.status, value: row.streak_count }))} />
        </Panel>

        <Panel title="Top streaks">
          <SimpleTable
            columns={[
              { key: "member", label: "Member" },
              { key: "current", label: "Current", align: "right" },
              { key: "longest", label: "Longest", align: "right" },
            ]}
            rows={data.top_streaks.map((row) => ({
              member: row.full_name,
              current: `${row.current_streak}d`,
              longest: `${row.longest_streak}d`,
            }))}
          />
        </Panel>
      </div>
    </>
  );
}

function PaymentsTab({ data }: { data: PaymentStatistics | null }) {
  if (!data) return null;

  return (
    <>
      <StatGrid
        items={[
          { label: "Total payments", value: String(data.overview.total_payments) },
          { label: "Pending", value: String(data.overview.pending_payments) },
          { label: "Completed", value: String(data.overview.completed_payments) },
          { label: "Failed", value: String(data.overview.failed_payments) },
          { label: "Refunded", value: String(data.overview.refunded_payments) },
        ]}
      />

      <StatGrid
        items={[
          { label: "Completed amount", value: formatCurrency(data.overview.completed_amount) },
          { label: "Pending amount", value: formatCurrency(data.overview.pending_amount) },
          { label: "Refunded amount", value: formatCurrency(data.overview.refunded_amount) },
        ]}
      />

      <Panel title="Revenue trend">
        <FitnessMetricsChart
          points={[...data.revenue_trend]
            .sort((left, right) => new Date(left.period).getTime() - new Date(right.period).getTime())
            .map((row) => ({ label: formatPeriodLabel(row.period), value: row.total_revenue }))}
          unit=" VND"
          accent="#60a5fa"
        />
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="By status">
          <SimpleTable
            columns={[
              { key: "status", label: "Status" },
              { key: "count", label: "Count", align: "right" },
              { key: "amount", label: "Amount", align: "right" },
            ]}
            rows={data.status_breakdown.map((row) => ({
              status: titleCase(row.status),
              count: row.payment_count,
              amount: formatCurrency(row.amount),
            }))}
          />
        </Panel>

        <Panel title="By provider">
          <SimpleTable
            columns={[
              { key: "provider", label: "Provider" },
              { key: "count", label: "Count", align: "right" },
              { key: "amount", label: "Amount", align: "right" },
            ]}
            rows={data.provider_breakdown.map((row) => ({
              provider: titleCase(row.provider),
              count: row.payment_count,
              amount: formatCurrency(row.amount),
            }))}
          />
        </Panel>
      </div>
    </>
  );
}
