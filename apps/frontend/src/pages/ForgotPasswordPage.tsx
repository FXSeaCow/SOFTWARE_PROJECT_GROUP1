import React, { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { forgotPassword } from "../services/authService";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setResetLink(null);

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await forgotPassword({ email: email.trim() });
      setSuccess(result.message);
      setResetLink(result.resetLink ?? null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to send reset email. Please try again.",
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
          <h1 style={{ margin: 0, fontSize: 24, color: "#050816" }}>Forgot password</h1>
          <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.5 }}>
            Enter your email and we will send a reset link if the account exists.
          </p>
        </div>

        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          error={error ?? undefined}
          leftIcon={<Mail size={20} />}
          onChange={(event) => setEmail(event.target.value)}
        />

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

        {resetLink ? (
          <div
            style={{
              borderRadius: 12,
              padding: "12px 14px",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: 14,
              lineHeight: 1.5,
              wordBreak: "break-word",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Development reset link</div>
            <a href={resetLink} style={{ color: "#1d4ed8" }}>
              {resetLink}
            </a>
          </div>
        ) : null}

        <Button type="submit" isLoading={isSubmitting} loadingText="Sending reset link...">
          Send reset link
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
