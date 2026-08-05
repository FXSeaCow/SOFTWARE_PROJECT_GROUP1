import React from "react";

import { useIsMobile } from "../hooks/useIsMobile";

export function DashboardLayout({
  children,
  bottomNav,
}: {
  children: React.ReactNode;
  bottomNav?: React.ReactNode;
}) {
  const isMobile = useIsMobile(768);

  return (
    <main
      style={{
        minHeight: "100vh",
        overflowX: "hidden",
        background:
          "radial-gradient(circle at top center, rgba(255,122,26,0.12), transparent 22%), linear-gradient(180deg, #090909 0%, #050505 100%)",
        color: "#f5f5f5",
        fontFamily:
          'Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <style>
        {`
          @keyframes dashboardCardIn {
            0% {
              opacity: 0;
              transform: translateY(14px) scale(0.985);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes pendingPulse {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.16);
              filter: saturate(1);
            }
            50% {
              box-shadow: 0 0 0 6px rgba(250, 204, 21, 0.02);
              filter: saturate(1.2);
            }
          }

          @keyframes skeletonShimmer {
            0% {
              background-position: 100% 0;
            }
            100% {
              background-position: -100% 0;
            }
          }

          .interactive-card {
            transition:
              transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 220ms ease,
              border-color 220ms ease,
              background 220ms ease;
            will-change: transform;
          }

          .interactive-card:hover {
            transform: translateY(-6px);
            box-shadow: 0 28px 60px rgba(0,0,0,0.28);
            border-color: rgba(255,122,26,0.16);
          }

          .dashboard-card-enter {
            animation: dashboardCardIn 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }

          .nav-pill {
            transition:
              background 220ms ease,
              color 220ms ease,
              transform 160ms ease;
          }

          .pending-badge {
            animation: pendingPulse 1.8s ease-in-out infinite;
          }

          .skeleton-shimmer {
            background: linear-gradient(
              90deg,
              rgba(255,255,255,0.05) 0%,
              rgba(255,255,255,0.11) 50%,
              rgba(255,255,255,0.05) 100%
            );
            background-size: 200% 100%;
            animation: skeletonShimmer 1.35s linear infinite;
          }

          button {
            transition:
              transform 160ms ease,
              background 220ms ease,
              color 220ms ease,
              border-color 220ms ease,
              box-shadow 220ms ease,
              opacity 200ms ease;
          }

          button:not(:disabled):active {
            transform: scale(0.98);
          }
        `}
      </style>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: isMobile ? "0 16px 112px" : "18px 12px 32px",
        }}
      >
        {children}
      </div>
      {bottomNav}
    </main>
  );
}
