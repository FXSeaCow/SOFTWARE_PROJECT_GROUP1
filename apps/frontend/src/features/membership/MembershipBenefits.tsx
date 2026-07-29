import React from "react";

import { MembershipBenefitCard } from "./types";

export function MembershipBenefits({
  benefits,
}: {
  benefits: MembershipBenefitCard[];
}) {
  return (
    <section
      style={{
        maxWidth: 1380,
        margin: "0 auto",
        padding: "20px 0",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 10,
      }}
    >
      {benefits.map((benefit) => (
        <div
          key={benefit.title}
          className="interactive-card dashboard-card-enter"
          style={{
            minHeight: 104,
            borderRadius: 18,
            background: "#151515",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            padding: 18,
          }}
        >
          <div>
            <div style={{ color: "#ff6a13", marginBottom: 10 }}>{benefit.icon}</div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 1000,
                textTransform: "uppercase",
              }}
            >
              {benefit.title}
            </div>
            <div
              style={{
                marginTop: 8,
                color: "#9ca3af",
                fontSize: 14,
              }}
            >
              {benefit.subtitle}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
