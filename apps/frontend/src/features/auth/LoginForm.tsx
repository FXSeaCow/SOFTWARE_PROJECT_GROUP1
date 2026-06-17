import React, { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, Eye, EyeOff, Lock, Mail } from "lucide-react";

import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { login } from "../../services/authService";

type FormState = {
  email: string;
  password: string;
  remember: boolean;
};

type FormErrors = Partial<Record<keyof FormState, string>> & {
  form?: string;
};

type LoginLocationState = {
  success?: string;
  email?: string;
  from?: { pathname?: string };
} | null;

const initialForm: FormState = {
  email: "",
  password: "",
  remember: false,
};

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!values.email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Email format is invalid";
  }

  if (!values.password.trim()) {
    errors.password = "Password is required";
  } else if (values.password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  return errors;
}

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LoginLocationState;
  const successMessage = locationState?.success;

  const [form, setForm] = useState<FormState>({
    ...initialForm,
    email: locationState?.email ?? "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validate(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        email: form.email.trim(),
        password: form.password,
      });

      const from = locationState?.from?.pathname;

      navigate(from || "/", { replace: true });
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "Unable to sign in. Please try again.",
      });
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
        }}
      >
        {/* Top icon */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
            background: "#0b0820",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
          }}
        >
          <BriefcaseBusiness size={26} strokeWidth={2} />
        </div>

        {/* Header */}
        <div
          style={{
            textAlign: "center",
            marginBottom: 30,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              color: "#050816",
              lineHeight: 1.25,
            }}
          >
            Welcome back
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              fontSize: 16,
              color: "#667085",
            }}
          >
            Sign in to your account
          </p>
        </div>

        {/* Fields */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <Input
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            error={errors.email}
            leftIcon={<Mail size={20} />}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
          />

          <Input
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            error={errors.password}
            leftIcon={<Lock size={20} />}
            rightIcon={
              showPassword ? <EyeOff size={18} /> : <Eye size={18} />
            }
            onRightIconClick={() =>
              setShowPassword((current) => !current)
            }
            rightLabel={
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  fontSize: 13,
                  color: "#667085",
                  cursor: "pointer",
                }}
              >
                Forgot?
              </button>
            }
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
          />
        </div>

        {/* Remember me */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 16,
            marginBottom: 18,
            fontSize: 14,
            color: "#667085",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.remember}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                remember: event.target.checked,
              }))
            }
            style={{
              width: 16,
              height: 16,
              accentColor: "#07031a",
              cursor: "pointer",
            }}
          />

          <span>Remember me for 30 days</span>
        </label>

        {/* Form error */}
        {errors.form ? (
          <div
            style={{
              borderRadius: 12,
              padding: "12px 14px",
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {errors.form}
          </div>
        ) : null}

        {successMessage ? (
          <div
            style={{
              borderRadius: 12,
              padding: "12px 14px",
              background: "#dcfce7",
              color: "#166534",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {successMessage}
          </div>
        ) : null}

        {/* Sign in */}
        <Button type="submit" isLoading={isSubmitting}>
          Sign in
        </Button>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 24,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: "#d9d9df",
            }}
          />

          <span
            style={{
              fontSize: 14,
              color: "#667085",
              whiteSpace: "nowrap",
            }}
          >
            or continue with
          </span>

          <div
            style={{
              flex: 1,
              height: 1,
              background: "#d9d9df",
            }}
          />
        </div>

        {/* Google button */}
        <Button
          type="button"
          variant="outline"
          leftIcon={
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#4285f4",
                lineHeight: 1,
              }}
            >
              G
            </span>
          }
          onClick={() => {
            // Sau này gọi API đăng nhập Google ở đây.
          }}
        >
          Continue with Google
        </Button>

        {/* Sign up */}
        <p
          style={{
            margin: "24px 0 0",
            textAlign: "center",
            fontSize: 14,
            color: "#667085",
          }}
        >
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            state={{
              email: form.email.trim(),
            }}
            style={{
              color: "#050816",
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
