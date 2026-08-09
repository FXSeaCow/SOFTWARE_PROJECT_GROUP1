import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";

import { NotificationBell } from "../NotificationBell";

export type MobileNavLink = {
  id: string;
  label: string;
  to: string;
  active?: boolean;
};

export function MainMenuMobileHeader({
  navLinks,
  profileInitials,
  profileHref,
}: {
  navLinks: MobileNavLink[];
  profileInitials: string;
  profileHref: string;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        height: 76,
        padding: "0 16px",
        marginLeft: -12,
        marginRight: -12,
        marginBottom: 16,
        background: "rgba(5,5,5,0.96)",
        borderBottom: "1px solid #2a2a2a",
        backdropFilter: "blur(18px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={() => setIsMenuOpen((current) => !current)}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          title={isMenuOpen ? "Close menu" : "Open menu"}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: "1px solid #2a2a2a",
            background: "#111111",
            color: "#f5f5f5",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "linear-gradient(180deg, rgba(255,122,26,0.22), rgba(255,122,26,0.08))",
            border: "1px solid rgba(255,122,26,0.28)",
            display: "grid",
            placeItems: "center",
            color: "#ff7a1a",
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: "-0.08em",
          }}
        >
          GYM
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <NotificationBell />

        <Link to={profileHref} aria-label="Open account" title="Open account">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#ff7a1a",
              color: "#111111",
              display: "grid",
              placeItems: "center",
              fontWeight: 900,
              fontSize: 16,
            }}
          >
            {profileInitials}
          </div>
        </Link>
      </div>

      {isMenuOpen ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "#111111",
            borderBottom: "1px solid #2a2a2a",
            boxShadow: "0 18px 40px rgba(0,0,0,0.4)",
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.id}
              to={link.to}
              onClick={() => setIsMenuOpen(false)}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 14px",
                  borderRadius: 12,
                  border: link.active ? "1px solid rgba(255,122,26,0.3)" : "1px solid #2a2a2a",
                  background: link.active ? "rgba(255,122,26,0.12)" : "#171717",
                  color: link.active ? "#ffb15f" : "#f5f5f5",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                {link.label}
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
