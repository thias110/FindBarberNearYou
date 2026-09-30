import { Navigate, Route, Routes } from "react-router-dom";
import { RequireRole } from "./RequireRole";
import { LoginPage } from "../pages/auth/LoginPage";
import { RegisterPage } from "../pages/auth/RegisterPage";
import { ClientHomePage } from "../pages/client/HomePage";
import { PublicBarberProfilePage } from "../pages/client/BarberProfilePage";
import { BarberDashboardPage } from "../pages/barber/DashboardPage";
import { BarberProfilePage } from "../pages/barber/ProfilePage";
import { BarberServicesPage } from "../pages/barber/ServicesPage";
import { AdminDashboardPage } from "../pages/admin/DashboardPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Profil public : accessible sans connexion. */}
      <Route path="/barbers/:barberId" element={<PublicBarberProfilePage />} />

      <Route
        path="/"
        element={
          <RequireRole roles={["CLIENT"]}>
            <ClientHomePage />
          </RequireRole>
        }
      />
      <Route
        path="/pro/dashboard"
        element={
          <RequireRole roles={["BARBER"]}>
            <BarberDashboardPage />
          </RequireRole>
        }
      />
      <Route
        path="/pro/profile"
        element={
          <RequireRole roles={["BARBER"]}>
            <BarberProfilePage />
          </RequireRole>
        }
      />
      <Route
        path="/pro/services"
        element={
          <RequireRole roles={["BARBER"]}>
            <BarberServicesPage />
          </RequireRole>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireRole roles={["ADMIN"]}>
            <AdminDashboardPage />
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
