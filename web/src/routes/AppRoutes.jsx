import { Navigate, Route, Routes } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import DispatchPage from "../pages/dispatch/DispatchPage";
import ResponderPage from "../pages/responder/ResponderPage";
import DmoPage from "../pages/dmo/DmoPage";
import StaffPage from "../pages/admin/StaffPage";
import ProtectedRoute from "../core/guards/ProtectedRoute";
import { useAuth } from "../core/auth/authContext";
import { ROLES } from "../config/appConfig";

export default function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dispatch"
        element={
          <ProtectedRoute roles={[ROLES.dispatcher, ROLES.dmo, ROLES.admin]}>
            <DispatchPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/responder"
        element={
          <ProtectedRoute roles={[ROLES.rescueTeam, ROLES.dispatcher, ROLES.admin]}>
            <ResponderPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dmo"
        element={
          <ProtectedRoute roles={[ROLES.dmo, ROLES.admin]}>
            <DmoPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/staff"
        element={
          <ProtectedRoute roles={[ROLES.admin]}>
            <StaffPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          loading ? null : <Navigate to={user ? "/dashboard" : "/login"} replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
