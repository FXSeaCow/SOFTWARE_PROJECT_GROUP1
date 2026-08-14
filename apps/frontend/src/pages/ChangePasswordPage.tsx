import React, { FormEvent, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { changeMyPassword } from "../services/userService";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword.trim()) {
      setError("Current password is required");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError("New password must contain at least 1 uppercase letter");
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError("New password must contain at least 1 number");
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from the current password");
      return;
    }

    if (confirmPassword !== newPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const message = await changeMyPassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      });

      setSuccess(message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to change password. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "48px auto",
          background: "#fff",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>Change password</h1>
          <p style={{ color: "#475569", margin: "8px 0 0" }}>
            Update your password without moving other account features yet.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <Input
            label="Current password"
            name="currentPassword"
            type={showCurrentPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="********"
            value={currentPassword}
            leftIcon={<Lock size={20} />}
            rightIcon={showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            onRightIconClick={() => setShowCurrentPassword((current) => !current)}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />

          <Input
            label="New password"
            name="newPassword"
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="********"
            value={newPassword}
            leftIcon={<Lock size={20} />}
            rightIcon={showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            onRightIconClick={() => setShowNewPassword((current) => !current)}
            onChange={(event) => setNewPassword(event.target.value)}
          />

          <Input
            label="Confirm new password"
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

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 220px" }}>
              <Button type="submit" isLoading={isSubmitting} loadingText="Saving new password...">
                Save new password
              </Button>
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </Button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
