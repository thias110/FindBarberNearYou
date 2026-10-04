import { Navigate, Route, Routes } from "react-router-dom";
import { RequireRole } from "./RequireRole";
import { LoginPage } from "../pages/auth/LoginPage";
import { RegisterPage } from "../pages/auth/RegisterPage";
import { ClientHomePage } from "../pages/client/HomePage";
import { PublicBarberProfilePage } from "../pages/client/BarberProfilePage";
import { BarbersSearchPage } from "../pages/client/BarbersSearchPage";
import { ClientBookingsPage } from "../pages/client/BookingsPage";
import { BarberDashboardPage } from "../pages/barber/DashboardPage";
import { BarberProfilePage } from "../pages/barber/ProfilePage";
import { BarberServicesPage } from "../pages/barber/ServicesPage";
import { BarberWorkingHoursPage } from "../pages/barber/WorkingHoursPage";
import { BarberTimeOffPage } from "../pages/barber/TimeOffPage";
import { BarberBookingsPage } from "../pages/barber/BookingsPage";
import { BarberStatsPage } from "../pages/barber/StatsPage";
import { AdminDashboardPage } from "../pages/admin/DashboardPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Recherche et profil public : accessibles sans connexion. */}
      <Route path="/barbers" element={<BarbersSearchPage />} />
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
        path="/appointments"
        element={
          <RequireRole roles={["CLIENT"]}>
            <ClientBookingsPage />
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
        path="/pro/working-hours"
        element={
          <RequireRole roles={["BARBER"]}>
            <BarberWorkingHoursPage />
          </RequireRole>
        }
      />
      <Route
        path="/pro/time-off"
        element={
          <RequireRole roles={["BARBER"]}>
            <BarberTimeOffPage />
          </RequireRole>
        }
      />
      <Route
        path="/pro/bookings"
        element={
          <RequireRole roles={["BARBER"]}>
            <BarberBookingsPage />
          </RequireRole>
        }
      />
      <Route
        path="/pro/stats"
        element={
          <RequireRole roles={["BARBER"]}>
            <BarberStatsPage />
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
