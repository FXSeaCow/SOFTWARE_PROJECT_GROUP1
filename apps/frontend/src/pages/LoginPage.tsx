import React from "react";
import { Navigate } from "react-router-dom";

import { LoginForm } from "../features/auth/LoginForm";
import { getCurrentUser } from "../services/authService";

export function LoginPage() {
  const currentUser = getCurrentUser();

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LoginForm />;
}
