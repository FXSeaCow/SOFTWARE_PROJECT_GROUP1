import React from "react";
import { Banknote, Landmark } from "lucide-react";

import { PaymentRecord } from "../../services/paymentService";

import { formatDate, formatPrice } from "./utils";

const STATUS_STYLES: Record<PaymentRecord["status"], { background: string; color: string; label: string }> = {
  completed: { background: "rgba(34,197,94,0.16)", color: "#86efac", label: "Completed" },
  pending: { background: "rgba(245,158,11,0.16)", color: "#fbbf24", label: "Pending" },
  failed: { background: "rgba(239,68,68,0.16)", color: "#fca5a5", label: "Failed" },
  refunded: { background: "rgba(148,163,184,0.16)", color: "#cbd5e1", label: "Refunded" },
};

export function MembershipPaymentHistory({ payments }: { payments: PaymentRecord[] }) {
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
      <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca8b7", marginBottom: 14 }}>
        Payment history
      </div>

      {payments.length === 0 ? (
        <div style={{ color: "#9ca3af", fontSize: 14 }}>No payments yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {payments.map((payment) => {
            const status = STATUS_STYLES[payment.status];
            return (
              <div
                key={payment.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.03)",
                  padding: "14px 16px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#f8fafc" }}>
                    {payment.plan_name ?? "Membership payment"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca8b7", fontSize: 12, marginTop: 4 }}>
                    {payment.provider === "cash" ? <Banknote size={13} /> : <Landmark size={13} />}
                    <span>{payment.provider === "cash" ? "Cash" : "Bank transfer"}</span>
                    <span>&middot;</span>
                    <span>{formatDate(payment.paid_at ?? payment.created_at)}</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, color: "#f8fafc" }}>{formatPrice(payment.amount)}</div>
                  <span
                    style={{
                      borderRadius: 999,
                      padding: "5px 12px",
                      fontSize: 11,
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      ...status,
                    }}
                  >
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
