import { useEffect, type RefObject } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LIMITS } from "@findbarber/shared/constants";
import type { ExpressErrors, ExpressValues } from "../../lib/expressBooking";
import { buttonClasses } from "../ui/buttonStyles";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SummaryList, type BookingSummaryData } from "./BookingSummary";

// --- Réservation express (lot N6) ---
// Un visiteur sans compte saisit nom et email à la dernière étape du tunnel :
// le compte est créé avec la demande, qui part chez le barber quand il choisit
// son mot de passe depuis le lien reçu par email. Le champ `website` est un piège à robots :
// hors écran, hors tabulation, ignoré des lecteurs d'écran.

export function ExpressFields({
  values,
  errors,
  onChange,
}: {
  values: ExpressValues;
  errors: ExpressErrors;
  onChange: (field: keyof ExpressValues, value: string) => void;
}) {
  const { t } = useTranslation("client");
  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h4 className="text-base font-bold text-foreground">
          {t("booking.flow.express.title")}
        </h4>
        <p className="mt-1 text-sm text-foreground-muted">
          {t("booking.flow.express.intro")}
        </p>
      </div>
      <Field label={t("booking.flow.express.name")} error={errors.name}>
        {(control) => (
          <Input
            {...control}
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={(event) => onChange("name", event.target.value)}
          />
        )}
      </Field>
      <Field label={t("booking.flow.express.email")} error={errors.email}>
        {(control) => (
          <Input
            {...control}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={values.email}
            onChange={(event) => onChange("email", event.target.value)}
          />
        )}
      </Field>
      {/* Piège à robots : un humain ne voit ni n'atteint ce champ. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          {t("booking.flow.express.honeypot")}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(event) => onChange("website", event.target.value)}
          />
        </label>
      </div>
      <p className="text-sm text-foreground-muted">
        <Trans
          t={t}
          ns="client"
          i18nKey="booking.flow.express.haveAccount"
          components={{
            loginLink: (
              <Link to="/login" className="font-medium text-accent-strong underline" />
            ),
            resendLink: (
              <Link
                to="/resend-verification"
                className="font-medium text-accent-strong underline"
              />
            ),
          }}
        />
      </p>
    </section>
  );
}

/** Après l'envoi : le visiteur doit cliquer sur le lien reçu par email. */
export function ExpressSentScreen({
  email,
  summary,
  headingRef,
}: {
  email: string;
  summary: BookingSummaryData;
  headingRef: RefObject<HTMLHeadingElement>;
}) {
  const { t } = useTranslation("client");

  useEffect(() => {
    headingRef.current?.focus();
  }, [headingRef]);

  return (
    <Card className="mx-auto max-w-[35rem] p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
            <path d="M4 7l8 6 8-6" />
          </svg>
        </span>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 text-h3 font-bold text-foreground focus:outline-none"
        >
          {t("booking.flow.express.sent.title")}
        </h2>
        <p className="mt-1.5 max-w-[45ch] text-sm text-foreground-muted">
          {t("booking.flow.express.sent.body", {
            email,
            minutes: LIMITS.expressBookingHoldMinutes,
            barber: summary.barberName,
          })}
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-border p-4">
        <SummaryList data={summary} />
      </div>

      <p className="mt-6 text-center text-sm text-foreground-muted">
        <Trans
          t={t}
          ns="client"
          i18nKey="booking.flow.express.sent.notReceived"
          components={{
            resendLink: (
              <Link
                to="/resend-verification"
                className="font-medium text-accent-strong underline"
              />
            ),
          }}
        />
      </p>
      <div className="mt-4 flex justify-center">
        <Link to="/login" className={buttonClasses("secondary")}>
          {t("booking.flow.express.sent.login")}
        </Link>
      </div>
    </Card>
  );
}
