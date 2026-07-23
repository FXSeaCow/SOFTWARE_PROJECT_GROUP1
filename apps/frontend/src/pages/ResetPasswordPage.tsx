import React, { FormEvent, useMemo, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { resetPassword } from "../services/authService";

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(
    () => new URLSearchParams(location.search).get("token")?.trim() ?? "",
    [location.search],
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!token) {
    return <Navigate to="/forgot-password" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!password.trim()) {
      setError("New password is required");
      return;
    }

    if (password.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError("New password must contain at least 1 uppercase letter");
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError("New password must contain at least 1 number");
      return;
    }

    if (confirmPassword !== password) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const message = await resetPassword({
        token,
        password,
        confirm_password: confirmPassword,
      });

      setSuccess(message);
      window.setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: {
            success: "Password reset successfully. Please sign in.",
          },
        });
      }, 1200);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to reset password. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#ffffff",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "48px 24px",
        boxSizing: "border-box",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: "#050816" }}>Reset password</h1>
          <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.5 }}>
            Enter and confirm your new password.
          </p>
        </div>

        <Input
          label="New password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="********"
          value={password}
          leftIcon={<Lock size={20} />}
          rightIcon={showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          onRightIconClick={() => setShowPassword((current) => !current)}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Input
          label="Confirm password"
          name="confirmPassword"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="********"
          value={confirmPassword}
          leftIcon={<Lock size={20} />}
          rightIcon={showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          onRightIconClick={() => setShowConfirmPassword((current) => !current)}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />

        {error ? (
          <div
            style={{
              borderRadius: 12,
              padding: "12px 14px",
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            style={{
              borderRadius: 12,
              padding: "12px 14px",
              background: "#dcfce7",
              color: "#166534",
              fontSize: 14,
            }}
          >
            {success}
          </div>
        ) : null}

        <Button type="submit" isLoading={isSubmitting}>
          Save new password
        </Button>

        <p style={{ margin: 0, textAlign: "center", color: "#667085", fontSize: 14 }}>
          Back to{" "}
          <Link
            to="/login"
            style={{
              color: "#050816",
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
