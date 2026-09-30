import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../lib/apiClient";

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"CLIENT" | "BARBER">("CLIENT");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.register({ name: name || undefined, email, password, role });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription échouée.");
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
        <h1 className="text-2xl font-semibold text-brand-900">Créer un compte</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block">
          <span className="text-sm text-gray-700">Nom (optionnel)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
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
          <span className="text-sm text-gray-700">
            Mot de passe (min. 8 caractères)
          </span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm text-gray-700">Je suis</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="role"
              checked={role === "CLIENT"}
              onChange={() => setRole("CLIENT")}
            />
            Client
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="role"
              checked={role === "BARBER"}
              onChange={() => setRole("BARBER")}
            />
            Barbier / Coiffeur
          </label>
        </fieldset>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-700 text-white py-2 disabled:opacity-50"
        >
          {submitting ? "Inscription…" : "S'inscrire"}
        </button>
        <p className="text-sm text-gray-600">
          Déjà un compte ?{" "}
          <Link to="/login" className="text-brand-700 underline">
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  );
}
