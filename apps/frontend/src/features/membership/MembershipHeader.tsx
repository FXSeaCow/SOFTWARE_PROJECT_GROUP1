import React from "react";
import { Bell } from "lucide-react";

import { iconButtonStyle } from "../../components/main-menu/styles";

function menuButtonStyle(primary = false): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 44,
    border: primary ? "none" : "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    background: primary ? "#ff6a13" : "rgba(255,255,255,0.04)",
    color: primary ? "#050505" : "#f8fafc",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  };
}

export function MembershipHeader({
  initials,
  isProfileMenuOpen,
  onProfileClick,
  onMembershipClick,
  onAccountClick,
  onAdminClick,
  showAdminEntry = false,
  onLogoutClick,
}: {
  initials: string;
  isProfileMenuOpen: boolean;
  onProfileClick: () => void;
  onMembershipClick: () => void;
  onAccountClick: () => void;
  onAdminClick?: () => void;
  showAdminEntry?: boolean;
  onLogoutClick: () => void;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        paddingBottom: 18,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 0,
      }}
    >
      <div>
        <div
          style={{
            color: "#9ca3af",
            fontSize: 14,
            letterSpacing: "0.22em",
            fontWeight: 700,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Ironcore Gym
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: 0.95,
            fontWeight: 1000,
            letterSpacing: "-0.06em",
            textTransform: "uppercase",
          }}
        >
          Membership
        </h1>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <button type="button" aria-label="Notifications" style={iconButtonStyle}>
          <Bell size={18} />
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#ff6a13",
            }}
          />
        </button>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={onProfileClick}
            style={{
              ...iconButtonStyle,
              width: 48,
              borderRadius: "50%",
              background: "#ff6a13",
              color: "#050505",
              fontWeight: 1000,
              fontSize: 16,
            }}
          >
            {initials}
          </button>

          {isProfileMenuOpen ? (
            <div
              style={{
                position: "absolute",
                top: 58,
                right: 0,
                minWidth: 180,
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                borderRadius: 16,
                background: "rgba(20,20,20,0.98)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 18px 40px rgba(0,0,0,0.3)",
                zIndex: 20,
              }}
            >
              <button type="button" onClick={onMembershipClick} style={menuButtonStyle()}>
                Membership
              </button>
              <button type="button" onClick={onAccountClick} style={menuButtonStyle()}>
                Account
              </button>
              {showAdminEntry && onAdminClick ? (
                <button
                  type="button"
                  onClick={onAdminClick}
                  style={{
                    ...menuButtonStyle(),
                    border: "1px solid rgba(255,122,26,0.28)",
                    background: "rgba(255,122,26,0.12)",
                    color: "#ffb15f",
                  }}
                >
                  Admin Console
                </button>
              ) : null}
              <button type="button" onClick={onLogoutClick} style={menuButtonStyle(true)}>
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
