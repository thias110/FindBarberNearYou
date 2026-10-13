import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { OwnBarberService } from "@findbarber/shared/types";
import {
  AUDIENCE_LABELS,
  AUDIENCES,
  LIMITS,
  TECHNIQUE_LABELS,
  TECHNIQUES,
  type Audience,
  type Currency,
  type Technique,
} from "@findbarber/shared/constants";
import { ApiError, barberApi } from "../../lib/apiClient";
import {
  formatCurrency,
  formatDuration,
  minorToInputValue,
  parsePriceToMinor,
} from "../../lib/formatters";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { ProPageHeader } from "../../components/barber/ProPageHeader";

const CHECKBOX_CLASS = "h-4 w-4 accent-accent";

// Lien stylé comme le bouton primaire du design system (aucun `ButtonLink`).
const PRIMARY_LINK_CLASS =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface ServiceFormValues {
  name: string;
  description: string | null;
  durationMinutes: number;
  priceMinor: number;
  audiences: Audience[];
  techniques: Technique[];
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
    audiences: Audience[];
    techniques: Technique[];
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
  const [audiences, setAudiences] = useState<Audience[]>(initial.audiences);
  const [techniques, setTechniques] = useState<Technique[]>(initial.techniques);
  const [localError, setLocalError] = useState<string | null>(null);

  function toggleAudience(code: Audience) {
    setAudiences((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  }

  function toggleTechnique(code: Technique) {
    setTechniques((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  }

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
      audiences,
      techniques,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border bg-surface-muted p-4"
    >
      {localError && <Alert variant="danger">{localError}</Alert>}
      <Field label="Nom du service">
        {(control) => (
          <Input
            {...control}
            required
            maxLength={LIMITS.serviceName}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </Field>
      <Field label="Description (facultative)">
        {(control) => (
          <Input
            {...control}
            maxLength={LIMITS.serviceDescription}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Durée (minutes)">
          {(control) => (
            <Input
              {...control}
              required
              type="number"
              inputMode="numeric"
              min={LIMITS.serviceDurationMin}
              max={LIMITS.serviceDurationMax}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          )}
        </Field>
        <Field label="Prix">
          {(control) => (
            <Input
              {...control}
              required
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="25.50"
            />
          )}
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Publics</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {AUDIENCES.map((code) => (
            <label
              key={code}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <input
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={audiences.includes(code)}
                onChange={() => toggleAudience(code)}
              />
              {AUDIENCE_LABELS[code]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          Techniques / prestations
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {TECHNIQUES.map((code) => (
            <label
              key={code}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <input
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={techniques.includes(code)}
                onChange={() => toggleTechnique(code)}
              />
              {TECHNIQUE_LABELS[code]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" isLoading={submitting} className="min-h-[44px]">
          {submitting ? "Enregistrement…" : submitLabel}
        </Button>
        {onCancel && (
          <Button
            variant="secondary"
            className="min-h-[44px]"
            onClick={onCancel}
          >
            Annuler
          </Button>
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
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-11 w-44" />
          </div>
          <Card className="space-y-4 p-6" aria-busy="true">
            <span className="sr-only" role="status">
              Chargement des services…
            </span>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (profileMissing) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <ProPageHeader title="Mes services" />
          <Card className="p-6 text-center">
            <p className="text-foreground">
              Créez d'abord votre profil professionnel pour gérer vos services.
            </p>
            <Link to="/pro/profile" className={`${PRIMARY_LINK_CLASS} mt-4`}>
              Créer mon profil
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const editingService = services.find((service) => service.id === editingId) ?? null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <ProPageHeader
          title="Mes services"
          description="Prestations, durées et tarifs."
        />

        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Ajouter un service
          </h2>
          <div className="mt-4">
            <ServiceForm
              initial={{
                name: "",
                description: "",
                durationMinutes: "",
                price: "",
                audiences: [],
                techniques: [],
              }}
              submitLabel="Ajouter"
              submitting={submitting}
              onSubmit={(values) => void handleCreate(values)}
            />
          </div>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Services ({services.length})
          </h2>
          {services.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-foreground-muted">
                Aucun service pour le moment.
              </p>
            </Card>
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
                    audiences: service.audiences,
                    techniques: service.techniques,
                  }}
                  submitLabel="Enregistrer"
                  submitting={submitting}
                  onSubmit={(values) => void handleUpdate(service.id, values)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <Card key={service.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        {service.name}
                      </p>
                      {service.description && (
                        <p className="mt-1 text-sm text-foreground-muted">
                          {service.description}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-foreground">
                        {formatDuration(service.durationMinutes)} ·{" "}
                        {currency
                          ? formatCurrency(service.priceMinor, currency)
                          : `${service.priceMinor}`}
                      </p>
                    </div>
                    <Badge variant={service.isActive ? "success" : "neutral"}>
                      {service.isActive ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="min-h-[44px]"
                      onClick={() => setEditingId(service.id)}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-[44px]"
                      onClick={() => void handleToggle(service)}
                    >
                      {service.isActive ? "Désactiver" : "Réactiver"}
                    </Button>
                  </div>
                </Card>
              ),
            )
          )}
        </section>
      </div>
    </div>
  );
}
