import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
  rightLabel?: React.ReactNode;
};

export function Input({
  label,
  error,
  style,
  leftIcon,
  rightIcon,
  onRightIconClick,
  rightLabel,
  ...props
}: InputProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <label
          htmlFor={props.id || props.name}
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#050816",
          }}
        >
          {label}
        </label>

        {rightLabel ? (
          <div
            style={{
              fontSize: 13,
              color: "#667085",
            }}
          >
            {rightLabel}
          </div>
        ) : null}
      </div>

      <div
        style={{
          width: "100%",
          height: 48,
          border: `1px solid ${error ? "#ef4444" : "#d7d7df"}`,
          borderRadius: 12,
          background: "#f4f4f6",
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          boxSizing: "border-box",
        }}
      >
        {leftIcon ? (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              color: "#8a8fa3",
              marginRight: 10,
            }}
          >
            {leftIcon}
          </span>
        ) : null}

        <input
          {...props}
          id={props.id || props.name}
          style={{
            flex: 1,
            width: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 15,
            color: "#050816",
            minWidth: 0,
            ...style,
          }}
        />

        {rightIcon ? (
          <button
            type="button"
            onClick={onRightIconClick}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              marginLeft: 10,
              display: "flex",
              alignItems: "center",
              color: "#8a8fa3",
              cursor: onRightIconClick ? "pointer" : "default",
            }}
          >
            {rightIcon}
          </button>
        ) : null}
      </div>

      {error ? (
        <span
          style={{
            color: "#dc2626",
            fontSize: 13,
          }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}