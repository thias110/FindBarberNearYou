import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LIMITS, type ServicePlace } from "@findbarber/shared/constants";
import type {
  BookingSlotDto,
  PublicBarberProfile,
  PublicBarberService,
} from "@findbarber/shared/types";
import type { BookingCreateInput } from "@findbarber/shared/validation";
import { useAuth } from "../app/auth-context";
import i18n from "../i18n";
import { ApiError, barbersApi, bookingApi } from "../lib/apiClient";
import { fieldErrorsFrom, focusFirstInvalid } from "../lib/formErrors";
import {
  addDays,
  hasErrors,
  toLocalISODate,
  validateBookingForm,
  type BookingFormErrors,
  type BookingFormField,
} from "../lib/booking";
import { amountDueOnline } from "@findbarber/shared/booking";
import { formatCurrency, formatDuration } from "../lib/formatters";
import { label } from "../lib/labels";
import { formatMinutes } from "../lib/time";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { chipClasses } from "./ui/chipStyles";
import { CONTROL_CLASS } from "./ui/control";

const BOOKING_FIELDS: readonly BookingFormField[] = [
  "serviceId",
  "place",
  "date",
  "startMinute",
  "clientAddress",
];

// Refus du serveur rattachés à un champ du formulaire (issue #57).
const FIELD_BY_ERROR_CODE: Record<string, BookingFormField> = {
  SLOT_UNAVAILABLE: "startMinute",
  PLACE_NOT_OFFERED: "place",
  ADDRESS_NOT_FOUND: "clientAddress",
  OUT_OF_SERVICE_AREA: "clientAddress",
  SERVICE_NOT_FOUND: "serviceId",
};

// Mêmes classes que les champs du design system (issue #28).
const FIELD_CLASSES = `mt-1 ${CONTROL_CLASS}`;

