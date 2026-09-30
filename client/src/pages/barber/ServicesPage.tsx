import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { OwnBarberService } from "@findbarber/shared/types";
import { LIMITS, type Currency } from "@findbarber/shared/constants";
import { ApiError, barberApi } from "../../lib/apiClient";
import {
  formatCurrency,
  formatDuration,
  minorToInputValue,
  parsePriceToMinor,
} from "../../lib/formatters";

interface ServiceFormValues {
  name: string;
  description: string | null;
  durationMinutes: number;
  priceMinor: number;
}

function ServiceForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial: {
    name: string;
    description: string;
    durationMinutes: string;
    price: string;
  };
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: ServiceFormValues) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [durationMinutes, setDurationMinutes] = useState(initial.durationMinutes);
  const [price, setPrice] = useState(initial.price);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);

    const duration = Number(durationMinutes);
    if (
      !Number.isInteger(duration) ||
      duration < LIMITS.serviceDurationMin ||
      duration > LIMITS.serviceDurationMax
    ) {
      setLocalError(
        `La durée doit être un entier entre ${LIMITS.serviceDurationMin} et ${LIMITS.serviceDurationMax} minutes.`,
      );
      return;
    }

    const priceMinor = parsePriceToMinor(price);
    if (priceMinor === null) {
      setLocalError(
        "Prix invalide. Utilisez un montant comme 25.50 ou 25,50 (2 décimales maximum).",
      );
      return;
    }
    if (priceMinor > LIMITS.servicePriceMinorMax) {
      setLocalError("Le prix est trop élevé.");
      return;
    }

    onSubmit({
      name,
      description: description.trim() ? description.trim() : null,
      durationMinutes: duration,
      priceMinor,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
    >
      {localError && <p className="text-sm text-red-600">{localError}</p>}
      <label className="block">
        <span className="text-sm text-gray-700">Nom du service</span>
        <input
          required
          maxLength={LIMITS.serviceName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm text-gray-700">Description (facultative)</span>
        <input
          maxLength={LIMITS.serviceDescription}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-gray-700">Durée (minutes)</span>
          <input
            required
            type="number"
            inputMode="numeric"
            min={LIMITS.serviceDurationMin}
            max={LIMITS.serviceDurationMax}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Prix</span>
          <input
            required
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="25.50"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Enregistrement…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export function BarberServicesPage() {
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [services, setServices] = useState<OwnBarberService[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, servicesRes] = await Promise.all([
        barberApi.getProfile(),
        barberApi.getServices(),
      ]);
      setCurrency(profileRes.profile.currency);
      setServices(servicesRes.services);
      setProfileMissing(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "BARBER_PROFILE_NOT_FOUND") {
        setProfileMissing(true);
      } else {
        setError(err instanceof Error ? err.message : "Chargement impossible.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreate(values: ServiceFormValues) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await barberApi.createService(values);
      setSuccess("Service ajouté.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ajout échoué.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(id: string, values: ServiceFormValues) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await barberApi.updateService(id, values);
      setEditingId(null);
      setSuccess("Service modifié.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification échouée.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(service: OwnBarberService) {
    setError(null);
    setSuccess(null);
    try {
      await barberApi.updateService(service.id, { isActive: !service.isActive });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action échouée.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 p-8 text-center text-gray-500">
        Chargement…
      </div>
    );
  }

  if (profileMissing) {
    return (
      <div className="min-h-screen bg-brand-50 p-4 sm:p-8">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-center shadow">
          <h1 className="text-xl font-semibold text-brand-900">Mes services</h1>
          <p className="mt-2 text-gray-700">
            Créez d'abord votre profil professionnel pour gérer vos services.
          </p>
          <Link
            to="/pro/profile"
            className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-white"
          >
            Créer mon profil
          </Link>
        </div>
      </div>
    );
  }

  const editingService = services.find((service) => service.id === editingId) ?? null;

  return (
    <div className="min-h-screen bg-brand-50 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">Mes services</h1>
          <p className="mt-1 text-sm text-gray-600">
            <Link to="/pro/dashboard" className="text-brand-700 underline">
              Retour au tableau de bord
            </Link>
          </p>
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</p>
        )}

        <section>
          <h2 className="mb-2 font-semibold text-brand-900">Ajouter un service</h2>
          <ServiceForm
            initial={{ name: "", description: "", durationMinutes: "", price: "" }}
            submitLabel="Ajouter"
            submitting={submitting}
            onSubmit={(values) => void handleCreate(values)}
          />
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-brand-900">
            Services ({services.length})
          </h2>
          {services.length === 0 ? (
            <p className="text-gray-600">Aucun service pour le moment.</p>
          ) : (
            services.map((service) =>
              editingService?.id === service.id ? (
                <ServiceForm
                  key={service.id}
                  initial={{
                    name: service.name,
                    description: service.description ?? "",
                    durationMinutes: String(service.durationMinutes),
                    price: minorToInputValue(service.priceMinor),
                  }}
                  submitLabel="Enregistrer"
                  submitting={submitting}
                  onSubmit={(values) => void handleUpdate(service.id, values)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div
                  key={service.id}
                  className="rounded-xl bg-white p-4 shadow"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-900">{service.name}</p>
                      {service.description && (
                        <p className="mt-1 text-sm text-gray-600">
                          {service.description}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-gray-700">
                        {formatDuration(service.durationMinutes)} ·{" "}
                        {currency
                          ? formatCurrency(service.priceMinor, currency)
                          : `${service.priceMinor}`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        service.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {service.isActive ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setEditingId(service.id)}
                      className="rounded-lg border border-brand-700 px-3 py-1 text-sm text-brand-700"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => void handleToggle(service)}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700"
                    >
                      {service.isActive ? "Désactiver" : "Réactiver"}
                    </button>
                  </div>
                </div>
              ),
            )
          )}
        </section>
      </div>
    </div>
  );
}
