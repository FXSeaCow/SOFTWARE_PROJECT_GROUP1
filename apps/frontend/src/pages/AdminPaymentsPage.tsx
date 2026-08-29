import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  RotateCcw,
  Search,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";

import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Skeleton } from "../components/Skeleton";
import { Toast } from "../components/Toast";
import { panelStyle } from "../components/main-menu/styles";
import { FitnessMetricsChart } from "../components/progress/FitnessMetricsChart";
import { useIsMobile } from "../hooks/useIsMobile";
import { AdminPageLayout } from "../layouts/AdminPageLayout";
import {
  confirmAdminPayment,
  getAdminRevenueSummary,
  listAdminPayments,
  refundAdminPayment,
  rejectAdminPayment,
  type PaymentRecord,
  type RevenueReportRow,
} from "../services/paymentService";

type PaymentStatusFilter = PaymentRecord["status"];

const STATUS_TABS: { id: PaymentStatusFilter; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
  { id: "refunded", label: "Refunded" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusPillStyle(status: PaymentRecord["status"]): React.CSSProperties {
  const colors: Record<PaymentRecord["status"], { background: string; color: string }> = {
    pending: { background: "rgba(250,204,21,0.16)", color: "#fde68a" },
    completed: { background: "rgba(34,197,94,0.16)", color: "#86efac" },
    failed: { background: "rgba(239,68,68,0.16)", color: "#fca5a5" },
    refunded: { background: "rgba(148,163,184,0.18)", color: "#cbd5e1" },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    padding: "0 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
    ...colors[status],
  };
}

function FieldLabel({ text }: { text: string }) {
  return (
    <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 2 }}>
      {text}
    </div>
  );
}

