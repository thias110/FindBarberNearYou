import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { OwnBarberService } from "@findbarber/shared/types";
import {
  AUDIENCES,
  LIMITS,
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
import { label } from "../../lib/labels";
import { StickyActionBar } from "../../components/ui/StickyActionBar";
import {
  fieldErrorsFrom,
  focusFirstInvalid,
  type FieldErrorMap,
} from "../../lib/formErrors";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { ProPageHeader } from "../../components/barber/ProPageHeader";
import { buttonClasses } from "../../components/ui/buttonStyles";

const CHECKBOX_CLASS = "h-5 w-5 shrink-0 accent-accent";

// Lien stylé comme le bouton primaire du design system (aucun `ButtonLink`).
const PRIMARY_LINK_CLASS = buttonClasses("primary");

const SERVICE_FIELDS = [
  "name",
  "description",
  "durationMinutes",
  "priceMinor",
] as const;

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
  /** Renvoie les erreurs par champ du serveur (vide si aucune). */
  onSubmit: (values: ServiceFormValues) => Promise<FieldErrorMap>;
  onCancel?: () => void;
}) {
  const { t } = useTranslation("barber");
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [durationMinutes, setDurationMinutes] = useState(initial.durationMinutes);
  const [price, setPrice] = useState(initial.price);
  const [audiences, setAudiences] = useState<Audience[]>(initial.audiences);
  const [techniques, setTechniques] = useState<Technique[]>(initial.techniques);
  // Erreurs affichées sous chaque champ (issue #57).
  const [errors, setErrors] = useState<FieldErrorMap>({});

  function clearError(field: string) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next: FieldErrorMap = {};

    if (!name.trim()) next.name = t("services.form.nameRequired");

    const duration = Number(durationMinutes);
    if (
      !Number.isInteger(duration) ||
      duration < LIMITS.serviceDurationMin ||
      duration > LIMITS.serviceDurationMax
    ) {
      next.durationMinutes = t("services.form.durationInvalid", {
        min: LIMITS.serviceDurationMin,
        max: LIMITS.serviceDurationMax,
      });
    }

    const priceMinor = parsePriceToMinor(price);
    if (priceMinor === null) {
      next.priceMinor = t("services.form.priceInvalid");
    } else if (priceMinor > LIMITS.servicePriceMinorMax) {
      next.priceMinor = t("services.form.priceTooHigh");
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || priceMinor === null) {
      focusFirstInvalid(formRef.current);
      return;
    }

    const serverErrors = await onSubmit({
      name,
      description: description.trim() ? description.trim() : null,
      durationMinutes: duration,
      priceMinor,
      audiences,
      techniques,
    });
    if (Object.keys(serverErrors).length > 0) {
      setErrors(serverErrors);
      focusFirstInvalid(formRef.current);
    }
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-4 rounded-xl border border-border bg-surface-muted p-4"
    >
      <Field label={t("services.form.nameLabel")} error={errors.name}>
        {(control) => (
          <Input
            {...control}
            required
            maxLength={LIMITS.serviceName}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError("name");
            }}
          />
        )}
      </Field>
      <Field label={t("services.form.descriptionLabel")} error={errors.description}>
        {(control) => (
          <Input
            {...control}
            maxLength={LIMITS.serviceDescription}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              clearError("description");
            }}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("services.form.durationLabel")} error={errors.durationMinutes}>
          {(control) => (
            <Input
              {...control}
              required
              type="number"
              inputMode="numeric"
              min={LIMITS.serviceDurationMin}
              max={LIMITS.serviceDurationMax}
              value={durationMinutes}
              onChange={(e) => {
                setDurationMinutes(e.target.value);
                clearError("durationMinutes");
              }}
            />
          )}
        </Field>
        <Field label={t("services.form.priceLabel")} error={errors.priceMinor}>
          {(control) => (
            <Input
              {...control}
              required
              inputMode="decimal"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                clearError("priceMinor");
              }}
              placeholder="25.50"
            />
          )}
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">{t("services.form.audiences")}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {AUDIENCES.map((code) => (
            <label
              key={code}
              className="flex min-h-11 items-center gap-2.5 text-sm text-foreground"
            >
              <input
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={audiences.includes(code)}
                onChange={() => toggleAudience(code)}
              />
              {label("audience", code)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          {t("services.form.techniques")}
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {TECHNIQUES.map((code) => (
            <label
              key={code}
              className="flex min-h-11 items-center gap-2.5 text-sm text-foreground"
            >
              <input
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={techniques.includes(code)}
                onChange={() => toggleTechnique(code)}
              />
              {label("technique", code)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" isLoading={submitting} className="min-h-[44px]">
          {submitting ? t("services.form.saving") : submitLabel}
        </Button>
        {onCancel && (
          <Button
            variant="secondary"
            className="min-h-[44px]"
            onClick={onCancel}
          >
            {t("services.form.cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}

export function BarberServicesPage() {
  const { t } = useTranslation("barber");
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
        setError(err instanceof Error ? err.message : t("common.loadFailed"));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Une erreur rattachée à un champ s'affiche sous ce champ ; les autres
  // restent dans la barre d'actions, près du bouton (issue #57).
  function reportSaveError(err: unknown, fallback: string): FieldErrorMap {
    const fields = fieldErrorsFrom(err, SERVICE_FIELDS);
    if (Object.keys(fields).length === 0) {
      setError(err instanceof Error ? err.message : fallback);
    }
    return fields;
  }

  async function handleCreate(values: ServiceFormValues): Promise<FieldErrorMap> {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await barberApi.createService(values);
      setSuccess(t("services.added"));
      await loadData();
      return {};
    } catch (err) {
      return reportSaveError(err, t("services.addFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(
    id: string,
    values: ServiceFormValues,
  ): Promise<FieldErrorMap> {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await barberApi.updateService(id, values);
      setEditingId(null);
      setSuccess(t("services.updated"));
      await loadData();
      return {};
    } catch (err) {
      return reportSaveError(err, t("services.updateFailed"));
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
      setError(err instanceof Error ? err.message : t("services.actionFailed"));
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
              {t("services.loading")}
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
          <ProPageHeader title={t("services.title")} />
          <Card className="p-6 text-center">
            <p className="text-foreground">
              {t("services.profileMissing")}
            </p>
            <Link to="/pro/profile" className={`${PRIMARY_LINK_CLASS} mt-4`}>
              {t("common.createProfile")}
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
          title={t("services.title")}
          description={t("services.description")}
        />

        <Card className="p-6">
          <h2 className="text-lg font-bold text-foreground">
            {t("services.addTitle")}
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
              submitLabel={t("services.add")}
              submitting={submitting}
              onSubmit={handleCreate}
            />
          </div>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            {t("services.listTitle", { count: services.length })}
          </h2>
          {services.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-foreground-muted">
                {t("services.empty")}
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
                  submitLabel={t("services.save")}
                  submitting={submitting}
                  onSubmit={(values) => handleUpdate(service.id, values)}
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
                      {service.isActive ? t("services.active") : t("services.inactive")}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="min-h-[44px]"
                      onClick={() => setEditingId(service.id)}
                    >
                      {t("services.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-[44px]"
                      onClick={() => void handleToggle(service)}
                    >
                      {service.isActive
                        ? t("services.deactivate")
                        : t("services.reactivate")}
                    </Button>
                  </div>
                </Card>
              ),
            )
          )}
        </section>

        {/* Résultat affiché en bas de l'écran, là où l'utilisateur a agi
            (issue #56). */}
        <StickyActionBar error={error} success={success} />
      </div>
    </div>
  );
}
