import React from "react";

export type SegmentedTabOption<T extends string> = {
  value: T;
  label: string;
};

export function SegmentedTabs<T extends string>({
  ariaLabel,
  name,
  options,
  value,
  onChange,
  size = "md",
}: {
  ariaLabel: string;
  name: string;
  options: SegmentedTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  const controlHeight = size === "sm" ? 34 : 36;
  const fontSize = size === "sm" ? 13 : 14;
  const padding = size === "sm" ? "0 14px" : "0 18px";

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 6,
        background: "#ffffff",
        border: "1px solid #e3e8ee",
        borderRadius: 999,
        boxShadow: "0 1px 1px rgba(14, 17, 22, 0.04), 0 20px 40px -24px rgba(14, 17, 22, 0.18)",
        flexWrap: "wrap",
      }}
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`${name}-${option.value}`}
            onClick={() => onChange(option.value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: controlHeight,
              padding,
              borderRadius: 999,
              fontSize,
              fontWeight: 500,
              border: "none",
              whiteSpace: "nowrap",
              cursor: "pointer",
              background: isActive ? "#0e1116" : "transparent",
              color: isActive ? "#ffffff" : "#5b6472",
              boxShadow: isActive
                ? "0 1px 1px rgba(14, 17, 22, 0.06), 0 8px 18px -10px rgba(14, 17, 22, 0.5)"
                : "none",
              transition:
                "background-color 220ms cubic-bezier(0.22, 1, 0.36, 1), color 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
