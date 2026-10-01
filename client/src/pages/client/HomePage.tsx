import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/auth-context";

export function ClientHomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-50 p-8">
      <h1 className="text-2xl font-semibold text-brand-900">Espace client</h1>
      <p className="mt-2 text-gray-700">Connecté en tant que {user?.email}.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/barbers"
          className="inline-block rounded-lg bg-brand-700 px-4 py-2 text-white"
        >
          Rechercher un barbier
        </Link>
        <Link
          to="/appointments"
          className="inline-block rounded-lg border border-brand-700 px-4 py-2 text-brand-700"
        >
          Mes rendez-vous
        </Link>
      </div>
      <button
        className="mt-4 rounded-lg bg-brand-700 text-white px-4 py-2"
        onClick={async () => {
          await logout();
          navigate("/login", { replace: true });
        }}
      >
        Se déconnecter
      </button>
    </div>
  );
}
