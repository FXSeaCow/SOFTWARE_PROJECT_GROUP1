import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { LoginPage } from "./src/pages/LoginPage";
import { MainMenuPage } from "./src/pages/MainMenuPage";
import { WorkoutPage } from "./src/pages/WorkoutPage";
import { ProgressPage } from "./src/pages/ProgressPage";
import { RegisterPage } from "./src/pages/RegisterPage";
import { ForgotPasswordPage } from "./src/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./src/pages/ResetPasswordPage";
import { ChangePasswordPage } from "./src/pages/ChangePasswordPage";
import { MembershipPage } from "./src/pages/MembershipPage";
import { AccountPage } from "./src/pages/AccountPage";
import { AdminUsersPage } from "./src/pages/AdminUsersPage";
import { AdminAnnouncementsPage } from "./src/pages/AdminAnnouncementsPage";
import { AdminPaymentsPage } from "./src/pages/AdminPaymentsPage";
import { AdminOccupancyPage } from "./src/pages/AdminOccupancyPage";
import { SchedulePage } from "./src/pages/SchedulePage";
import { getCurrentUser } from "./src/services/authService";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const user = getCurrentUser();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const user = getCurrentUser();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/account" replace />;
  }

  return <>{children}</>;
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainMenuPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exercises"
          element={
            <ProtectedRoute>
              <WorkoutPage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/membership"
          element={
            <ProtectedRoute>
              <MembershipPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute>
              <SchedulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/progress"
          element={
            <ProtectedRoute>
              <ProgressPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={<Navigate to="/" replace />}
        />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Navigate to="/admin/users" replace />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/announcements"
          element={
            <AdminRoute>
              <AdminAnnouncementsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <AdminRoute>
              <AdminPaymentsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/occupancy"
          element={
            <AdminRoute>
              <AdminOccupancyPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);
