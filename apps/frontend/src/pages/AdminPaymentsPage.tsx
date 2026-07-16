import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Toast } from "../components/Toast";
import { panelStyle } from "../components/main-menu/styles";
import { AdminPageLayout } from "../layouts/AdminPageLayout";
import {
  confirmAdminPayment,
  listAdminPayments,
  rejectAdminPayment,
  type PaymentRecord,
} from "../services/paymentService";

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

function statusPillStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    padding: "0 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    background: "rgba(250,204,21,0.16)",
    color: "#fde68a",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  };
}

export function AdminPaymentsPage() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function loadPayments() {
    setIsLoading(true);
    setError(null);

    try {
      setPayments(await listAdminPayments("pending"));
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to load payment requests.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPayments();
  }, []);

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
      await loadPayments();
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
      await rejectAdminPayment(paymentId, "Bank transfer details do not match");
      setFeedback("Payment rejected.");
      await loadPayments();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to reject payment.");
    } finally {
      setActivePaymentId(null);
    }
  }

  return (
    <AdminPageLayout activeItem="payments">
      <section
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 6 }}>Payments</div>
          <div style={{ color: "#9ca8b7", fontSize: 14 }}>
            Review pending transactions, confirm payments, and issue activation codes.
          </div>
        </div>

        <Button
          type="button"
          onClick={() => navigate("/admin")}
          style={{
            width: "auto",
            height: 46,
            background: "#ff7a1a",
            color: "#111111",
          }}
          leftIcon={<ShieldCheck size={16} />}
        >
          Back to overview
        </Button>
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
            label: "Pending requests",
            value: stats.totalPending,
            icon: <Clock3 size={18} />,
            iconBg: "rgba(250,204,21,0.12)",
            iconColor: "#fde68a",
          },
          {
            label: "Pending value",
            value: formatCurrency(stats.totalAmount),
            icon: <CreditCard size={18} />,
            iconBg: "rgba(255,122,26,0.12)",
            iconColor: "#ff9a3d",
          },
          {
            label: "Members waiting",
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

      <section className="dashboard-card-enter" style={panelStyle}>
        <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 18 }}>Payment requests</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto auto",
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

          <div
            className="pending-badge"
            style={{
              minHeight: 46,
              minWidth: 142,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fde68a",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            Pending only
          </div>

          <Button
            type="button"
            onClick={() => void loadPayments()}
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

        {isLoading ? (
          <div style={{ display: "grid" }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`payment-skeleton-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1fr 1fr",
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
            No pending payment requests.
          </div>
        ) : null}

        {!isLoading && filteredPayments.length > 0 ? (
          <div style={{ display: "grid" }}>
            {filteredPayments.map((payment, index) => (
              <div
                key={payment.id}
                style={{
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
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>
                    {payment.user_name ?? "Unknown member"}
                  </div>
                  <div style={{ color: "#9ca8b7", fontSize: 14 }}>{payment.user_email}</div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{payment.plan_name ?? "-"}</div>
                  <div style={{ marginTop: 8 }}>
                    <span className="pending-badge" style={statusPillStyle()}>
                      Pending
                    </span>
                  </div>
                </div>

                <div style={{ fontWeight: 900 }}>{formatCurrency(payment.amount)}</div>

                <div
                  style={{
                    color: "#fbbf24",
                    fontWeight: 800,
                    wordBreak: "break-word",
                  }}
                >
                  {payment.admin_note || payment.provider_tx_id || "-"}
                </div>

                <div style={{ color: "#d4d4d8", fontSize: 14 }}>
                  {payment.created_at ? formatDate(payment.created_at) : "-"}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-start" }}>
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
                    onClick={() => void handleReject(payment.id)}
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
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {toastMessage ? <Toast message={toastMessage} /> : null}
    </AdminPageLayout>
  );
}
