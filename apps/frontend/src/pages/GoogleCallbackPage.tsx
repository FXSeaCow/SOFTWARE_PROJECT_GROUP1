import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "../components/Button";
import {
  getGoogleCallbackRedirectUri,
  loginWithGoogle,
  validateGoogleState,
} from "../services/authService";

export function GoogleCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    const googleError = params.get("error");
    if (googleError) {
      setError("Google login was cancelled or denied.");
      return;
    }

    const code = params.get("code");
    const state = params.get("state");

    if (!code) {
      setError("Google authorization code is missing.");
      return;
    }

    if (!validateGoogleState(state)) {
      setError("Google login session is invalid. Please try again.");
      return;
    }

    let isActive = true;

    loginWithGoogle({
      code,
      redirect_uri: getGoogleCallbackRedirectUri(),
    })
      .then(() => {
        if (isActive) {
          navigate("/", { replace: true });
        }
      })
      .catch((nextError) => {
        if (isActive) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to finish Google login.",
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [navigate, params]);

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
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: "#050816" }}>Signing in</h1>
          <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.5 }}>
            Finishing your Google login.
          </p>
        </div>

        {error ? (
          <>
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

            <Link to="/login" style={{ textDecoration: "none" }}>
              <Button type="button" variant="outline">
                Back to sign in
              </Button>
            </Link>
          </>
        ) : (
          <div
            style={{
              borderRadius: 12,
              padding: "12px 14px",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: 14,
            }}
          >
            Please wait.
          </div>
        )}
      </div>
    </div>
  );
}
