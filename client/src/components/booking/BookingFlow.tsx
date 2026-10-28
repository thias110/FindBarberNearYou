import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LIMITS, LOCALES, type ServicePlace } from "@findbarber/shared/constants";
import { amountDueOnline } from "@findbarber/shared/booking";
import type {
  Booking,
  BookingSlotsDay,
  PublicBarberProfile,
  PublicBarberService,
} from "@findbarber/shared/types";
import type { BookingCreateInput } from "@findbarber/shared/validation";
import { useAuth } from "../../app/auth-context";
import { ApiError, barbersApi, bookingApi } from "../../lib/apiClient";
import {
  hasErrors,
  toLocalISODate,
  validateBookingForm,
  type BookingFormErrors,
  type BookingFormField,
} from "../../lib/booking";
import {
  WEEK_LENGTH,
  canGoToNextWeek,
  canGoToPreviousWeek,
  weekDates,
  weekRequestDays,
  weekStart,
} from "../../lib/bookingWeek";
import { cn } from "../../lib/cn";
import { fieldErrorsFrom, focusFirstInvalid } from "../../lib/formErrors";
import {
  EMPTY_EXPRESS,
  EXPRESS_FIELDS,
  validateExpress,
  type ExpressErrors,
  type ExpressValues,
} from "../../lib/expressBooking";
import { formatCurrency, formatDuration } from "../../lib/formatters";
import { downloadIcs } from "../../lib/ics";
import { label } from "../../lib/labels";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { buttonClasses } from "../ui/buttonStyles";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Select } from "../ui/Select";
import {
  BookingSummaryAside,
  BookingSummaryBar,
  SummaryList,
  type BookingSummaryData,
} from "./BookingSummary";
import { ExpressFields, ExpressSentScreen } from "./ExpressFields";
import { WeekGrid, type SelectedSlot } from "./WeekGrid";

type Step = 1 | 2 | 3;

const BOOKING_FIELDS: readonly BookingFormField[] = [
  "serviceId",
  "place",
  "date",
  "startMinute",
  "clientAddress",
];

// Étape qui porte chaque champ : une erreur ramène à la première concernée.
const STEP_OF_FIELD: Record<BookingFormField, Step> = {
  serviceId: 1,
  place: 1,
  clientAddress: 1,
  date: 2,
  startMinute: 2,
};

// Refus du serveur rattachés à un champ du formulaire (issue #57).
const FIELD_BY_ERROR_CODE: Record<string, BookingFormField> = {
  SLOT_UNAVAILABLE: "startMinute",
  PLACE_NOT_OFFERED: "place",
  ADDRESS_NOT_FOUND: "clientAddress",
  OUT_OF_SERVICE_AREA: "clientAddress",
  SERVICE_NOT_FOUND: "serviceId",
};

const STEP_KEYS = ["service", "slot", "confirm"] as const;

function pickErrors(
  errors: BookingFormErrors,
  step: Step,
): BookingFormErrors {
  const picked: BookingFormErrors = {};
  for (const field of BOOKING_FIELDS) {
    const message = errors[field];
    if (message && STEP_OF_FIELD[field] <= step) picked[field] = message;
  }
  return picked;
}

// La barre de résumé mobile se pose au-dessus de la barre d'onglets des
// espaces connectés (64 px + zone de sécurité).
const BAR_ABOVE_TAB_BAR = "bottom-[calc(4rem+env(safe-area-inset-bottom))]";
const BAR_AT_EDGE = "bottom-0";

