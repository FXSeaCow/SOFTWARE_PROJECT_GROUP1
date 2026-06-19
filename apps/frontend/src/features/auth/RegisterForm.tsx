import React, { FormEvent, useState } from "react";
import {
  BriefcaseBusiness,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { register } from "../../services/authService";

type FormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type FormErrors = Partial<Record<keyof FormState, string>> & {
  form?: string;
};

type RegisterLocationState = {
  email?: string;
} | null;

const initialForm: FormState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {};
  const hasUppercaseLetter = /[A-Z]/.test(values.password);

  if (!values.name.trim()) {
    errors.name = "Full name is required";
  } else if (values.name.trim().length < 2) {
    errors.name = "Full name must be at least 2 characters";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Email format is invalid";
  }

  if (!values.password.trim()) {
    errors.password = "Password is required";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  } else if (!hasUppercaseLetter) {
    errors.password = "Password must contain at least 1 uppercase letter";
  }

  if (!values.confirmPassword.trim()) {
    errors.confirmPassword = "Please confirm your password";
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords do not match";
  }

  return errors;
}

export function RegisterForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as RegisterLocationState;

  const [form, setForm] = useState<FormState>({
    ...initialForm,
    email: locationState?.email ?? "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordHasMinLength = form.password.length >= 8;
  const passwordHasUppercase = /[A-Z]/.test(form.password);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validate(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirm_password: form.confirmPassword,
      });

      navigate("/login", {
        replace: true,
        state: {
          success: "Account created successfully. Please sign in.",
          email: form.email.trim().toLowerCase(),
        },
      });
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "Unable to create your account. Please try again.",
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
            Create account
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              fontSize: 16,
              color: "#667085",
            }}
          >
            Sign up to get started
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <Input
            label="Full name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Nguyen Van Muoi"
            value={form.name}
            error={errors.name}
            leftIcon={<User size={20} />}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />

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
            autoComplete="new-password"
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
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
          />
          <p
            style={{
              margin: "-10px 0 0",
              fontSize: 13,
              color: "#667085",
            }}
          >
            <span
              style={{
                display: "block",
                color: passwordHasMinLength ? "#166534" : "#667085",
              }}
            >
              {passwordHasMinLength ? "[OK]" : "[ ]"} At least 8 characters
            </span>
            <span
              style={{
                display: "block",
                marginTop: 4,
                color: passwordHasUppercase ? "#166534" : "#667085",
              }}
            >
              {passwordHasUppercase ? "[OK]" : "[ ]"} At least 1 uppercase letter
            </span>
          </p>

          <Input
            label="Confirm password"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.confirmPassword}
            error={errors.confirmPassword}
            leftIcon={<Lock size={20} />}
            rightIcon={
              showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />
            }
            onRightIconClick={() =>
              setShowConfirmPassword((current) => !current)
            }
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                confirmPassword: event.target.value,
              }))
            }
          />
        </div>

        {errors.form ? (
          <div
            style={{
              borderRadius: 12,
              padding: "12px 14px",
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: 14,
              marginTop: 18,
              marginBottom: 16,
            }}
          >
            {errors.form}
          </div>
        ) : (
          <div style={{ height: 18 }} />
        )}

        <Button
          type="submit"
          isLoading={isSubmitting}
          loadingText="Creating account..."
        >
          Create account
        </Button>

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
            // Sau nay goi API dang ky Google o day.
          }}
        >
          Continue with Google
        </Button>

        <p
          style={{
            margin: "24px 0 0",
            textAlign: "center",
            fontSize: 14,
            color: "#667085",
          }}
        >
          Already have an account?{" "}
          <Link
            to="/login"
            state={{
              email: form.email.trim(),
            }}
            style={{
              color: "#050816",
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
