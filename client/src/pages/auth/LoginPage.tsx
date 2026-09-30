import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROLE_HOME } from "@findbarber/shared/constants";
import { useAuth } from "../../app/auth-context";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion échouée.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow p-8 space-y-4"
      >
        <h1 className="text-2xl font-semibold text-brand-900">Connexion</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block">
          <span className="text-sm text-gray-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Mot de passe</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-700 text-white py-2 disabled:opacity-50"
        >
          {submitting ? "Connexion…" : "Se connecter"}
        </button>
        <p className="text-sm text-gray-600">
          Pas de compte ?{" "}
          <Link to="/register" className="text-brand-700 underline">
            Créer un compte
          </Link>
        </p>
      </form>
    </div>
  );
}
