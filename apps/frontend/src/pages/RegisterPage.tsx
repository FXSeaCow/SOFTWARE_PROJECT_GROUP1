import React from "react";
import { Navigate } from "react-router-dom";

import { RegisterForm } from "../features/auth/RegisterForm";
import { getCurrentUser } from "../services/authService";

export function RegisterPage() {
  const currentUser = getCurrentUser();

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <RegisterForm />;
}
