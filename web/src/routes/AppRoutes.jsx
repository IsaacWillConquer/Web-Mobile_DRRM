import { Navigate, Route, Routes } from "react-router-dom";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Dashboard from "../pages/Dashboard";
import ProtectedRoute from "../core/guards/ProtectedRoute";
import { useAuth } from "../core/auth/authContext";
import { ROLES } from "../config/appConfig";

export default function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

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
          <ProtectedRoute roles={[ROLES.dispatcher, ROLES.dmo]}>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/responder"
        element={
          <ProtectedRoute roles={[ROLES.rescueTeam, ROLES.dispatcher]}>
            <Dashboard />
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
