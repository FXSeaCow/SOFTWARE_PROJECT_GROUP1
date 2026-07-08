import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { AdminTopBar, type AdminTopBarItem } from "../components/AdminTopBar";

export function AdminPageLayout({
  activeItem,
  children,
}: {
  activeItem: AdminTopBarItem;
  children: React.ReactNode;
}) {
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.innerWidth < 960);
  const location = useLocation();

  useEffect(() => {
    function handleResize() {
      setIsMobileLayout(window.innerWidth < 960);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0908",
        color: "#f5efe6",
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

          @keyframes modalBackdropIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes modalPanelIn {
            from {
              opacity: 0;
              transform: scale(0.96) translateY(10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }

          @keyframes adminPageEnter {
            0% {
              opacity: 0;
              transform: translateY(12px) scale(0.985);
              filter: blur(6px);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }

          @keyframes adminBarEnter {
            0% {
              opacity: 0;
              transform: translateY(-10px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
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

          .modal-backdrop {
            animation: modalBackdropIn 180ms ease both;
          }

          .modal-panel {
            animation: modalPanelIn 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
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
      <AdminTopBar activeItem={activeItem} isMobileLayout={isMobileLayout} />
      <main
        key={location.pathname}
        style={{
          padding: isMobileLayout ? "18px 14px 26px" : "18px 26px 30px",
          animation: "adminPageEnter 300ms cubic-bezier(0.22, 1, 0.36, 1)",
          transformOrigin: "top center",
          willChange: "transform, opacity, filter",
        }}
      >
        {children}
      </main>
    </div>
  );
}
