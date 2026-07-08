import React from "react";

type ButtonVariant = "primary" | "outline" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  variant?: ButtonVariant;
  leftIcon?: React.ReactNode;
  loadingText?: string;
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "#07031a",
    color: "#ffffff",
    border: "none",
  },
  outline: {
    background: "#ffffff",
    color: "#050816",
    border: "1px solid #e0e0e6",
  },
  ghost: {
    background: "transparent",
    color: "#050816",
    border: "none",
  },
};

export function Button({
  children,
  isLoading = false,
  disabled,
  style,
  className,
  variant = "primary",
  leftIcon,
  loadingText = "Signing in...",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      {...props}
      className={className}
      disabled={isDisabled}
      style={{
        width: "100%",
        height: 52,
        borderRadius: 12,
        padding: "0 18px",
        fontSize: 16,
        fontWeight: 700,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.7 : 1,
        transition: "opacity 0.2s ease, transform 0.2s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {leftIcon && !isLoading ? (
        <span
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          {leftIcon}
        </span>
      ) : null}

      {isLoading ? loadingText : children}
    </button>
  );
}
