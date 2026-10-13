import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, authApi } from "../../lib/apiClient";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";

type Phase = "verifying" | "success" | "error";

const INVALID_TOKEN_MESSAGE = "Ce lien de vérification est invalide ou expiré.";
const NETWORK_MESSAGE =
  "Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.";

export function VerifyEmailPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    document.title = "Vérification de l'email — FindBarber";
    return () => {
      document.title = "FindBarber";
    };
  }, []);

  useEffect(() => {
    // Ne lire le jeton qu'une seule fois, même après le retrait de l'URL.
    if (startedRef.current) return;
    startedRef.current = true;

    const token = searchParams.get("token");

    // Retirer immédiatement le jeton de l'URL (replace, sans entrée
    // d'historique), avant la réponse réseau. Le jeton n'est jamais conservé,
    // loggé ni affiché.
    if (token !== null) {
      const next = new URLSearchParams(searchParams);
      next.delete("token");
      setSearchParams(next, { replace: true });
    }

    if (!token) {
      setPhase("error");
      setErrorMessage(INVALID_TOKEN_MESSAGE);
      return;
    }

    let cancelled = false;
    authApi
      .verifyEmail({ token })
      .then(() => {
        if (!cancelled) setPhase("success");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.code === "RATE_LIMITED") {
            setErrorMessage(
              "Trop de tentatives. Réessayez dans quelques instants.",
            );
          } else {
            // Expiré / déjà utilisé / invalide : message public uniforme.
            setErrorMessage(INVALID_TOKEN_MESSAGE);
          }
        } else {
          setErrorMessage(NETWORK_MESSAGE);
        }
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams]);

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold text-foreground">
        Vérification de votre email
      </h1>

      <div aria-live="polite" className="mt-4">
        {phase === "verifying" && (
          <Alert variant="info" role="status">
            Vérification en cours…
          </Alert>
        )}
        {phase === "success" && (
          <Alert variant="success" role="status">
            Votre adresse email est vérifiée. Vous pouvez maintenant vous
            connecter.
          </Alert>
        )}
        {phase === "error" && (
          <Alert variant="danger" role="alert">
            {errorMessage}
          </Alert>
        )}
      </div>

      {phase === "success" && (
        <Button
          onClick={() => navigate("/login", { replace: true })}
          className="mt-6 min-h-[44px] w-full"
        >
          Se connecter
        </Button>
      )}

      {phase === "error" && (
        <Button
          variant="secondary"
          onClick={() => navigate("/resend-verification", { replace: true })}
          className="mt-6 min-h-[44px] w-full"
        >
          Renvoyer le lien de vérification
        </Button>
      )}

      <p className="mt-4 text-center text-sm text-foreground-muted">
        <Link
          to="/login"
          className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Retour à la connexion
        </Link>
      </p>
    </AuthLayout>
  );
}
