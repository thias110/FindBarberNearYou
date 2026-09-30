import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { ROLE_HOME } from "@findbarber/shared/constants";
import type { Role } from "@findbarber/shared/types";
import { useAuth } from "./auth-context";

export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Chargement…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return <>{children}</>;
}
