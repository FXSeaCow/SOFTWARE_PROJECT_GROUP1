import React from "react";
import { Bell } from "lucide-react";

import { iconButtonStyle } from "./styles";

export function MainMenuHeader({
  displayName,
  profileInitials,
  isProfileMenuOpen,
  onProfileClick,
  onLogoutClick,
}: {
  displayName: string;
  profileInitials: string;
  isProfileMenuOpen: boolean;
  onProfileClick: () => void;
  onLogoutClick: () => void;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        paddingBottom: 18,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 18,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.48)",
            marginBottom: 8,
          }}
        >
          Good Morning
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2rem, 3.6vw, 3rem)",
            lineHeight: 0.92,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            textTransform: "uppercase",
          }}
        >
          {displayName}
        </h1>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
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
              background: "#ff7a1a",
            }}
          />
        </button>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={onProfileClick}
            aria-label="Open profile menu"
            title="Open profile menu"
            style={{
              ...iconButtonStyle,
              width: 48,
              borderRadius: "50%",
              background: "#ff7a1a",
              color: "#111111",
              fontWeight: 900,
              fontSize: 20,
            }}
          >
            {profileInitials}
          </button>

          {isProfileMenuOpen ? (
            <div
              style={{
                position: "absolute",
                top: 58,
                right: 0,
                minWidth: 180,
                padding: 10,
                borderRadius: 16,
                background: "rgba(20,20,20,0.98)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 18px 40px rgba(0,0,0,0.3)",
                zIndex: 20,
              }}
            >
              <button
                type="button"
                onClick={onLogoutClick}
                style={{
                  width: "100%",
                  minHeight: 44,
                  border: "none",
                  borderRadius: 12,
                  background: "#ff7a1a",
                  color: "#111111",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
