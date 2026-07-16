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
import { RegisterPage } from "./src/pages/RegisterPage";
import { MainMenuPage } from "./src/pages/MainMenuPage";
import { ProgressPage } from "./src/pages/ProgressPage";
import { MembershipPage } from "./src/pages/MembershipPage";
import { AccountPage } from "./src/pages/AccountPage";
import { getCurrentUser } from "./src/services/authService";
import { AdminUsersPage } from "./src/pages/AdminUsersPage";
import { WorkoutPage } from "./src/pages/WorkoutPage";
import { AdminAnnouncementsPage } from "./src/pages/AdminAnnouncementsPage";
import { AdminPaymentsPage } from "./src/pages/AdminPaymentsPage";
import { AdminConsolePage } from "./src/pages/AdminConsolePage";

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
        <Route path="/" element={<MainMenuPage />} />
        <Route path="/exercises" element={<WorkoutPage />} />
        <Route
          path="/progress"
          element={
            <ProtectedRoute>
              <ProgressPage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<RegisterPage />} />
        <Route
          path="/membership"
          element={
            <ProtectedRoute>
              <MembershipPage />
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
          element={
            <ProtectedRoute>
              <Navigate to="/" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminConsolePage />
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
