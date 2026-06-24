import React, { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Mail, QrCode, ShieldCheck, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/Button";
import { MainMenuHeader } from "../components/main-menu/MainMenuHeader";
import { panelStyle, startButtonStyle } from "../components/main-menu/styles";
import { AppShell } from "../layouts/AppShell";
import { getCurrentUser, logout } from "../services/authService";
import {
  changeMyPassword,
  getMyProfile,
  getMyQrCode,
  UserProfile,
} from "../services/userService";

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PasswordFormErrors = Partial<Record<keyof PasswordFormState, string>> & {
  form?: string;
};

const initialPasswordForm: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function validatePasswordForm(values: PasswordFormState): PasswordFormErrors {
  const errors: PasswordFormErrors = {};
  const hasUppercase = /[A-Z]/.test(values.newPassword);
  const hasNumber = /[0-9]/.test(values.newPassword);

  if (!values.currentPassword.trim()) {
    errors.currentPassword = "Current password is required";
  }

  if (!values.newPassword.trim()) {
    errors.newPassword = "New password is required";
  } else if (values.newPassword.length < 8) {
    errors.newPassword = "New password must be at least 8 characters";
  } else if (!hasUppercase) {
    errors.newPassword = "New password must contain at least 1 uppercase letter";
  } else if (!hasNumber) {
    errors.newPassword = "New password must contain at least 1 number";
  } else if (values.newPassword === values.currentPassword) {
    errors.newPassword = "New password must be different from the current password";
  }

  if (!values.confirmPassword.trim()) {
    errors.confirmPassword = "Please confirm your new password";
  } else if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return errors;
}

function DarkInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  leftIcon,
  rightIcon,
  onRightIconClick,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
  autoComplete?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <label
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#f5f5f5",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </label>
      <div
        style={{
          minHeight: 52,
          borderRadius: 14,
          border: `1px solid ${error ? "rgba(248,113,113,0.8)" : "rgba(255,255,255,0.08)"}`,
          background: "rgba(255,255,255,0.03)",
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 10,
        }}
      >
        {leftIcon ? (
          <span style={{ display: "flex", alignItems: "center", color: "#9ca8b7" }}>
            {leftIcon}
          </span>
        ) : null}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "#f5f5f5",
            fontSize: 15,
          }}
        />
        {rightIcon ? (
          <button
            type="button"
            onClick={onRightIconClick}
            style={{
              border: "none",
              background: "transparent",
              color: "#9ca8b7",
              padding: 0,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            {rightIcon}
          </button>
        ) : null}
      </div>
      {error ? (
        <span style={{ color: "#fca5a5", fontSize: 13 }}>{error}</span>
      ) : null}
    </div>
  );
}

