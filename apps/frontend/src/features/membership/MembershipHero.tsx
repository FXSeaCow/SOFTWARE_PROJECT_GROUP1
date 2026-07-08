import React from "react";

export function MembershipHero() {
  return (
    <section
      className="dashboard-card-enter"
      style={{
        marginLeft: -12,
        marginRight: -12,
        marginTop: 0,
        padding: "44px 24px 48px",
        background:
          "linear-gradient(105deg, rgba(255,106,19,0.08) 0%, rgba(255,106,19,0.03) 38%, rgba(0,0,0,0) 100%), repeating-linear-gradient(65deg, rgba(255,106,19,0.12) 0px, rgba(255,106,19,0.12) 1px, transparent 1px, transparent 36px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,106,19,0.12)",
      }}
    >
      <div
        style={{
          maxWidth: 1380,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: "8px 16px",
            borderRadius: 8,
            background: "#ff6a13",
            color: "#050505",
            fontWeight: 1000,
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 22,
          }}
        >
          Choose your level
        </div>

        <h2
          style={{
            margin: 0,
            maxWidth: 760,
            fontSize: "clamp(2.7rem, 6vw, 5.5rem)",
            lineHeight: 0.92,
            letterSpacing: "-0.07em",
            textTransform: "uppercase",
            fontWeight: 1000,
          }}
        >
          <span style={{ display: "block", color: "#f8fafc" }}>Unlock your</span>
          <span style={{ display: "block", color: "#ff6a13" }}>full potential</span>
        </h2>

        <p
          style={{
            margin: "14px 0 0",
            color: "#9ca3af",
            fontSize: 17,
            lineHeight: 1.6,
          }}
        >
          Pick the plan that fits your grind. No excuses, no limits.
        </p>
      </div>
    </section>
  );
}
