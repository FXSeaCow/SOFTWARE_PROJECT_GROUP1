import React from "react";

export function DashboardLayout({
  children,
  bottomNav,
}: {
  children: React.ReactNode;
  bottomNav?: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top center, rgba(255,122,26,0.12), transparent 22%), linear-gradient(180deg, #090909 0%, #050505 100%)",
        color: "#f5f5f5",
        fontFamily:
          'Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "18px 12px 112px",
        }}
      >
        {children}
      </div>
      {bottomNav}
    </main>
  );
}
