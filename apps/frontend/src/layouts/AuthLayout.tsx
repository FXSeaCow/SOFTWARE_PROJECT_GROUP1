import React from "react";

import { Card } from "../components/Card";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at top, #fde68a 0%, #f8fafc 40%, #e2e8f0 100%)",
      }}
    >
      <Card>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 28,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#ea580c",
            }}
          >
            Gym Web
          </span>

          <h1
            style={{
              margin: 0,
              fontSize: 32,
              lineHeight: 1.1,
              color: "#0f172a",
            }}
          >
            {title}
          </h1>

          <p
            style={{
              margin: 0,
              color: "#475569",
              lineHeight: 1.6,
            }}
          >
            {subtitle}
          </p>
        </div>

        {children}
      </Card>
    </main>
  );
}
