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
import { formatCurrency, formatDuration } from "../lib/formatters";
import { formatMinutes } from "../lib/time";

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

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl bg-white p-6 shadow"
    >
      <h2 className="font-semibold text-brand-900">Réserver</h2>

      {success && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          Réservation envoyée. Le professionnel doit encore la confirmer.{" "}
          {user?.role === "CLIENT" && (
            <Link to="/appointments" className="underline">
              Voir mes rendez-vous
            </Link>
          )}
        </p>
      )}
      {submitError && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-gray-700">Service</span>
          <select
            value={serviceId}
            onChange={(e) => handleServiceChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
          >
            <option value="">Choisir un service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} — {formatCurrency(service.priceMinor, profile.currency)} ·{" "}
                {formatDuration(service.durationMinutes)}
              </option>
            ))}
          </select>
          {fieldErrors.serviceId && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.serviceId}</p>
          )}
        </label>

        <label className="block">
          <span className="text-sm text-gray-700">Lieu</span>
          <select
            value={place}
            onChange={(e) => handlePlaceChange(e.target.value as ServicePlace | "")}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
          >
            <option value="">Choisir un lieu</option>
            {profile.places.map((code) => (
              <option key={code} value={code}>
                {SERVICE_PLACE_LABELS[code]}
              </option>
            ))}
          </select>
          {fieldErrors.place && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.place}</p>
          )}
        </label>
      </div>

      <label className="block">
        <span className="text-sm text-gray-700">Date</span>
        <input
          type="date"
          value={date}
          min={minDate}
          max={maxDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
        />
        {fieldErrors.date && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.date}</p>
        )}
      </label>

      {place === "AT_CLIENT" && (
        <label className="block">
          <span className="text-sm text-gray-700">Votre adresse</span>
          <input
            type="text"
            value={clientAddress}
            maxLength={LIMITS.clientAddress}
            onChange={(e) => {
              setClientAddress(e.target.value);
              clearFieldError("clientAddress");
            }}
            placeholder="Rue et numéro, code postal, ville"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <p className="mt-1 text-xs text-gray-500">
            Utilisée uniquement pour cette prestation à domicile, dans la zone
            d'intervention du professionnel.
          </p>
          {fieldErrors.clientAddress && (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors.clientAddress}
            </p>
          )}
        </label>
      )}

      <div>
        <span className="text-sm text-gray-700">Créneau</span>
        {!serviceId || !place || !date ? (
          <p className="mt-1 text-sm text-gray-500">
            Sélectionnez un service, un lieu et une date pour afficher les
            créneaux.
          </p>
        ) : slotsLoading ? (
          <p className="mt-1 text-sm text-gray-500">Chargement des créneaux…</p>
        ) : slotsError ? (
          <div className="mt-1 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p>{slotsError}</p>
            <button
              type="button"
              onClick={() => setSlotsReload((t) => t + 1)}
              className="mt-2 rounded-lg border border-brand-700 px-3 py-1 text-brand-700"
            >
              Réessayer
            </button>
          </div>
        ) : slots.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">
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
                    onClick={() => {
                      setStartMinute(slot.startMinute);
                      clearFieldError("startMinute");
                    }}
                    aria-pressed={selected}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      selected
                        ? "border-brand-700 bg-brand-700 text-white"
                        : "border-gray-300 text-gray-800"
                    }`}
                  >
                    {formatMinutes(slot.startMinute)}
                  </button>
                );
              })}
            </div>
            {fieldErrors.startMinute && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.startMinute}
              </p>
            )}
          </>
        )}
      </div>

      {selectedService && (
        <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
          {selectedService.name} ·{" "}
          {formatCurrency(selectedService.priceMinor, profile.currency)} ·{" "}
          {formatDuration(selectedService.durationMinutes)}
        </p>
      )}

      {!user && (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          <Link to="/login" className="text-brand-700 underline">
            Connectez-vous
          </Link>{" "}
          pour envoyer une réservation.
        </p>
      )}
      {user && user.role !== "CLIENT" && (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          Seuls les comptes client peuvent réserver.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !canSubmit}
        className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-50"
      >
        {submitting ? "Envoi…" : "Réserver"}
      </button>
    </form>
  );
}
