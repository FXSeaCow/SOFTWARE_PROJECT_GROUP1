import React from "react";

import { MembershipPlan } from "../../services/membershipService";

import { MembershipTierContent, PlanTier } from "./types";
import { formatPrice, inferTier } from "./utils";

export function MembershipComparePlans({
  featuredPlan,
  plans,
  selectedPlanId,
  tierContent,
  onSelectPlan,
}: {
  featuredPlan?: React.ReactNode;
  plans: MembershipPlan[];
  selectedPlanId: string | null;
  tierContent: Record<PlanTier, MembershipTierContent>;
  onSelectPlan: (planId: string) => void;
}) {
  return (
    <section
      style={{
        maxWidth: 1380,
        margin: "0 auto",
        paddingBottom: 28,
      }}
    >
      {featuredPlan}

      <h2
        style={{
          margin: "0 0 14px",
          fontSize: 17,
          fontWeight: 1000,
          textTransform: "uppercase",
          letterSpacing: "-0.04em",
        }}
      >
        Compare Plans
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {plans.map((plan) => {
          const tier = inferTier(plan);
          const content = tierContent[tier];
          const isSelected = selectedPlanId === plan.id;

          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelectPlan(plan.id)}
              style={{
                minHeight: 180,
                borderRadius: 20,
                padding: 20,
                textAlign: "center",
                background: isSelected
                  ? "linear-gradient(135deg, rgba(62,31,10,0.96), rgba(47,22,6,0.96))"
                  : "#151515",
                border: isSelected
                  ? "1px solid #ff6a13"
                  : "1px solid rgba(255,255,255,0.1)",
                color: "#f8fafc",
                cursor: "pointer",
                boxShadow: isSelected
                  ? "inset 0 1px 0 rgba(255,255,255,0.04)"
                  : "none",
                }}
              >
                <div
                style={{
                  color: isSelected ? "#ff6a13" : "#6b7280",
                  marginBottom: 12,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {content.icon}
              </div>

              <div
                style={{
                  fontSize: 14,
                  fontWeight: 1000,
                  textTransform: "uppercase",
                  marginBottom: 6,
                  letterSpacing: "-0.02em",
                }}
                >
                  {plan.name || content.title}
                </div>

                <div
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    marginBottom: 14,
                  }}
                >
                  {plan.description || content.subtitle}
                </div>

                <div
                style={{
                  color: isSelected ? "#ff6a13" : "#9ca3af",
                  fontSize: 32,
                  lineHeight: 1,
                  fontWeight: 1000,
                  letterSpacing: "-0.05em",
                  marginBottom: 8,
                }}
              >
                {formatPrice(plan.price ?? content.fallbackPrice)}
              </div>

              <div
                style={{
                  color: "#9ca3af",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {content.unit}
              </div>

              {content.badge ? (
                <div
                  style={{
                    display: "inline-flex",
                    marginTop: 10,
                    padding: "5px 8px",
                    borderRadius: 6,
                    background: "#ff6a13",
                    color: "#050505",
                    fontSize: 10,
                    fontWeight: 1000,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {content.badge}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
