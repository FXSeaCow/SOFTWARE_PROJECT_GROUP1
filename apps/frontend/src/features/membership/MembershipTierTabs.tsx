import React from "react";

import { PlanTier } from "./types";

export function MembershipTierTabs({
  tiers,
  selectedTier,
  onSelect,
}: {
  tiers: PlanTier[];
  selectedTier: PlanTier;
  onSelect: (tier: PlanTier) => void;
}) {
  return (
    <section
      style={{
        maxWidth: 1380,
        margin: "0 auto",
        paddingBottom: 18,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 6,
          padding: 6,
          borderRadius: 18,
          background: "#1f1f1f",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {tiers.map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => onSelect(tier)}
            style={{
              minHeight: 44,
              borderRadius: 14,
              border: "none",
              background: selectedTier === tier ? "#ff6a13" : "transparent",
              color: selectedTier === tier ? "#050505" : "#8b93a0",
              fontSize: 14,
              fontWeight: 1000,
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {tier}
          </button>
        ))}
      </div>
    </section>
  );
}