export function BookingFlow({
  barberId,
  profile,
  services,
  externalSelection = null,
  onServiceChange,
}: {
  barberId: string;
  profile: PublicBarberProfile;
  services: PublicBarberService[];
  externalSelection?: { id: string; seq: number } | null;
  onServiceChange?: (serviceId: string) => void;
}) {
  const { t, i18n } = useTranslation("client");
  const { user } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [serviceId, setServiceId] = useState("");
  const [place, setPlace] = useState<ServicePlace | "">(
    profile.places.length === 1 ? profile.places[0] : "",
  );
  const [clientAddress, setClientAddress] = useState("");
  const [selected, setSelected] = useState<SelectedSlot | null>(null);

  const [today] = useState(() => toLocalISODate(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekData, setWeekData] = useState<BookingSlotsDay[] | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [fieldErrors, setFieldErrors] = useState<BookingFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  // Réservation express (lot N6) : visiteur sans compte.
  const [express, setExpress] = useState<ExpressValues>(EMPTY_EXPRESS);
  const [expressErrors, setExpressErrors] = useState<ExpressErrors>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef<Step>(1);
  const appliedSeqRef = useRef(0);
  const idPrefix = useId();

  const horizon = LIMITS.bookingHorizonDays;
  const selectedService = services.find((service) => service.id === serviceId);
  const dates = weekDates(weekStart(today, weekOffset), WEEK_LENGTH);

  function errorId(field: BookingFormField): string {
    return `${idPrefix}-${field}-error`;
  }

  function clearFieldError(field: BookingFormField) {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function resetSlotSelection() {
    setSelected(null);
    setWeekData(null);
    setWeekOffset(0);
    clearFieldError("startMinute");
    clearFieldError("date");
  }

  function handleServiceChange(value: string) {
    setServiceId(value);
    onServiceChange?.(value);
    resetSlotSelection();
    clearFieldError("serviceId");
  }

  useEffect(() => {
    if (!externalSelection || externalSelection.seq === appliedSeqRef.current) return;
    appliedSeqRef.current = externalSelection.seq;
    setServiceId(externalSelection.id);
    onServiceChange?.(externalSelection.id);
    setSelected(null);
    setWeekData(null);
    setWeekOffset(0);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.serviceId;
      delete next.startMinute;
      delete next.date;
      return next;
    });
    setStep(1);
  }, [externalSelection, onServiceChange]);

  function handlePlaceChange(value: ServicePlace | "") {
    setPlace(value);
    resetSlotSelection();
    if (value !== "AT_CLIENT") setClientAddress("");
    clearFieldError("place");
    clearFieldError("clientAddress");
  }

  // Le titre de l'étape reçoit le focus à chaque changement d'étape, pour le
  // clavier et les lecteurs d'écran. Pas au premier rendu : `#reserver` garde
  // le focus demandé par le lien « Réserver ».
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    headingRef.current?.focus();
  }, [step]);

  // Les créneaux sont publics : la semaine affichée se charge dès l'étape 2,
  // et se recharge à chaque changement de semaine. L'appel est annulé si
  // l'utilisateur change de semaine ou de critère.
  useEffect(() => {
    if (step !== 2 || !serviceId || !place) return;

    const days = weekRequestDays(today, weekOffset, horizon);
    if (days === 0) {
      setWeekData([]);
      setWeekError(null);
      setWeekLoading(false);
      return;
    }

    const controller = new AbortController();
    setWeekLoading(true);
    setWeekError(null);

    barbersApi
      .getSlotsRange(
        barberId,
        {
          serviceId,
          place,
          from: weekStart(today, weekOffset),
          days,
        },
        controller.signal,
      )
      .then((res) => {
        setWeekData(res.days);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setWeekData(null);
        setWeekError(
          err instanceof Error ? err.message : t("booking.flow.slots.unavailable"),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setWeekLoading(false);
      });

    return () => controller.abort();
  }, [step, barberId, serviceId, place, weekOffset, reload, today, horizon, t]);

  function goTo(next: Step) {
    setStep(next);
  }

  function handleContinue() {
    const errors = pickErrors(
      validateBookingForm({
        serviceId,
        place,
        date: selected?.date ?? "",
        startMinute: selected?.slot.startMinute ?? null,
        clientAddress,
      }),
      step,
    );
    setFieldErrors((current) => ({ ...current, ...errors }));
    if (hasErrors(errors)) {
      focusFirstInvalid(formRef.current);
      return;
    }
    goTo(step === 1 ? 2 : 3);
  }

  async function handleSubmit() {
    // Entrée pressée deux fois : un seul envoi.
    if (submitting) return;
    setSubmitError(null);

    const errors = validateBookingForm({
      serviceId,
      place,
      date: selected?.date ?? "",
      startMinute: selected?.slot.startMinute ?? null,
      clientAddress,
    });
    setFieldErrors(errors);
    if (hasErrors(errors)) {
      goTo(Math.min(...Object.keys(errors).map((f) => STEP_OF_FIELD[f as BookingFormField])) as Step);
      focusFirstInvalid(formRef.current);
      return;
    }

    if (!selected) return;
    // Visiteur sans compte : réservation express, si le barber ne demande pas
    // de paiement en ligne (lot N6).
    const visitor = !user;
    if (visitor && !expressAllowed) return;
    if (!visitor && user.role !== "CLIENT") return;
    if (visitor) {
      const errors = validateExpress(express, t);
      setExpressErrors(errors);
      if (Object.keys(errors).length > 0) {
        focusFirstInvalid(formRef.current);
        return;
      }
    }

    const input: BookingCreateInput = {
      barberId,
      serviceId,
      date: selected.date,
      startMinute: selected.slot.startMinute,
      place: place as ServicePlace,
    };
    if (place === "AT_CLIENT") {
      input.clientAddress = clientAddress.trim();
    }

    setSubmitting(true);
    try {
      if (visitor) {
        await bookingApi.createExpress({
          ...input,
          name: express.name.trim(),
          email: express.email.trim(),
          website: express.website,
          locale: LOCALES.find((code) => code === i18n.resolvedLanguage),
        });
        setSentTo(express.email.trim());
        return;
      }
      const result = await bookingApi.create(input);
      // Paiement en ligne exigé (issue #10) : direction Stripe Checkout. La
      // demande n'est transmise au barber qu'une fois le paiement reçu.
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setConfirmed(result.booking);
    } catch (err) {
      // Le serveur est la source de vérité : on affiche son message (dont
      // SLOT_UNAVAILABLE, PLACE_NOT_OFFERED, OUT_OF_SERVICE_AREA,
      // ADDRESS_NOT_FOUND, GEOCODING_UNAVAILABLE, BARBER_TIMEZONE_MISSING,
      // VALIDATION_ERROR…). Un refus lié à un champ s'affiche sous ce champ
      // (issue #57), à l'étape qui le porte.
      if (visitor) {
        // Email déjà connu : connexion demandée, jamais de fusion de comptes.
        const accountErrors: ExpressErrors =
          err instanceof ApiError && err.code === "EMAIL_TAKEN"
            ? { email: t("booking.flow.express.errors.emailTaken") }
            : fieldErrorsFrom(err, EXPRESS_FIELDS);
        if (Object.keys(accountErrors).length > 0) {
          setExpressErrors(accountErrors);
          focusFirstInvalid(formRef.current);
          return;
        }
      }
      const field = err instanceof ApiError ? FIELD_BY_ERROR_CODE[err.code] : undefined;
      const fields: BookingFormErrors = field
        ? { [field]: (err as ApiError).message }
        : fieldErrorsFrom(err, BOOKING_FIELDS);
      if (hasErrors(fields)) {
        setFieldErrors(fields);
        // Créneau pris entre-temps : message sous la grille, puis la semaine
        // est rechargée sans le créneau disparu.
        if (field === "startMinute") {
          setSelected(null);
          setWeekData(null);
          setReload((n) => n + 1);
        }
        goTo(
          Math.min(
            ...Object.keys(fields).map((f) => STEP_OF_FIELD[f as BookingFormField]),
          ) as Step,
        );
        focusFirstInvalid(formRef.current);
      } else {
        setSubmitError(
          err instanceof Error ? err.message : t("booking.flow.bookingFailed"),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    if (step < 3) handleContinue();
    else void handleSubmit();
  }

  const onlineAmount = selectedService
    ? amountDueOnline(
        profile.onlinePayment.mode,
        profile.onlinePayment.depositPercent,
        selectedService.priceMinor,
      )
    : 0;
  // Réservation express (lot N6) : réservée aux visiteurs, et seulement sans
  // paiement en ligne (sinon un compte classique reste demandé).
  const expressAllowed = !user && onlineAmount === 0;
  const canSubmit = Boolean(user && user.role === "CLIENT") || expressAllowed;

  const summary: BookingSummaryData = {
    barberName: profile.displayName,
    currency: profile.currency,
    serviceName: selectedService?.name,
    durationMinutes: selectedService?.durationMinutes,
    priceMinor: selectedService?.priceMinor,
    place,
    date: selected?.date,
    startMinute: selected?.slot.startMinute,
    onlineAmount,
  };

  const authNotice = (
    <>
      {!user && !expressAllowed && (
        <Alert variant="info">
          <Trans
            t={t}
            ns="client"
            i18nKey={
              onlineAmount > 0
                ? "booking.flow.express.paymentNeedsAccount"
                : "booking.flow.loginPrompt"
            }
            components={{
              loginLink: (
                <Link
                  to="/login"
                  className="font-medium text-accent-strong underline"
                />
              ),
              registerLink: (
                <Link
                  to="/register"
                  className="font-medium text-accent-strong underline"
                />
              ),
            }}
          />
        </Alert>
      )}
      {user && user.role !== "CLIENT" && (
        <Alert variant="warning">{t("booking.flow.clientsOnly")}</Alert>
      )}
    </>
  );

  // --- Réservation express envoyée : reste le clic sur le lien de l'email ---
  if (sentTo) {
    return (
      <ExpressSentScreen email={sentTo} summary={summary} headingRef={headingRef} />
    );
  }

  // --- Écran de confirmation -------------------------------------------------
  if (confirmed) {
    return (
      <ConfirmationScreen
        booking={confirmed}
        summary={summary}
        profile={profile}
        clientAddress={clientAddress.trim()}
        headingRef={headingRef}
      />
    );
  }

  const stepTitle = t(`booking.flow.steps.${STEP_KEYS[step - 1]}`);
  const slotError = fieldErrors.startMinute ?? fieldErrors.date;
  const bottomClass = user && user.role !== "ADMIN" ? BAR_ABOVE_TAB_BAR : BAR_AT_EDGE;

  return (
    <form
      ref={formRef}
      onSubmit={handleFormSubmit}
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
    >
      <div className="min-w-0">
        <Card className="rounded-3xl border-border/80 p-5 shadow-card sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-foreground">{t("booking.flow.title")}</h2>
            <p className="rounded-full border border-border/70 bg-surface-muted px-3 py-1 text-xs font-bold tabular-nums text-foreground-muted">
              {t("booking.flow.progress", { current: step, total: 3 })}
            </p>
          </div>

          <div aria-hidden="true" className="mt-4 grid grid-cols-3 gap-2.5">
            {([1, 2, 3] as const).map((index) => {
              const active = index === step;
              const completed = index < step;
              return (
                <div key={index} className="space-y-2">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-colors duration-base",
                      active || completed ? "bg-accent" : "bg-border",
                    )}
                  />
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                        active
                          ? "bg-accent text-accent-foreground shadow-1"
                          : completed
                            ? "bg-accent-soft text-accent-strong"
                            : "bg-surface-muted text-foreground-muted",
                      )}
                    >
                      {completed ? "✓" : index}
                    </span>
                    <span
                      className={cn(
                        "truncate text-xs font-medium",
                        active ? "font-bold text-foreground" : "text-foreground-muted",
                      )}
                    >
                      {t(`booking.flow.steps.${STEP_KEYS[index - 1]}`)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <h3
            ref={headingRef}
            tabIndex={-1}
            className="mt-5 border-t border-border/70 pt-4 text-h3 font-bold text-foreground focus:outline-none"
          >
            {stepTitle}
          </h3>

          {step === 1 && (
            <div className="mt-4 space-y-5">
              <Field label={t("booking.flow.service.label")} error={fieldErrors.serviceId}>
                {(control) => (
                  <Select
                    {...control}
                    value={serviceId}
                    onChange={(e) => handleServiceChange(e.target.value)}
                  >
                    <option value="">{t("booking.flow.service.placeholder")}</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} — {formatCurrency(service.priceMinor, profile.currency)} ·{" "}
                        {formatDuration(service.durationMinutes)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              {selectedService && (
                <div className="rounded-2xl border border-accent/25 bg-accent-soft/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        {selectedService.name}
                      </p>
                      {selectedService.description && (
                        <p className="mt-0.5 text-xs leading-relaxed text-foreground-muted">
                          {selectedService.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-base font-extrabold tabular-nums text-foreground">
                        {formatCurrency(selectedService.priceMinor, profile.currency)}
                      </p>
                      <Badge variant="neutral" size="sm" className="mt-1">
                        {formatDuration(selectedService.durationMinutes)}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              <div data-invalid={fieldErrors.place ? "true" : undefined}>
                <p id={`${idPrefix}-place-label`} className="text-sm font-semibold text-foreground">
                  {t("booking.flow.place.label")}
                </p>
                <SegmentedControl
                  label={t("booking.flow.place.label")}
                  className="mt-1.5 max-w-full overflow-x-auto"
                  value={place}
                  onChange={handlePlaceChange}
                  options={profile.places.map((code) => ({
                    value: code,
                    label: label("servicePlace", code),
                  }))}
                />
                {fieldErrors.place && (
                  <p id={errorId("place")} role="alert" className="mt-1.5 text-sm text-danger">
                    {fieldErrors.place}
                  </p>
                )}
              </div>

              {place === "AT_CLIENT" && (
                <Field
                  label={t("booking.flow.address.label")}
                  hint={t("booking.flow.address.help")}
                  error={fieldErrors.clientAddress}
                >
                  {(control) => (
                    <Input
                      {...control}
                      value={clientAddress}
                      maxLength={LIMITS.clientAddress}
                      placeholder={t("booking.flow.address.placeholder")}
                      onChange={(e) => {
                        setClientAddress(e.target.value);
                        clearFieldError("clientAddress");
                      }}
                    />
                  )}
                </Field>
              )}

              {authNotice}

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  className="w-full shadow-cta sm:w-auto"
                  onClick={handleContinue}
                >
                  {t("booking.flow.next")}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-4 space-y-4">
              <WeekGrid
                dates={dates}
                today={today}
                days={weekData}
                loading={weekLoading}
                error={weekError}
                selected={selected}
                canPrevious={canGoToPreviousWeek(weekOffset)}
                canNext={canGoToNextWeek(today, weekOffset, horizon)}
                onPrevious={() => setWeekOffset((n) => Math.max(0, n - 1))}
                onNext={() => setWeekOffset((n) => n + 1)}
                onRetry={() => setReload((n) => n + 1)}
                onSelect={(selection) => {
                  setSelected(selection);
                  clearFieldError("startMinute");
                  clearFieldError("date");
                }}
                invalid={Boolean(slotError)}
                errorId={errorId("startMinute")}
              />
              {slotError && (
                <Alert variant="danger">
                  <p id={errorId("startMinute")}>{slotError}</p>
                </Alert>
              )}
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
                <Button type="button" variant="ghost" onClick={() => goTo(1)}>
                  {t("booking.flow.back")}
                </Button>
                <Button type="button" className="shadow-cta" onClick={handleContinue}>
                  {t("booking.flow.next")}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-border bg-surface-muted/30 p-4 lg:hidden">
                <SummaryList data={summary} />
              </div>
              {onlineAmount > 0 && selectedService && (
                <Alert variant="info">
                  {onlineAmount === selectedService.priceMinor
                    ? t("booking.flow.onlineFull")
                    : t("booking.flow.onlineDeposit", {
                        amount: formatCurrency(onlineAmount, profile.currency),
                      })}{" "}
                  {t("booking.flow.onlineDetails")}
                </Alert>
              )}
              {expressAllowed && (
                <ExpressFields
                  values={express}
                  errors={expressErrors}
                  onChange={(field, value) => {
                    setExpress((current) => ({ ...current, [field]: value }));
                    setExpressErrors((current) => {
                      if (!(field in current)) return current;
                      const next = { ...current };
                      delete next[field as keyof ExpressErrors];
                      return next;
                    });
                  }}
                />
              )}
              {authNotice}
              {/* Erreur globale juste au-dessus du bouton (issue #57). */}
              {submitError && <Alert variant="danger">{submitError}</Alert>}
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => goTo(2)}
                >
                  {t("booking.flow.back")}
                </Button>
                <Button
                  type="submit"
                  className="shadow-cta"
                  isLoading={submitting}
                  disabled={submitting || !canSubmit}
                >
                  {submitting
                    ? t("booking.flow.submitting")
                    : onlineAmount > 0
                      ? t("booking.flow.submitAndPay")
                      : t("booking.flow.submit")}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {step < 3 && <BookingSummaryBar data={summary} bottomClassName={bottomClass} />}
      </div>

      <BookingSummaryAside data={summary} />
    </form>
  );
}

function ConfirmationScreen({
  booking,
  summary,
  profile,
  clientAddress,
  headingRef,
}: {
  booking: Booking;
  summary: BookingSummaryData;
  profile: PublicBarberProfile;
  clientAddress: string;
  headingRef: RefObject<HTMLHeadingElement>;
}) {
  const { t } = useTranslation("client");
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
    const frame = window.requestAnimationFrame(() => setDrawn(true));
    return () => window.cancelAnimationFrame(frame);
  }, [headingRef]);

  function addToCalendar() {
    downloadIcs({
      uid: booking.id,
      title: `${booking.serviceName} — ${booking.barberDisplayName}`,
      startAt: booking.startAt,
      endAt: booking.endAt,
      location: booking.servicePlace === "AT_CLIENT" ? clientAddress : profile.city,
      description: `${booking.serviceName} (${formatDuration(booking.durationMinutes)})`,
    });
  }

  return (
    <Card className="mx-auto max-w-[35rem] p-6 shadow-card sm:p-8">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success ring-1 ring-success/25">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              style={{
                strokeDasharray: 22,
                strokeDashoffset: drawn ? 0 : 22,
                transition: "stroke-dashoffset 240ms cubic-bezier(.22,1,.36,1)",
              }}
            />
          </svg>
        </span>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 text-h3 font-bold text-foreground focus:outline-none"
        >
          {t("booking.flow.confirmation.title")}
        </h2>
        <p className="mt-1.5 max-w-[45ch] text-sm text-foreground-muted">
          {t("booking.flow.confirmation.body")}
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-border p-4">
        <SummaryList data={summary} />
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button variant="secondary" onClick={addToCalendar}>
          {t("booking.flow.confirmation.addToCalendar")}
        </Button>
        <Link to="/appointments" className={buttonClasses("primary", "md", "shadow-cta")}>
          {t("booking.flow.confirmation.viewAppointments")}
        </Link>
      </div>
    </Card>
  );
}