export function BookingForm({
  barberId,
  profile,
  services,
}: {
  barberId: string;
  profile: PublicBarberProfile;
  services: PublicBarberService[];
}) {
  const { t } = useTranslation("client");
  const { user } = useAuth();

  const [serviceId, setServiceId] = useState("");
  const [place, setPlace] = useState<ServicePlace | "">("");
  const [date, setDate] = useState("");
  const [startMinute, setStartMinute] = useState<number | null>(null);
  const [clientAddress, setClientAddress] = useState("");

  const [fieldErrors, setFieldErrors] = useState<BookingFormErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const idPrefix = useId();

  // Liaison champ ↔ message d'erreur (issue #57) : `aria-invalid` et
  // `aria-describedby` pour que le lecteur d'écran annonce l'erreur.
  function errorId(field: BookingFormField): string {
    return `${idPrefix}-${field}-error`;
  }
  function invalidProps(field: BookingFormField) {
    return fieldErrors[field]
      ? { "aria-invalid": true as const, "aria-describedby": errorId(field) }
      : {};
  }
  const [slots, setSlots] = useState<BookingSlotDto[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsReload, setSlotsReload] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const minDate = toLocalISODate(new Date());
  const maxDate = toLocalISODate(
    addDays(new Date(), LIMITS.bookingHorizonDays),
  );

  const selectedService = services.find((service) => service.id === serviceId);

  function clearFieldError(field: BookingFormField) {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function resetSlotSelection() {
    setStartMinute(null);
    setSlots([]);
    setSlotsError(null);
    clearFieldError("startMinute");
  }

  function handleServiceChange(value: string) {
    setServiceId(value);
    resetSlotSelection();
    clearFieldError("serviceId");
  }

  function handlePlaceChange(value: ServicePlace | "") {
    setPlace(value);
    resetSlotSelection();
    if (value !== "AT_CLIENT") setClientAddress("");
    clearFieldError("place");
    clearFieldError("clientAddress");
  }

  function handleDateChange(value: string) {
    setDate(value);
    resetSlotSelection();
    clearFieldError("date");
  }

  // Les créneaux sont publics : ils se rechargent dès que les trois critères
  // sont complets. L'appel est annulé si l'utilisateur change un critère.
  useEffect(() => {
    if (!serviceId || !place || !date) {
      setSlots([]);
      setSlotsError(null);
      setSlotsLoading(false);
      return;
    }

    const controller = new AbortController();
    setSlotsLoading(true);
    setSlotsError(null);
    setSlots([]);

    barbersApi
      .getSlots(
        barberId,
        { serviceId, date, place: place as ServicePlace },
        controller.signal,
      )
      .then((res) => {
        setSlots(res.slots);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSlotsError(
          err instanceof Error
            ? err.message
            : i18n.t("client:booking.form.slotsUnavailable"),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setSlotsLoading(false);
      });

    return () => controller.abort();
  }, [barberId, serviceId, place, date, slotsReload]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setSuccess(false);

    const errors = validateBookingForm({
      serviceId,
      place,
      date,
      startMinute,
      clientAddress,
    });
    setFieldErrors(errors);
    if (hasErrors(errors)) {
      focusFirstInvalid(formRef.current);
      return;
    }

    if (!user || user.role !== "CLIENT") return;

    const input: BookingCreateInput = {
      barberId,
      serviceId,
      date,
      startMinute: startMinute as number,
      place: place as ServicePlace,
    };
    if (place === "AT_CLIENT") {
      input.clientAddress = clientAddress.trim();
    }

    setSubmitting(true);
    try {
      const result = await bookingApi.create(input);
      // Paiement en ligne exigé (issue #10) : direction Stripe Checkout. La
      // demande n'est transmise au barber qu'une fois le paiement reçu.
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setSuccess(true);
    } catch (err) {
      // Le serveur est la source de vérité : on affiche son message (dont
      // SLOT_UNAVAILABLE, PLACE_NOT_OFFERED, OUT_OF_SERVICE_AREA,
      // ADDRESS_NOT_FOUND, GEOCODING_UNAVAILABLE, BARBER_TIMEZONE_MISSING,
      // VALIDATION_ERROR…).
      // Un refus lié à un champ s'affiche sous ce champ (issue #57).
      const field = err instanceof ApiError ? FIELD_BY_ERROR_CODE[err.code] : undefined;
      const fields: BookingFormErrors = field
        ? { [field]: (err as ApiError).message }
        : fieldErrorsFrom(err, BOOKING_FIELDS);
      if (hasErrors(fields)) {
        setFieldErrors(fields);
        focusFirstInvalid(formRef.current);
      } else {
        setSubmitError(
          err instanceof Error ? err.message : t("booking.form.bookingFailed"),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(user && user.role === "CLIENT");
  const onlineAmount = selectedService
    ? amountDueOnline(
        profile.onlinePayment.mode,
        profile.onlinePayment.depositPercent,
        selectedService.priceMinor,
      )
    : 0;
  const formIncomplete =
    !serviceId ||
    !place ||
    !date ||
    startMinute === null ||
    (place === "AT_CLIENT" && clientAddress.trim() === "");

  return (
    <Card className="p-6">
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">{t("booking.form.title")}</h2>

        {success && (
          <Alert variant="success">
            {t("booking.form.success")}{" "}
            {user?.role === "CLIENT" && (
              <Link to="/appointments" className="font-medium underline">
                {t("booking.form.viewAppointments")}
              </Link>
            )}
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <label className="block">
            <span className="text-sm font-semibold text-foreground">
              {t("booking.form.service")}
            </span>
            <select
              value={serviceId}
              disabled={submitting}
              onChange={(e) => handleServiceChange(e.target.value)}
              className={FIELD_CLASSES}
              {...invalidProps("serviceId")}
            >
              <option value="">{t("booking.form.servicePlaceholder")}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} —{" "}
                  {formatCurrency(service.priceMinor, profile.currency)} ·{" "}
                  {formatDuration(service.durationMinutes)}
                </option>
              ))}
            </select>
            {fieldErrors.serviceId && (
              <p id={errorId("serviceId")} className="mt-1 text-xs text-danger">
                {fieldErrors.serviceId}
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-foreground">
              {t("booking.form.place")}
            </span>
            <select
              value={place}
              disabled={submitting}
              onChange={(e) =>
                handlePlaceChange(e.target.value as ServicePlace | "")
              }
              className={FIELD_CLASSES}
              {...invalidProps("place")}
            >
              <option value="">{t("booking.form.placePlaceholder")}</option>
              {profile.places.map((code) => (
                <option key={code} value={code}>
                  {label("servicePlace", code)}
                </option>
              ))}
            </select>
            {fieldErrors.place && (
              <p id={errorId("place")} className="mt-1 text-xs text-danger">
                {fieldErrors.place}
              </p>
            )}
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-foreground">
            {t("booking.form.date")}
          </span>
          <input
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            disabled={submitting}
            onChange={(e) => handleDateChange(e.target.value)}
            className={FIELD_CLASSES}
            {...invalidProps("date")}
          />
          {fieldErrors.date && (
            <p id={errorId("date")} className="mt-1 text-xs text-danger">
              {fieldErrors.date}
            </p>
          )}
        </label>

        {place === "AT_CLIENT" && (
          <label className="block">
            <span className="text-sm font-semibold text-foreground">
              {t("booking.form.address")}
            </span>
            <input
              type="text"
              value={clientAddress}
              maxLength={LIMITS.clientAddress}
              disabled={submitting}
              onChange={(e) => {
                setClientAddress(e.target.value);
                clearFieldError("clientAddress");
              }}
              placeholder={t("booking.form.addressPlaceholder")}
              className={FIELD_CLASSES}
              {...invalidProps("clientAddress")}
            />
            <p className="mt-1 text-xs text-foreground-muted">
              {t("booking.form.addressHelp")}
            </p>
            {fieldErrors.clientAddress && (
              <p id={errorId("clientAddress")} className="mt-1 text-xs text-danger">
                {fieldErrors.clientAddress}
              </p>
            )}
          </label>
        )}

        <div>
          <span className="text-sm font-semibold text-foreground">
            {t("booking.form.slot")}
          </span>
          {!serviceId || !place || !date ? (
            <p className="mt-1 text-sm text-foreground-muted">
              {t("booking.form.slotHint")}
            </p>
          ) : slotsLoading ? (
            <div aria-busy="true" className="mt-2 flex flex-wrap gap-2">
              <span className="sr-only" role="status">
                {t("booking.form.slotsLoading")}
              </span>
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-11 w-20 rounded-lg" />
              ))}
            </div>
          ) : slotsError ? (
            <Alert variant="danger" className="mt-2">
              <p>{slotsError}</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-2 min-h-[44px]"
                onClick={() => setSlotsReload((n) => n + 1)}
              >
                {t("booking.form.retry")}
              </Button>
            </Alert>
          ) : slots.length === 0 ? (
            <p className="mt-1 text-sm text-foreground-muted">
              {t("booking.form.noSlots")}
            </p>
          ) : (
            <>
              <div
                role="group"
                aria-label={t("booking.form.slotsGroup")}
                aria-describedby={
                  fieldErrors.startMinute ? errorId("startMinute") : undefined
                }
                data-invalid={fieldErrors.startMinute ? "true" : undefined}
                className="mt-2 flex flex-wrap gap-2"
              >
                {slots.map((slot) => {
                  const selected = startMinute === slot.startMinute;
                  return (
                    <button
                      key={slot.startMinute}
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setStartMinute(slot.startMinute);
                        clearFieldError("startMinute");
                      }}
                      aria-pressed={selected}
                      className={chipClasses(selected, {
                        tone: "accent",
                        className: "tabular-nums",
                      })}
                    >
                      {formatMinutes(slot.startMinute)}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.startMinute && (
                <p id={errorId("startMinute")} className="mt-1 text-xs text-danger">
                  {fieldErrors.startMinute}
                </p>
              )}
            </>
          )}
        </div>

        {selectedService && (
          <Alert variant="info">
            {selectedService.name} ·{" "}
            {formatCurrency(selectedService.priceMinor, profile.currency)} ·{" "}
            {formatDuration(selectedService.durationMinutes)}
            {onlineAmount > 0 && (
              <span className="mt-1 block">
                {onlineAmount === selectedService.priceMinor
                  ? t("booking.form.onlineFull")
                  : t("booking.form.onlineDeposit", {
                      amount: formatCurrency(onlineAmount, profile.currency),
                    })}{" "}
                {t("booking.form.onlineDetails")}
              </span>
            )}
          </Alert>
        )}

        {!user && (
          <Alert variant="info">
            <Trans
              t={t}
              i18nKey="booking.form.loginPrompt"
              components={{
                link: (
                  <Link
                    to="/login"
                    className="font-medium text-accent-strong underline"
                  />
                ),
              }}
            />
          </Alert>
        )}
        {user && user.role !== "CLIENT" && (
          <Alert variant="warning">
            {t("booking.form.clientsOnly")}
          </Alert>
        )}

        {/* Erreur globale juste au-dessus du bouton (issue #57). */}
        {submitError && <Alert variant="danger">{submitError}</Alert>}

        <Button
          type="submit"
          isLoading={submitting}
          disabled={submitting || !canSubmit || formIncomplete}
          className="min-h-[44px] w-full"
        >
          {submitting
            ? t("booking.form.submitting")
            : onlineAmount > 0
              ? t("booking.form.submitAndPay")
              : t("booking.form.submit")}
        </Button>
      </form>
    </Card>
  );
}
