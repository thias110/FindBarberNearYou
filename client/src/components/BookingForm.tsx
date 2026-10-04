import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  LIMITS,
  SERVICE_PLACE_LABELS,
  type ServicePlace,
} from "@findbarber/shared/constants";
import type {
  BookingSlotDto,
  PublicBarberProfile,
  PublicBarberService,
} from "@findbarber/shared/types";
import type { BookingCreateInput } from "@findbarber/shared/validation";
import { useAuth } from "../app/auth-context";
import { barbersApi, bookingApi } from "../lib/apiClient";
import {
  addDays,
  hasErrors,
  toLocalISODate,
  validateBookingForm,
  type BookingFormErrors,
  type BookingFormField,
} from "../lib/booking";
import { cn } from "../lib/cn";
import { formatCurrency, formatDuration } from "../lib/formatters";
import { formatMinutes } from "../lib/time";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";

// Champs tokenisés : surfaces sombres lisibles, cible tactile ≥ 44px.
const FIELD_CLASSES =
  "mt-1 block w-full min-h-[44px] rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function BookingForm({
  barberId,
  profile,
  services,
}: {
  barberId: string;
  profile: PublicBarberProfile;
  services: PublicBarberService[];
}) {
  const { user } = useAuth();

  const [serviceId, setServiceId] = useState("");
  const [place, setPlace] = useState<ServicePlace | "">("");
  const [date, setDate] = useState("");
  const [startMinute, setStartMinute] = useState<number | null>(null);
  const [clientAddress, setClientAddress] = useState("");

  const [fieldErrors, setFieldErrors] = useState<BookingFormErrors>({});
  const [slots, setSlots] = useState<BookingSlotDto[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsReload, setSlotsReload] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const minDate = toLocalISODate(new Date());
  const maxDate = toLocalISODate(addDays(new Date(), LIMITS.bookingHorizonDays));

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
          err instanceof Error ? err.message : "Créneaux indisponibles.",
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
    if (hasErrors(errors)) return;

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
      await bookingApi.create(input);
      setSuccess(true);
    } catch (err) {
      // Le serveur est la source de vérité : on affiche son message (dont
      // SLOT_UNAVAILABLE, PLACE_NOT_OFFERED, OUT_OF_SERVICE_AREA,
      // ADDRESS_NOT_FOUND, GEOCODING_UNAVAILABLE, BARBER_TIMEZONE_MISSING,
      // VALIDATION_ERROR…).
      setSubmitError(
        err instanceof Error ? err.message : "Réservation impossible.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(user && user.role === "CLIENT");
  const formIncomplete =
    !serviceId ||
    !place ||
    !date ||
    startMinute === null ||
    (place === "AT_CLIENT" && clientAddress.trim() === "");

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Réserver</h2>

        {success && (
          <Alert variant="success">
            Réservation envoyée. Le professionnel doit encore la confirmer.{" "}
            {user?.role === "CLIENT" && (
              <Link to="/appointments" className="font-medium underline">
                Voir mes rendez-vous
              </Link>
            )}
          </Alert>
        )}
        {submitError && <Alert variant="danger">{submitError}</Alert>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Service</span>
            <select
              value={serviceId}
              disabled={submitting}
              onChange={(e) => handleServiceChange(e.target.value)}
              className={FIELD_CLASSES}
            >
              <option value="">Choisir un service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} —{" "}
                  {formatCurrency(service.priceMinor, profile.currency)} ·{" "}
                  {formatDuration(service.durationMinutes)}
                </option>
              ))}
            </select>
            {fieldErrors.serviceId && (
              <p className="mt-1 text-xs text-danger">
                {fieldErrors.serviceId}
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-foreground">Lieu</span>
            <select
              value={place}
              disabled={submitting}
              onChange={(e) =>
                handlePlaceChange(e.target.value as ServicePlace | "")
              }
              className={FIELD_CLASSES}
            >
              <option value="">Choisir un lieu</option>
              {profile.places.map((code) => (
                <option key={code} value={code}>
                  {SERVICE_PLACE_LABELS[code]}
                </option>
              ))}
            </select>
            {fieldErrors.place && (
              <p className="mt-1 text-xs text-danger">{fieldErrors.place}</p>
            )}
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Date</span>
          <input
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            disabled={submitting}
            onChange={(e) => handleDateChange(e.target.value)}
            className={FIELD_CLASSES}
          />
          {fieldErrors.date && (
            <p className="mt-1 text-xs text-danger">{fieldErrors.date}</p>
          )}
        </label>

        {place === "AT_CLIENT" && (
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              Votre adresse
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
              placeholder="Rue et numéro, code postal, ville"
              className={FIELD_CLASSES}
            />
            <p className="mt-1 text-xs text-foreground-muted">
              Utilisée uniquement pour cette prestation à domicile, dans la zone
              d'intervention du professionnel.
            </p>
            {fieldErrors.clientAddress && (
              <p className="mt-1 text-xs text-danger">
                {fieldErrors.clientAddress}
              </p>
            )}
          </label>
        )}

        <div>
          <span className="text-sm font-medium text-foreground">Créneau</span>
          {!serviceId || !place || !date ? (
            <p className="mt-1 text-sm text-foreground-muted">
              Sélectionnez un service, un lieu et une date pour afficher les
              créneaux.
            </p>
          ) : slotsLoading ? (
            <div aria-busy="true" className="mt-2 flex flex-wrap gap-2">
              <span className="sr-only" role="status">
                Chargement des créneaux…
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
                onClick={() => setSlotsReload((t) => t + 1)}
              >
                Réessayer
              </Button>
            </Alert>
          ) : slots.length === 0 ? (
            <p className="mt-1 text-sm text-foreground-muted">
              Aucun créneau disponible pour cette date.
            </p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
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
                      className={cn(
                        "inline-flex min-h-[44px] items-center rounded-lg border px-3 text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        selected
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border bg-surface-muted text-foreground",
                      )}
                    >
                      {formatMinutes(slot.startMinute)}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.startMinute && (
                <p className="mt-1 text-xs text-danger">
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
          </Alert>
        )}

        {!user && (
          <Alert variant="info">
            <Link to="/login" className="font-medium text-accent underline">
              Connectez-vous
            </Link>{" "}
            pour envoyer une réservation.
          </Alert>
        )}
        {user && user.role !== "CLIENT" && (
          <Alert variant="warning">
            Seuls les comptes client peuvent réserver.
          </Alert>
        )}

        <Button
          type="submit"
          isLoading={submitting}
          disabled={submitting || !canSubmit || formIncomplete}
          className="min-h-[44px] w-full"
        >
          {submitting ? "Envoi…" : "Réserver"}
        </Button>
      </form>
    </Card>
  );
}
