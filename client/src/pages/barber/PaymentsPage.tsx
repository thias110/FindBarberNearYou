import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LIMITS,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  type PaymentMode,
} from "@findbarber/shared/constants";
import type { BarberPaymentSettings } from "@findbarber/shared/types";
import { apiErrorMessage, barberPaymentsApi } from "../../lib/apiClient";
import { ProPageHeader } from "../../components/barber/ProPageHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";

// Paiement en ligne (issue #10, Stripe Connect) : activation du compte Stripe
// du barber puis choix de la politique (sur place, acompte, prix complet).
export function BarberPaymentsPage() {
  const [searchParams] = useSearchParams();
  const stripeReturn = searchParams.get("stripe");

  const [settings, setSettings] = useState<BarberPaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<PaymentMode>("NONE");
  const [deposit, setDeposit] = useState(String(LIMITS.depositPercentDefault));
  const [depositError, setDepositError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await barberPaymentsApi.get();
      setSettings(res.settings);
      setMode(res.settings.paymentMode);
      setDeposit(String(res.settings.depositPercent));
    } catch (err) {
      setLoadError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleOnboarding() {
    setRedirecting(true);
    setMessage(null);
    try {
      const { url } = await barberPaymentsApi.onboarding();
      window.location.assign(url);
    } catch (err) {
      setMessage({ kind: "error", text: apiErrorMessage(err) });
      setRedirecting(false);
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const percent = Number(deposit);
    if (
      mode === "DEPOSIT" &&
      (!Number.isInteger(percent) ||
        percent < LIMITS.depositPercentMin ||
        percent > LIMITS.depositPercentMax)
    ) {
      setDepositError(
        `Indiquez un pourcentage entier entre ${LIMITS.depositPercentMin} et ${LIMITS.depositPercentMax}.`,
      );
      return;
    }
    setDepositError(null);
    setSaving(true);
    try {
      const res = await barberPaymentsApi.update({
        paymentMode: mode,
        ...(mode === "DEPOSIT" ? { depositPercent: percent } : {}),
      });
      setSettings(res.settings);
      setMessage({
        kind: "success",
        text: "Préférences de paiement enregistrées.",
      });
    } catch (err) {
      setMessage({ kind: "error", text: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <ProPageHeader
          title="Paiements en ligne"
          description="Acompte ou paiement complet à la réservation, via Stripe."
        />

        {loading ? (
          <Card className="space-y-3 p-6" aria-busy="true">
            <span className="sr-only" role="status">
              Chargement des paiements…
            </span>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ) : loadError ? (
          <Alert variant="danger">
            <p>{loadError}</p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => void load()}
            >
              Réessayer
            </Button>
          </Alert>
        ) : settings && !settings.available ? (
          <Alert variant="info">
            Le paiement en ligne n'est pas encore disponible sur la plateforme.
            Vos clients paient sur place.
          </Alert>
        ) : settings ? (
          <>
            {message && (
              <Alert
                variant={message.kind === "success" ? "success" : "danger"}
              >
                {message.text}
              </Alert>
            )}

            <Card className="space-y-3 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-foreground">
                  Compte Stripe
                </h2>
                <Badge
                  variant={settings.chargesEnabled ? "success" : "warning"}
                >
                  {settings.chargesEnabled
                    ? "Paiements activés"
                    : settings.connected
                      ? "Inscription à terminer"
                      : "Non configuré"}
                </Badge>
              </div>
              <p className="text-sm text-foreground-muted">
                Les paiements de vos clients sont versés directement sur votre
                compte Stripe
                {settings.platformFeePercent > 0
                  ? `, déduction faite d'une commission de ${settings.platformFeePercent} %`
                  : ""}
                . Stripe vous demande votre identité et votre IBAN lors de
                l'inscription.
              </p>
              {stripeReturn === "return" && !settings.chargesEnabled && (
                <Alert variant="info">
                  Inscription reçue : Stripe vérifie vos informations. Les
                  paiements seront activés dès sa validation.
                </Alert>
              )}
              {!settings.chargesEnabled && (
                <Button
                  isLoading={redirecting}
                  onClick={() => void handleOnboarding()}
                >
                  {settings.connected
                    ? "Terminer l'inscription Stripe"
                    : "Activer les paiements avec Stripe"}
                </Button>
              )}
            </Card>

            <Card className="p-6">
              <form onSubmit={handleSave} noValidate className="space-y-4">
                <h2 className="text-lg font-bold text-foreground">
                  Paiement à la réservation
                </h2>
                {!settings.chargesEnabled && (
                  <p className="text-sm text-foreground-muted">
                    Activez d'abord les paiements avec Stripe pour exiger un
                    paiement en ligne.
                  </p>
                )}
                <Field label="Mode de paiement">
                  {(control) => (
                    <Select
                      {...control}
                      value={mode}
                      disabled={!settings.chargesEnabled}
                      onChange={(event) =>
                        setMode(event.target.value as PaymentMode)
                      }
                    >
                      {PAYMENT_MODES.map((value) => (
                        <option key={value} value={value}>
                          {PAYMENT_MODE_LABELS[value]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {mode === "DEPOSIT" && (
                  <Field
                    label="Acompte (% du prix)"
                    error={depositError}
                    hint={`Entre ${LIMITS.depositPercentMin} et ${LIMITS.depositPercentMax} %. Le reste est payé sur place.`}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        type="number"
                        inputMode="numeric"
                        min={LIMITS.depositPercentMin}
                        max={LIMITS.depositPercentMax}
                        value={deposit}
                        onChange={(event) => setDeposit(event.target.value)}
                        className="max-w-32"
                      />
                    )}
                  </Field>
                )}
                <p className="text-sm text-foreground-muted">
                  Le client paie en envoyant sa demande (carte ou Twint). Il est
                  remboursé automatiquement si vous refusez, si la demande
                  expire, si vous annulez, ou s'il annule dans les délais.
                </p>
                <Button
                  type="submit"
                  isLoading={saving}
                  disabled={
                    !settings.chargesEnabled && mode === settings.paymentMode
                  }
                >
                  Enregistrer
                </Button>
              </form>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