export function AdminPaymentsPage() {
  const isMobile = useIsMobile();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [rejectingPayment, setRejectingPayment] = useState<PaymentRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  const [refundingPayment, setRefundingPayment] = useState<PaymentRecord | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);

  const [revenue, setRevenue] = useState<RevenueReportRow[]>([]);
  const [isLoadingRevenue, setIsLoadingRevenue] = useState(true);

  async function loadPayments(status: PaymentStatusFilter = statusFilter) {
    setIsLoading(true);
    setError(null);

    try {
      setPayments(await listAdminPayments(status));
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to load payment requests.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRevenue() {
    setIsLoadingRevenue(true);

    try {
      setRevenue(await getAdminRevenueSummary());
    } catch {
      setRevenue([]);
    } finally {
      setIsLoadingRevenue(false);
    }
  }

  useEffect(() => {
    void loadPayments(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    void loadRevenue();
  }, []);

  const revenueStats = useMemo(() => {
    const totalRevenue = revenue.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0);
    const totalTransactions = revenue.reduce((sum, row) => sum + Number(row.transaction_count || 0), 0);
    const chartPoints = [...revenue]
      .sort((left, right) => new Date(left.report_date).getTime() - new Date(right.report_date).getTime())
      .map((row) => ({
        label: new Date(row.report_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: Number(row.total_revenue || 0),
        date: row.report_date,
      }));

    return { totalRevenue, totalTransactions, chartPoints };
  }, [revenue]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const filteredPayments = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return payments;
    }

    return payments.filter((payment) =>
      [
        payment.user_name,
        payment.user_email,
        payment.plan_name,
        payment.admin_note,
        payment.provider_tx_id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [payments, search]);

  const stats = useMemo(() => {
    const totalPending = payments.length;
    const totalAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const uniqueMembers = new Set(payments.map((payment) => payment.user_email)).size;
    const bankTransfers = payments.filter((payment) => payment.provider === "banking").length;

    return { totalPending, totalAmount, uniqueMembers, bankTransfers };
  }, [payments]);

  async function handleApprove(paymentId: string) {
    setActivePaymentId(paymentId);
    setError(null);
    setFeedback(null);

    try {
      const approved = await confirmAdminPayment(paymentId, "Bank transfer verified");
      const nextMessage = approved.activation_code
        ? `Approved. Activation code: ${approved.activation_code}`
        : "Payment approved.";

      setFeedback(nextMessage);
      setToastMessage(nextMessage);
      await loadPayments(statusFilter);
      await loadRevenue();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to approve payment.");
    } finally {
      setActivePaymentId(null);
    }
  }

  function openRejectModal(payment: PaymentRecord) {
    setRejectingPayment(payment);
    setRejectReason("");
    setRejectError(null);
  }

  function closeRejectModal() {
    setRejectingPayment(null);
    setRejectReason("");
    setRejectError(null);
  }

  async function handleReject() {
    if (!rejectingPayment) {
      return;
    }

    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError("Please explain why this payment is being rejected.");
      return;
    }

    setActivePaymentId(rejectingPayment.id);
    setRejectError(null);
    setError(null);
    setFeedback(null);

    try {
      await rejectAdminPayment(rejectingPayment.id, reason);
      setFeedback("Payment rejected.");
      closeRejectModal();
      await loadPayments(statusFilter);
    } catch (nextError) {
      setRejectError(nextError instanceof Error ? nextError.message : "Unable to reject payment.");
    } finally {
      setActivePaymentId(null);
    }
  }

  function openRefundModal(payment: PaymentRecord) {
    setRefundingPayment(payment);
    setRefundReason("");
    setRefundError(null);
  }

  function closeRefundModal() {
    setRefundingPayment(null);
    setRefundReason("");
    setRefundError(null);
  }

  async function handleRefund() {
    if (!refundingPayment) {
      return;
    }

    const reason = refundReason.trim();
    if (!reason) {
      setRefundError("Please explain why this payment is being refunded.");
      return;
    }

    setActivePaymentId(refundingPayment.id);
    setRefundError(null);
    setError(null);
    setFeedback(null);

    try {
      await refundAdminPayment(refundingPayment.id, reason);
      setFeedback("Payment refunded.");
      closeRefundModal();
      await loadPayments(statusFilter);
      await loadRevenue();
    } catch (nextError) {
      setRefundError(nextError instanceof Error ? nextError.message : "Unable to refund payment.");
    } finally {
      setActivePaymentId(null);
    }
  }

  return (
    <AdminPageLayout activeItem="payments">
      <section style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 6 }}>Payments</div>
        <div style={{ color: "#9ca8b7", fontSize: 14 }}>
          Review pending transactions, confirm payments, and issue activation codes.
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {[
          {
            label: `${STATUS_TABS.find((tab) => tab.id === statusFilter)?.label ?? ""} requests`,
            value: stats.totalPending,
            icon: <Clock3 size={18} />,
            iconBg: "rgba(250,204,21,0.12)",
            iconColor: "#fde68a",
          },
          {
            label: `${STATUS_TABS.find((tab) => tab.id === statusFilter)?.label ?? ""} value`,
            value: formatCurrency(stats.totalAmount),
            icon: <CreditCard size={18} />,
            iconBg: "rgba(255,122,26,0.12)",
            iconColor: "#ff9a3d",
          },
          {
            label: "Members",
            value: stats.uniqueMembers,
            icon: <Users size={18} />,
            iconBg: "rgba(59,130,246,0.12)",
            iconColor: "#93c5fd",
          },
          {
            label: "Bank transfers",
            value: stats.bankTransfers,
            icon: <CheckCircle2 size={18} />,
            iconBg: "rgba(34,197,94,0.12)",
            iconColor: "#86efac",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="interactive-card dashboard-card-enter"
            style={{ ...panelStyle, padding: 18 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  background: item.iconBg,
                  color: item.iconColor,
                }}
              >
                {item.icon}
              </div>
              <div>
                <div style={{ color: "#d4d4d8", fontSize: 14, marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{item.value}</div>
              </div>
            </div>
          </div>
        ))}
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
            Revenue report
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#93c5fd" }}>
                {formatCurrency(revenueStats.totalRevenue)}
              </div>
              <div style={{ color: "#8d98a7", fontSize: 12 }}>Total revenue</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{revenueStats.totalTransactions}</div>
              <div style={{ color: "#8d98a7", fontSize: 12 }}>Completed transactions</div>
            </div>
          </div>
        </div>

        {isLoadingRevenue ? (
          <Skeleton height={140} width="100%" radius={12} />
        ) : (
          <FitnessMetricsChart
            points={revenueStats.chartPoints}
            unit=" VND"
            accent="#60a5fa"
            emptyMessage="Revenue trend will appear after there are transactions on at least two dates."
          />
        )}
      </section>

      <section className="dashboard-card-enter" style={panelStyle}>
        <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 18 }}>Payment requests</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              minHeight: 46,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 14px",
            }}
          >
            <Search size={16} color="#9ca8b7" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by member, email, plan, or transfer note"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                outline: "none",
                background: "transparent",
                color: "#f5f5f5",
                fontSize: 14,
              }}
            />
          </div>

          <Button
            type="button"
            onClick={() => void loadPayments(statusFilter)}
            style={{
              width: "auto",
              height: 46,
              background: "#ff7a1a",
              color: "#111111",
              padding: "0 28px",
            }}
          >
            Reload
          </Button>
        </div>

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

        {isMobile ? null : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1fr 1fr",
              gap: 12,
              padding: "0 12px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              color: "#9cc0e7",
              fontSize: 14,
            }}
          >
            <div>Member</div>
            <div>Plan</div>
            <div>Amount</div>
            <div>Transfer note</div>
            <div>Time</div>
            <div>Actions</div>
          </div>
        )}

        {isLoading ? (
          <div style={{ display: "grid" }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`payment-skeleton-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr 1fr 1.2fr 1fr 1fr",
                  gap: 12,
                  alignItems: "center",
                  padding: "18px 12px",
                  borderBottom: index === 4 ? "none" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <Skeleton height={16} width="48%" radius={8} />
                  <Skeleton height={14} width="72%" radius={8} />
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <Skeleton height={16} width="60%" radius={8} />
                  <Skeleton height={28} width={86} radius={999} />
                </div>
                <Skeleton height={16} width="68%" radius={8} />
                <Skeleton height={16} width="88%" radius={8} />
                <Skeleton height={16} width="74%" radius={8} />
                <div style={{ display: "flex", gap: 10 }}>
                  <Skeleton height={38} width={82} radius={12} />
                  <Skeleton height={38} width={88} radius={12} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && filteredPayments.length === 0 ? (
          <div style={{ padding: "24px 12px", color: "#9ca8b7" }}>
            No {statusFilter} payment requests.
          </div>
        ) : null}

        {!isLoading && filteredPayments.length > 0 ? (
          <div style={{ display: "grid" }}>
            {filteredPayments.map((payment, index) => (
              <div
                key={payment.id}
                style={
                  isMobile
                    ? {
                        display: "grid",
                        gap: 8,
                        padding: 14,
                        marginBottom: 10,
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background:
                          activePaymentId === payment.id ? "rgba(255,122,26,0.06)" : "rgba(255,255,255,0.02)",
                      }
                    : {
                        display: "grid",
                        gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1fr 1fr",
                        gap: 12,
                        alignItems: "center",
                        padding: "18px 12px",
                        borderBottom:
                          index === filteredPayments.length - 1
                            ? "none"
                            : "1px solid rgba(255,255,255,0.06)",
                        background:
                          activePaymentId === payment.id ? "rgba(255,122,26,0.06)" : "transparent",
                      }
                }
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>
                    {payment.user_name ?? "Unknown member"}
                  </div>
                  <div style={{ color: "#9ca8b7", fontSize: 14 }}>{payment.user_email}</div>
                </div>

                <div style={{ minWidth: 0 }}>
                  {isMobile ? <FieldLabel text="Plan" /> : null}
                  <div style={{ fontWeight: 800 }}>{payment.plan_name ?? "-"}</div>
                  <div style={{ marginTop: 8 }}>
                    <span className={payment.status === "pending" ? "pending-badge" : undefined} style={statusPillStyle(payment.status)}>
                      {payment.status}
                    </span>
                  </div>
                </div>

                <div>
                  {isMobile ? <FieldLabel text="Amount" /> : null}
                  <div style={{ fontWeight: 900 }}>{formatCurrency(payment.amount)}</div>
                </div>

                <div>
                  {isMobile ? <FieldLabel text="Transfer note" /> : null}
                  <div
                    style={{
                      color: "#fbbf24",
                      fontWeight: 800,
                      wordBreak: "break-word",
                    }}
                  >
                    {payment.admin_note || payment.provider_tx_id || "-"}
                  </div>
                </div>

                <div>
                  {isMobile ? <FieldLabel text="Time" /> : null}
                  <div style={{ color: "#d4d4d8", fontSize: 14 }}>
                    {payment.created_at ? formatDate(payment.created_at) : "-"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-start" }}>
                  {payment.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        disabled={activePaymentId === payment.id}
                        onClick={() => void handleApprove(payment.id)}
                        style={{
                          border: "none",
                          borderRadius: 12,
                          padding: "10px 14px",
                          background: "#22c55e",
                          color: "#03120a",
                          fontWeight: 900,
                          cursor: activePaymentId === payment.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {activePaymentId === payment.id ? "Processing..." : "Approve"}
                      </button>

                      <button
                        type="button"
                        disabled={activePaymentId === payment.id}
                        onClick={() => openRejectModal(payment)}
                        style={{
                          border: "none",
                          borderRadius: 12,
                          padding: "10px 14px",
                          background: "#ef4444",
                          color: "#fff7f7",
                          fontWeight: 900,
                          cursor: activePaymentId === payment.id ? "not-allowed" : "pointer",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <XCircle size={14} />
                          Reject
                        </span>
                      </button>
                    </>
                  ) : null}

                  {payment.status === "completed" ? (
                    <button
                      type="button"
                      disabled={activePaymentId === payment.id}
                      onClick={() => openRefundModal(payment)}
                      style={{
                        border: "none",
                        borderRadius: 12,
                        padding: "10px 14px",
                        background: "rgba(148,163,184,0.18)",
                        color: "#e2e8f0",
                        fontWeight: 900,
                        cursor: activePaymentId === payment.id ? "not-allowed" : "pointer",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <RotateCcw size={14} />
                        {activePaymentId === payment.id ? "Processing..." : "Refund"}
                      </span>
                    </button>
                  ) : null}

                  {payment.status === "failed" || payment.status === "refunded" ? (
                    <span style={{ color: "#8d98a7", fontSize: 13 }}>No actions</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <Modal isOpen={Boolean(rejectingPayment)} onClose={closeRejectModal}>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#f5f5f5" }}>Reject payment</div>

          {rejectingPayment ? (
            <div style={{ color: "#9ca8b7", fontSize: 14 }}>
              {rejectingPayment.user_name ?? rejectingPayment.user_email} &middot; {rejectingPayment.plan_name ?? "Membership payment"} &middot;{" "}
              {formatCurrency(Number(rejectingPayment.amount || 0))}
            </div>
          ) : null}

          <div>
            <label
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#9ca8b7",
                marginBottom: 6,
                display: "block",
              }}
            >
              Reason for rejection
            </label>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="e.g. Transfer amount doesn't match the plan price"
              maxLength={200}
              rows={3}
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                color: "#f5f5f5",
                padding: "10px 12px",
                fontSize: 14,
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>

          {rejectError ? (
            <div style={{ borderRadius: 10, padding: 10, background: "rgba(127,29,29,0.28)", color: "#fecaca", fontSize: 13 }}>
              {rejectError}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={closeRejectModal}
              disabled={activePaymentId === rejectingPayment?.id}
              style={{
                minHeight: 44,
                padding: "0 20px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "transparent",
                color: "#d3dae5",
                fontWeight: 700,
                cursor: activePaymentId === rejectingPayment?.id ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleReject()}
              disabled={activePaymentId === rejectingPayment?.id}
              style={{
                minHeight: 44,
                padding: "0 22px",
                borderRadius: 10,
                border: "none",
                background: "#ef4444",
                color: "#fff7f7",
                fontWeight: 900,
                cursor: activePaymentId === rejectingPayment?.id ? "not-allowed" : "pointer",
                opacity: activePaymentId === rejectingPayment?.id ? 0.6 : 1,
              }}
            >
              {activePaymentId === rejectingPayment?.id ? "Rejecting..." : "Reject payment"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(refundingPayment)} onClose={closeRefundModal}>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#f5f5f5" }}>Refund payment</div>

          {refundingPayment ? (
            <div style={{ color: "#9ca8b7", fontSize: 14 }}>
              {refundingPayment.user_name ?? refundingPayment.user_email} &middot; {refundingPayment.plan_name ?? "Membership payment"} &middot;{" "}
              {formatCurrency(Number(refundingPayment.amount || 0))}
            </div>
          ) : null}

          <div>
            <label
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#9ca8b7",
                marginBottom: 6,
                display: "block",
              }}
            >
              Reason for refund
            </label>
            <textarea
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              placeholder="e.g. Member cancelled within the refund window"
              maxLength={200}
              rows={3}
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                color: "#f5f5f5",
                padding: "10px 12px",
                fontSize: 14,
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>

          {refundError ? (
            <div style={{ borderRadius: 10, padding: 10, background: "rgba(127,29,29,0.28)", color: "#fecaca", fontSize: 13 }}>
              {refundError}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={closeRefundModal}
              disabled={activePaymentId === refundingPayment?.id}
              style={{
                minHeight: 44,
                padding: "0 20px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "transparent",
                color: "#d3dae5",
                fontWeight: 700,
                cursor: activePaymentId === refundingPayment?.id ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleRefund()}
              disabled={activePaymentId === refundingPayment?.id}
              style={{
                minHeight: 44,
                padding: "0 22px",
                borderRadius: 10,
                border: "none",
                background: "rgba(148,163,184,0.28)",
                color: "#e2e8f0",
                fontWeight: 900,
                cursor: activePaymentId === refundingPayment?.id ? "not-allowed" : "pointer",
                opacity: activePaymentId === refundingPayment?.id ? 0.6 : 1,
              }}
            >
              {activePaymentId === refundingPayment?.id ? "Refunding..." : "Refund payment"}
            </button>
          </div>
        </div>
      </Modal>

      {toastMessage ? <Toast message={toastMessage} /> : null}
    </AdminPageLayout>
  );
}
