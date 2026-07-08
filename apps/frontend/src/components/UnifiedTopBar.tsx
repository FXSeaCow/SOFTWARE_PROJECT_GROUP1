import React from "react";

export type UnifiedTopBarItem = {
  id: string;
  label: string;
  onClick?: () => void;
  active?: boolean;
  trailing?: React.ReactNode;
};

export function UnifiedTopBar({
  items,
  rightSlot,
  isStacked = false,
}: {
  items: UnifiedTopBarItem[];
  rightSlot?: React.ReactNode;
  isStacked?: boolean;
}) {
  return (
    <aside
      style={{
        position: "relative",
        zIndex: 2,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          display: "flex",
          alignItems: isStacked ? "stretch" : "center",
          justifyContent: "space-between",
          gap: 22,
          padding: "16px 22px",
          borderRadius: 30,
          background: "rgba(11,11,11,0.9)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 22px 50px rgba(0,0,0,0.34)",
          backdropFilter: "blur(18px)",
          flexDirection: isStacked ? "column" : "row",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: "linear-gradient(180deg, rgba(255,122,26,0.22), rgba(255,122,26,0.08))",
              border: "1px solid rgba(255,122,26,0.28)",
              display: "grid",
              placeItems: "center",
              color: "#ff7a1a",
              fontSize: 17,
              fontWeight: 900,
              letterSpacing: "-0.08em",
            }}
          >
            GYM
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 8,
            flex: 1,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className="nav-pill"
              style={{
                minHeight: 42,
                borderRadius: 999,
                border: "none",
                background: item.active ? "rgba(255,122,26,0.1)" : "transparent",
                color: item.active ? "#fff3e7" : "rgba(245,245,245,0.72)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 16px",
                fontSize: 14,
                fontWeight: item.active ? 800 : 700,
                cursor: item.onClick ? "pointer" : "default",
                textAlign: "left",
                whiteSpace: "nowrap",
              }}
            >
              <span>{item.label}</span>
              {item.trailing ?? null}
            </button>
          ))}
        </div>

        {rightSlot ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexShrink: 0,
              flexWrap: isStacked ? "wrap" : "nowrap",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 1,
                alignSelf: "stretch",
                background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.16), transparent)",
              }}
            />
            {rightSlot}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
