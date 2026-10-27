import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi } from "../../lib/apiClient";
import {
  runEmailVerification,
  type EmailVerificationMessage,
} from "../../lib/emailVerification";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { buttonClasses } from "../../components/ui/buttonStyles";
import type { ExpressBookingOutcome } from "@findbarber/shared/types";

type Phase = "verifying" | "success" | "error";

export function VerifyEmailPage() {
  const { t } = useTranslation("auth");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [errorMessage, setErrorMessage] = useState<EmailVerificationMessage | null>(
    null,
  );
  const startedRef = useRef(false);
  // Réservation express (lot N6) : sort de la demande liée à ce compte.
  const [express, setExpress] = useState<ExpressBookingOutcome | null>(null);

  useEffect(() => {
    document.title = t("verifyEmail.documentTitle");
    return () => {
      document.title = "FindBarber";
    };
  }, [t]);

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

    // Pas d'annulation au nettoyage de l'effet : retirer le jeton de l'URL
    // relance cet effet (nouveau `searchParams`), et un drapeau « annulé »
    // ferait ignorer l'unique réponse — la page resterait alors bloquée sur
    // « Vérification en cours… ». La requête n'est émise qu'une fois
    // (`startedRef`) et son résultat est toujours appliqué.
    void runEmailVerification(token, (input) => authApi.verifyEmail(input)).then(
      (outcome) => {
        if (outcome.phase === "success") {
          setExpress(outcome.expressBooking ?? null);
          setPhase("success");
        } else {
          setErrorMessage(outcome.message);
          setPhase("error");
        }
      },
    );
  }, [searchParams, setSearchParams]);

  return (
    <AuthLayout>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
        {t("verifyEmail.title")}
      </h1>

      <div aria-live="polite" className="mt-4">
        {phase === "verifying" && (
          <Alert variant="info" role="status">
            {t("verifyEmail.verifying")}
          </Alert>
        )}
        {phase === "success" && !express && (
          <Alert variant="success" role="status">
            {t("verifyEmail.success")}
          </Alert>
        )}
        {phase === "success" && express?.status === "SENT" && (
          <Alert variant="success" role="status">
            {t("verifyEmail.express.sent", { barber: express.barberName })}
          </Alert>
        )}
        {phase === "success" && express?.status === "EXPIRED" && (
          <Alert variant="warning" role="status">
            {t("verifyEmail.express.expired", { barber: express.barberName })}
          </Alert>
        )}
        {phase === "error" && (
          <Alert variant="danger" role="alert">
            {errorMessage && t(errorMessage)}
          </Alert>
        )}
      </div>

      {phase === "success" && (
        <Button
          onClick={() => navigate("/login", { replace: true })}
          className="mt-6 min-h-[44px] w-full"
        >
          {t("actions.login")}
        </Button>
      )}
      {phase === "success" && express?.status === "EXPIRED" && (
        <Link
          to={`/barbers/${express.barberId}`}
          className={buttonClasses("secondary", "md", "mt-3 w-full")}
        >
          {t("verifyEmail.express.chooseAnother")}
        </Link>
      )}

      {phase === "error" && (
        <Button
          variant="secondary"
          onClick={() => navigate("/resend-verification", { replace: true })}
          className="mt-6 min-h-[44px] w-full"
        >
          {t("actions.resendVerificationLink")}
        </Button>
      )}

      <p className="mt-4 text-center text-sm text-foreground-muted">
        <Link
          to="/login"
          className="rounded text-accent-strong underline focus-ring"
        >
          {t("actions.backToLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}
