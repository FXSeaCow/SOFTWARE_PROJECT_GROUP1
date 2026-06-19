import React from "react";
import { Check, ChevronRight } from "lucide-react";

import { CurrentMembership, MembershipPlan } from "../../services/membershipService";

import { MembershipTierContent } from "./types";
import { formatDate, formatPrice } from "./utils";

export function MembershipFeaturedPlan({
  isLoading,
  currentUser,
  currentMembership,
  activePlan,
  activeTierContent,
  isRenewing,
  onPrimaryAction,
}: {
  isLoading: boolean;
  currentUser: { id: string; email: string; name: string } | null;
  currentMembership: CurrentMembership | null;
  activePlan: MembershipPlan | null;
  activeTierContent: MembershipTierContent;
  isRenewing: boolean;
  onPrimaryAction: () => void;
}) {
  const planTitle = activePlan?.name || activeTierContent.title;
  const planSubtitle = activePlan?.description || activeTierContent.subtitle;
  const planPrice = activePlan?.price ?? activeTierContent.fallbackPrice;
  const hasRealPlan = Boolean(activePlan);
  const isCurrentPlanActive =
    currentMembership != null && currentMembership.plan_id === activePlan?.id;
  const statusText =
    isCurrentPlanActive
      ? `Active until ${formatDate(currentMembership.end_date)}`
      : currentUser
        ? hasRealPlan
          ? "Ready to activate"
          : "Preview mode"
        : "Login required";

  return (
    <div
      style={{
        paddingBottom: 24,
      }}
    >
      <div
        style={{
          borderRadius: 24,
          background: "#151515",
          border: "1px solid #ff6a13",
          borderTopWidth: 3,
          padding: 24,
        }}
      >
        {isLoading ? (
          <div style={{ color: "#9ca3af", fontSize: 15 }}>Loading membership plans...</div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 20,
                flexWrap: "wrap",
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 16,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(255,106,19,0.16)",
                    color: "#ff6a13",
                  }}
                >
                  {activeTierContent.icon}
                </div>

                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 30,
                      lineHeight: 1,
                      fontWeight: 1000,
                      textTransform: "uppercase",
                      letterSpacing: "-0.05em",
                    }}
                  >
                    {planTitle}
                  </h3>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#9ca3af",
                      fontSize: 14,
                    }}
                  >
                    {planSubtitle}
                  </p>
                </div>
              </div>

              <div
                style={{
                  color: isCurrentPlanActive ? "#22c55e" : "#f59e0b",
                  fontSize: 13,
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              >
                {statusText}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  color: "#ff6a13",
                  fontSize: "clamp(3.2rem, 7vw, 4.9rem)",
                  lineHeight: 0.9,
                  fontWeight: 1000,
                  letterSpacing: "-0.06em",
                }}
              >
                {formatPrice(planPrice)}
              </span>

              <span
                style={{
                  color: "#9ca3af",
                  fontSize: 18,
                  paddingBottom: 8,
                }}
              >
                {activeTierContent.unit}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
                maxWidth: 480,
                marginBottom: 26,
              }}
            >
              {activeTierContent.features.map((feature) => (
                <div
                  key={feature}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: 750,
                    color: "#f8fafc",
                    fontSize: 16,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "rgba(255,106,19,0.22)",
                      color: "#ff6a13",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Check size={12} />
                  </span>
                  {feature}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onPrimaryAction}
              disabled={isRenewing || !hasRealPlan}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 18,
                padding: "20px 22px",
                background: "linear-gradient(135deg, #ff7a18, #f04b05)",
                color: "#050505",
                cursor: isRenewing || !hasRealPlan ? "not-allowed" : "pointer",
                fontWeight: 1000,
                fontSize: 18,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                opacity: isRenewing || !hasRealPlan ? 0.75 : 1,
              }}
            >
              {isRenewing
                ? "Processing..."
                : !hasRealPlan
                  ? "Plan unavailable"
                  : currentUser
                    ? `Get started - ${formatPrice(planPrice)}`
                    : "Login to continue"}{" "}
              <ChevronRight size={18} style={{ verticalAlign: "middle" }} />
            </button>

            <p
              style={{
                margin: "12px 0 0",
                textAlign: "center",
                color: "#9ca3af",
                fontSize: 13,
              }}
            >
              {hasRealPlan
                ? "No hidden fees. Cancel anytime."
                : "Preview content is shown until plan data is available from the backend."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
