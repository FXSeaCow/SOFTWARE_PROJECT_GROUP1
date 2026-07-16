import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CreditCard,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AdminPageLayout } from "../layouts/AdminPageLayout";
import {
  listAdminAnnouncements,
  type AdminAnnouncementRecord,
} from "../services/announcementService";
import { listAdminUsers, type AdminUserRecord } from "../services/adminUserService";
import {
  confirmAdminPayment,
  listAdminPayments,
  rejectAdminPayment,
  type PaymentRecord,
} from "../services/paymentService";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatCompactDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getInitials(name?: string) {
  if (!name) {
    return "A";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getMembershipLabel(status: AdminUserRecord["membership_status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "suspended":
      return "Suspended";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}

function getMembershipColors(status: AdminUserRecord["membership_status"]) {
  switch (status) {
    case "active":
      return {
        background: "rgba(16, 185, 129, 0.14)",
        color: "#34d399",
        border: "1px solid rgba(16, 185, 129, 0.28)",
      };
    case "expired":
    case "cancelled":
      return {
        background: "rgba(239, 68, 68, 0.14)",
        color: "#f87171",
        border: "1px solid rgba(239, 68, 68, 0.28)",
      };
    default:
      return {
        background: "rgba(245, 158, 11, 0.14)",
        color: "#fbbf24",
        border: "1px solid rgba(245, 158, 11, 0.28)",
      };
  }
}

function getMonthRevenue(payments: PaymentRecord[]) {
  const now = new Date();
  return payments.reduce((sum, payment) => {
    if (payment.status !== "completed" || !payment.paid_at) {
      return sum;
    }

    const paidDate = new Date(payment.paid_at);
    if (paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear()) {
      return sum + Number(payment.amount || 0);
    }

    return sum;
  }, 0);
}

function cardStyle(borderColor: string, accentBackground: string): React.CSSProperties {
  return {
    borderRadius: 16,
    border: `1px solid ${borderColor}`,
    background: accentBackground,
    padding: 20,
    minHeight: 122,
  };
}

function actionButtonStyle(background: string, color: string, border: string): React.CSSProperties {
  return {
    borderRadius: 8,
    border,
    background,
    color,
    fontWeight: 800,
    fontSize: 14,
    padding: "8px 12px",
    cursor: "pointer",
  };
}

export function AdminConsolePage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentRecord[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncementRecord[]>([]);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setIsLoading(true);
    setError(null);

    try {
      const [usersResult, pendingPaymentsResult, completedPaymentsResult, announcementsResult] =
        await Promise.all([
          listAdminUsers(),
          listAdminPayments("pending"),
          listAdminPayments("completed"),
          listAdminAnnouncements(),
        ]);

      setUsers(usersResult.users);
      setPendingPayments(pendingPaymentsResult);
      setAllPayments([...pendingPaymentsResult, ...completedPaymentsResult]);
      setAnnouncements(announcementsResult);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to load admin dashboard data.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const overview = useMemo(() => {
    return {
      pendingCount: pendingPayments.length,
      activeMembers: users.filter((user) => user.membership_status === "active").length,
      monthlyRevenue: getMonthRevenue(allPayments),
      sentAnnouncements: announcements.length,
    };
  }, [allPayments, announcements, pendingPayments, users]);

  const latestMembers = useMemo(() => {
    return [...users]
      .sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      )
      .slice(0, 3);
  }, [users]);

  async function handleApprove(paymentId: string) {
    setActivePaymentId(paymentId);
    setError(null);
    setFeedback(null);

    try {
      await confirmAdminPayment(paymentId, "Approved from overview");
      setFeedback("Payment approved.");
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to approve payment.");
    } finally {
      setActivePaymentId(null);
    }
  }

  async function handleReject(paymentId: string) {
    setActivePaymentId(paymentId);
    setError(null);
    setFeedback(null);

    try {
      await rejectAdminPayment(paymentId, "Invalid bank transfer details");
      setFeedback("Payment rejected.");
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to reject payment.");
    } finally {
      setActivePaymentId(null);
    }
  }

  return (
    <AdminPageLayout activeItem="overview">
      <section
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          paddingBottom: 18,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 42, fontWeight: 900, letterSpacing: "-0.05em" }}>
            Overview
          </h1>
          <div style={{ marginTop: 8, color: "rgba(255,255,255,0.56)", fontSize: 15 }}>
            {formatDateLabel(new Date())}
          </div>
        </div>

        <button
          className="pending-badge"
          type="button"
          onClick={() => navigate("/admin/payments")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            minHeight: 36,
            padding: "0 16px",
            borderRadius: 8,
            border: "1px solid rgba(245, 158, 11, 0.28)",
            background: "rgba(245, 158, 11, 0.12)",
            color: "#fbbf24",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          <AlertTriangle size={15} />
          {overview.pendingCount} pending requests
        </button>
      </section>

      {error ? (
        <div
          style={{
            marginTop: 18,
            borderRadius: 14,
            padding: "12px 14px",
            background: "rgba(127, 29, 29, 0.32)",
            color: "#fecaca",
          }}
        >
          {error}
        </div>
      ) : null}

      {feedback ? (
        <div
          style={{
            marginTop: 18,
            borderRadius: 14,
            padding: "12px 14px",
            background: "rgba(6, 95, 70, 0.28)",
            color: "#bbf7d0",
          }}
        >
          {feedback}
        </div>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 18,
          marginTop: 22,
        }}
      >
        <div
          className="interactive-card dashboard-card-enter"
          style={cardStyle("rgba(245, 158, 11, 0.26)", "rgba(27, 20, 12, 0.9)")}
        >
          <OverviewCard
            title="Pending"
            value={String(overview.pendingCount)}
            subtitle="requests"
            icon={<AlertTriangle size={18} />}
            accent="#fbbf24"
          />
        </div>
        <div
          className="interactive-card dashboard-card-enter"
          style={cardStyle("rgba(16, 185, 129, 0.26)", "rgba(7, 43, 31, 0.72)")}
        >
          <OverviewCard
            title="Active members"
            value={String(overview.activeMembers)}
            subtitle={`/ ${users.length || 0}`}
            icon={<UserRound size={18} />}
            accent="#10b981"
          />
        </div>
        <div
          className="interactive-card dashboard-card-enter"
          style={cardStyle("rgba(59, 130, 246, 0.26)", "rgba(14, 22, 37, 0.88)")}
        >
          <OverviewCard
            title={`Revenue for month ${new Date().getMonth() + 1}`}
            value={formatCurrency(overview.monthlyRevenue)}
            subtitle="VND"
            icon={<CreditCard size={18} />}
            accent="#60a5fa"
          />
        </div>
        <div
          className="interactive-card dashboard-card-enter"
          style={cardStyle("rgba(168, 85, 247, 0.26)", "rgba(30, 20, 41, 0.84)")}
        >
          <OverviewCard
            title="Announcements sent"
            value={String(overview.sentAnnouncements)}
            subtitle="announcements"
            icon={<Bell size={18} />}
            accent="#a78bfa"
          />
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <SectionHeader
          title="Pending payment requests"
          actionLabel="View all"
          onAction={() => navigate("/admin/payments")}
        />

        <div
          style={{
            marginTop: 14,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.09)",
            background: "#171310",
            overflow: "hidden",
            overflowX: "auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.6fr 1.4fr 1fr 1.1fr",
              gap: 18,
              padding: "14px 18px",
              color: "rgba(255,255,255,0.48)",
              fontSize: 14,
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              minWidth: 880,
            }}
          >
            <div>Order ID</div>
            <div>Member</div>
            <div>Plan</div>
            <div>Amount</div>
            <div style={{ textAlign: "right" }}>Actions</div>
          </div>

          {isLoading ? (
            <div style={{ padding: 18, color: "rgba(255,255,255,0.56)" }}>Loading data...</div>
          ) : null}

          {!isLoading && pendingPayments.length === 0 ? (
            <div style={{ padding: 18, color: "rgba(255,255,255,0.56)" }}>
              No pending payment requests.
            </div>
          ) : null}

          {!isLoading &&
            pendingPayments.slice(0, 2).map((payment, index) => (
              <div
                key={payment.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.6fr 1.4fr 1fr 1.1fr",
                  gap: 18,
                  alignItems: "center",
                  padding: "18px",
                  minWidth: 880,
                  borderBottom:
                    index === Math.min(pendingPayments.length, 2) - 1
                      ? "none"
                      : "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div style={{ color: "rgba(255,255,255,0.58)", fontSize: 14 }}>
                  {`PAY-${payment.id.slice(0, 4).toUpperCase()}`}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#fff8ef" }}>
                    {payment.user_name ?? "Customer"}
                  </div>
                  <div style={{ marginTop: 4, color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                    {payment.user_email ?? "-"}
                  </div>
                </div>
                <div style={{ color: "rgba(255,255,255,0.66)", fontSize: 15 }}>
                  {payment.plan_name ?? "Membership plan"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fffaf2" }}>
                  {formatCurrency(payment.amount)} VND
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    disabled={activePaymentId === payment.id}
                    onClick={() => void handleApprove(payment.id)}
                    style={actionButtonStyle(
                      "rgba(16, 185, 129, 0.14)",
                      "#34d399",
                      "1px solid rgba(16, 185, 129, 0.28)",
                    )}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle2 size={14} />
                      {activePaymentId === payment.id ? "Processing" : "Approve"}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={activePaymentId === payment.id}
                    onClick={() => void handleReject(payment.id)}
                    style={actionButtonStyle(
                      "rgba(239, 68, 68, 0.14)",
                      "#f87171",
                      "1px solid rgba(239, 68, 68, 0.28)",
                    )}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <XCircle size={14} />
                      Reject
                    </span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <SectionHeader
          title="Newest members"
          actionLabel="View all"
          onAction={() => navigate("/admin/users")}
        />

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {latestMembers.map((member) => {
            const colors = getMembershipColors(member.membership_status);

            return (
              <article
                key={member.id}
                className="interactive-card dashboard-card-enter"
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.09)",
                  background: "#171310",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.07)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    color: "#fff5e6",
                    flexShrink: 0,
                  }}
                >
                  {getInitials(member.full_name)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#fffaf2" }}>
                    {member.full_name}
                  </div>
                  <div style={{ marginTop: 4, color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                    {formatCompactDate(member.created_at)}
                  </div>
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 28,
                    padding: "0 12px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    ...colors,
                  }}
                >
                  {getMembershipLabel(member.membership_status)}
                </span>
              </article>
            );
          })}
        </div>
      </section>
    </AdminPageLayout>
  );
}

function OverviewCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, height: "100%" }}>
      <div>
        <div style={{ color: "rgba(255,255,255,0.56)", fontSize: 15 }}>{title}</div>
        <div style={{ marginTop: 14, fontSize: 24, fontWeight: 900, color: accent }}>{value}</div>
        <div style={{ marginTop: 8, color: "rgba(255,255,255,0.56)", fontSize: 14 }}>{subtitle}</div>
      </div>
      <div style={{ color: accent }}>{icon}</div>
    </div>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#fff8ef" }}>{title}</h2>
      <button
        type="button"
        onClick={onAction}
        style={{
          border: "none",
          background: "transparent",
          color: "#ff8a1f",
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {actionLabel} →
      </button>
    </div>
  );
}