export function AccountPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(initialPasswordForm);
  const [errors, setErrors] = useState<PasswordFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const displayName = currentUser?.name?.trim()
    ? currentUser.name.toUpperCase()
    : currentUser?.email
      ? currentUser.email.split("@")[0].replace(/[._-]+/g, " ").toUpperCase()
      : "ACCOUNT";
  const profileInitials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : currentUser?.email
      ? currentUser.email.slice(0, 2).toUpperCase()
      : "AC";

  const hasMinLength = passwordForm.newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(passwordForm.newPassword);
  const hasNumber = /[0-9]/.test(passwordForm.newPassword);

  useEffect(() => {
    async function loadProfile() {
      setIsLoadingProfile(true);

      try {
        const [nextProfile, nextQrCode] = await Promise.all([getMyProfile(), getMyQrCode()]);
        setProfile(nextProfile);
        setQrCode(nextQrCode.qrCode);
      } catch (error) {
        setErrors({
          form:
            error instanceof Error
              ? error.message
              : "Unable to load account information.",
        });
      } finally {
        setIsLoadingProfile(false);
      }
    }

    void loadProfile();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);

    const nextErrors = validatePasswordForm(passwordForm);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const message = await changeMyPassword({
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
        confirm_new_password: passwordForm.confirmPassword,
      });

      setSuccessMessage(message);
      setPasswordForm(initialPasswordForm);
      setErrors({});
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "Unable to change password. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell activeItem="none">
      <MainMenuHeader
        displayName={displayName}
        profileInitials={profileInitials || "AC"}
        isProfileMenuOpen={isProfileMenuOpen}
        onProfileClick={() => {
          setIsProfileMenuOpen((current) => !current);
        }}
        onMembershipClick={() => {
          setIsProfileMenuOpen(false);
          navigate("/membership");
        }}
        onAccountClick={() => {
          setIsProfileMenuOpen(false);
          navigate("/account");
        }}
        onAdminClick={() => {
          setIsProfileMenuOpen(false);
          navigate("/admin/users");
        }}
        showAdminEntry={isAdmin}
        onLogoutClick={() => {
          logout();
          navigate("/login", { replace: true });
        }}
      />

      <section
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
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
            Account center
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(1.8rem, 3.4vw, 2.5rem)",
              lineHeight: 0.95,
              fontWeight: 900,
              letterSpacing: "-0.05em",
              textTransform: "uppercase",
            }}
          >
            Security and account details
          </h2>
        </div>

        <button
          type="button"
          style={{
            ...startButtonStyle,
            width: "auto",
          }}
          onClick={() => navigate("/")}
        >
          Back Home
        </button>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.05fr) minmax(300px, 0.95fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <aside style={panelStyle}>
          <div
            style={{
              color: "#9ca8b7",
              fontSize: 13,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Account
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Profile summary
          </div>

          {isLoadingProfile ? (
            <div style={{ color: "#9ca8b7", fontSize: 15 }}>Loading account...</div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: "#9ca8b7",
                    fontSize: 13,
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  <User size={16} />
                  <span>Full name</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {profile?.full_name || currentUser?.name || "Unknown"}
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: "#9ca8b7",
                    fontSize: 13,
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  <Mail size={16} />
                  <span>Email</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {profile?.email || currentUser?.email || "Unknown"}
                </div>
              </div>

              <section
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    color: "#9ca8b7",
                    fontSize: 13,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Security
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    letterSpacing: "-0.04em",
                    textTransform: "uppercase",
                    marginBottom: 18,
                  }}
                >
                  Change password
                </div>

                <form
                  onSubmit={handleSubmit}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  <DarkInput
                    label="Current password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(value) =>
                      setPasswordForm((current) => ({
                        ...current,
                        currentPassword: value,
                      }))
                    }
                    autoComplete="current-password"
                    placeholder="Enter current password"
                    error={errors.currentPassword}
                    leftIcon={<KeyRound size={18} />}
                    rightIcon={showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    onRightIconClick={() => setShowCurrentPassword((current) => !current)}
                  />

                  <DarkInput
                    label="New password"
                    type={showNewPassword ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(value) =>
                      setPasswordForm((current) => ({
                        ...current,
                        newPassword: value,
                      }))
                    }
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    error={errors.newPassword}
                    leftIcon={<KeyRound size={18} />}
                    rightIcon={showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    onRightIconClick={() => setShowNewPassword((current) => !current)}
                  />

                  <div
                    style={{
                      marginTop: -4,
                      padding: 14,
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#9ca8b7",
                      fontSize: 14,
                    }}
                  >
                    <div style={{ color: hasMinLength ? "#86efac" : "#9ca8b7" }}>
                      {hasMinLength ? "[OK]" : "[ ]"} At least 8 characters
                    </div>
                    <div style={{ color: hasUppercase ? "#86efac" : "#9ca8b7", marginTop: 6 }}>
                      {hasUppercase ? "[OK]" : "[ ]"} At least 1 uppercase letter
                    </div>
                    <div style={{ color: hasNumber ? "#86efac" : "#9ca8b7", marginTop: 6 }}>
                      {hasNumber ? "[OK]" : "[ ]"} At least 1 number
                    </div>
                  </div>

                  <DarkInput
                    label="Confirm new password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(value) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirmPassword: value,
                      }))
                    }
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    error={errors.confirmPassword}
                    leftIcon={<KeyRound size={18} />}
                    rightIcon={showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    onRightIconClick={() => setShowConfirmPassword((current) => !current)}
                  />

                  {errors.form ? (
                    <div
                      style={{
                        borderRadius: 14,
                        padding: "12px 14px",
                        background: "rgba(127,29,29,0.32)",
                        color: "#fecaca",
                        fontSize: 14,
                      }}
                    >
                      {errors.form}
                    </div>
                  ) : null}

                  {successMessage ? (
                    <div
                      style={{
                        borderRadius: 14,
                        padding: "12px 14px",
                        background: "rgba(22,101,52,0.28)",
                        color: "#bbf7d0",
                        fontSize: 14,
                      }}
                    >
                      {successMessage}
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    loadingText="Updating password..."
                    style={{
                      background: "#ff7a1a",
                      color: "#111111",
                      marginTop: 4,
                    }}
                  >
                    Save new password
                  </Button>
                </form>
              </section>

              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => navigate("/admin/users")}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    background: "rgba(255,122,26,0.12)",
                    border: "1px solid rgba(255,122,26,0.24)",
                    color: "#f5f5f5",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      color: "#ffb15f",
                      fontSize: 13,
                      textTransform: "uppercase",
                      marginBottom: 10,
                      fontWeight: 800,
                    }}
                  >
                    Admin
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                    Open user management
                  </div>
                  <div style={{ color: "#ffd7b0", fontSize: 14, lineHeight: 1.5 }}>
                    View all users, search by email or name, change roles, lock or
                    unlock accounts, inspect membership status, and delete users.
                  </div>
                </button>
              ) : null}
            </div>
          )}
        </aside>

        <section style={panelStyle}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                color: "#9ca8b7",
                fontSize: 13,
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Access
            </div>
            <div
              style={{
                padding: 18,
                borderRadius: 18,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#9ca8b7",
                  fontSize: 13,
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                <QrCode size={16} />
                <span>Personal QR code</span>
              </div>

              <div
                style={{
                  borderRadius: 18,
                  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
                  padding: 18,
                  display: "grid",
                  placeItems: "center",
                  minHeight: 280,
                }}
              >
                {qrCode ? (
                  <img
                    src={qrCode}
                    alt="Account QR code"
                    style={{
                      width: "100%",
                      maxWidth: 240,
                      aspectRatio: "1 / 1",
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <div style={{ color: "#334155", fontSize: 14 }}>Unable to load QR code.</div>
                )}
              </div>

              <div style={{ color: "#9ca8b7", fontSize: 13, lineHeight: 1.6, marginTop: 14 }}>
                This QR code is tied to the `qr_code_token` of your account and can be used for
                gym check-in.
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 16,
                background: "rgba(255,122,26,0.12)",
                border: "1px solid rgba(255,122,26,0.24)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#ffb15f",
                  fontSize: 13,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                <ShieldCheck size={16} />
                <span>Password rule</span>
              </div>
              <div style={{ color: "#f5f5f5", fontSize: 14, lineHeight: 1.6 }}>
                Your new password must include at least 8 characters, 1 uppercase letter,
                and 1 number.
              </div>
            </div>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
