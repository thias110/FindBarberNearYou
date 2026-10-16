import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  COUNTRIES,
  currencyForCountry,
  type CountryCode,
} from "@findbarber/shared/countries";
import {
  LIMITS,
  SERVICE_PLACES,
  type Currency,
  type ServicePlace,
} from "@findbarber/shared/constants";
import {
  hasIanaTimeZoneList,
  listIanaTimeZones,
} from "@findbarber/shared/timezones";
import { useAuth } from "../../app/auth-context";
import { intlLocale } from "../../i18n";
import { ApiError, barberApi } from "../../lib/apiClient";
import { cn } from "../../lib/cn";
import { fieldErrorsFrom } from "../../lib/formErrors";
import { label } from "../../lib/labels";
import { useScrollToHash } from "../../lib/useScrollToHash";
import {
  EMPTY_PROFILE_FORM,
  PROFILE_FIELDS,
  PROFILE_STEP_COUNT,
  PROFILE_STEPS,
  clearProfileDraft,
  firstStepWithError,
  fromProfile,
  loadProfileDraft,
  positionOf,
  profileStepTitle,
  saveProfileDraft,
  stepFromHash,
  toProfileRequest,
  validateProfileSteps,
  type ProfileErrors,
  type ProfileField,
  type ProfileFormState,
} from "../../lib/profileSteps";
import { AvatarEditor } from "../../components/account/AvatarEditor";
import { LocationPicker } from "../../components/barber/LocationPicker";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { StickyActionBar } from "../../components/ui/StickyActionBar";
import { ProPageHeader } from "../../components/barber/ProPageHeader";
import { CONTROL_CLASS } from "../../components/ui/control";
import { PageContainer } from "../../components/ui/PageContainer";

// Noms de pays dans la langue courante (Intl), le français de référence en
// français ou si Intl ne connaît pas le code.
function countriesSorted(language: string) {
  const locale = intlLocale();
  let names: Intl.DisplayNames | null = null;
  if (!language.startsWith("fr")) {
    try {
      names = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      names = null;
    }
  }
  return COUNTRIES.map((country) => ({
    code: country.code,
    name: names?.of(country.code) ?? country.nameFr,
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

// Fuseaux groupés par région (premier segment de l'identifiant IANA), triés
// par libellé. "UTC" est proposé à part (exclu de la liste canonique).
const TIMEZONE_GROUPS = (() => {
  const groups = new Map<string, string[]>();
  for (const zone of listIanaTimeZones()) {
    const slash = zone.indexOf("/");
    if (zone === "UTC" || slash === -1) continue;
    const region = zone.slice(0, slash);
    const items = groups.get(region) ?? [];
    items.push(zone);
    groups.set(region, items);
  }
  return [...groups.entries()]
    .map(([label, zones]) => ({
      label,
      zones: zones.sort((a, b) => a.localeCompare(b, "fr")),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
})();

const KNOWN_TIMEZONES = new Set(listIanaTimeZones());

const CHECKBOX_CLASS = "h-5 w-5 shrink-0 accent-accent";

const LAST_STEP = PROFILE_STEP_COUNT - 1;

/**
 * Indicateur d'avancement (issue #43). En création, seules les étapes déjà
 * atteintes sont cliquables ; en modification, toutes le sont.
 */
function StepIndicator({
  current,
  reachable,
  onSelect,
}: {
  current: number;
  reachable: number;
  onSelect: (step: number) => void;
}) {
  const { t } = useTranslation("barber");
  return (
    <nav aria-label={t("profile.stepsLabel")}>
      <p className="mb-2 text-sm text-foreground-muted">
        {t("profile.stepOf", { current: current + 1, total: PROFILE_STEP_COUNT })}
      </p>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PROFILE_STEPS.map((step, index) => {
          const isCurrent = index === current;
          const isDone = index < current;
          const enabled = index <= reachable && !isCurrent;
          return (
            <li key={step.key}>
              <button
                type="button"
                disabled={!enabled}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(index)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm",
                  "focus-ring",
                  isCurrent
                    ? "border-accent bg-accent-soft font-semibold text-accent-strong"
                    : "border-border text-foreground",
                  enabled ? "hover:border-accent/60" : "cursor-default",
                  !enabled && !isCurrent && "opacity-60",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                    isCurrent
                      ? "border-accent-strong"
                      : isDone
                        ? "border-success bg-success/15 text-success"
                        : "border-border",
                  )}
                >
                  {isDone ? "✓" : index + 1}
                </span>
                <span className="min-w-0">{profileStepTitle(index)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Formulaire de profil barber en étapes courtes (issue #43). Chaque étape est
// validée avec le schéma partagé et l'erreur est affichée à côté du champ.
// Création : les étapes validées sont gardées en brouillon local (rechargement
// sans perte), le profil est créé à la dernière étape (l'API n'accepte qu'un
// profil complet). Modification : chaque étape est enregistrée directement.
export function BarberProfilePage() {
  const { t, i18n } = useTranslation("barber");
  const { user } = useAuth();
  const countries = useMemo(
    () => countriesSorted(i18n.language),
    [i18n.language],
  );
  // Photo obligatoire pour créer un profil (issue #44), vérifiée aussi côté
  // serveur. Gérée par AvatarEditor, hors du brouillon du formulaire.
  const hasAvatar = Boolean(user?.avatarPath);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const userId = user?.id ?? null;
  const [form, setForm] = useState<ProfileFormState>(EMPTY_PROFILE_FORM);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [step, setStep] = useState(0);
  // Étape la plus avancée atteinte (création) : borne la navigation directe.
  const [reachable, setReachable] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<ProfileErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Devise enregistrée (issue #39) : immuable, sert à prévenir le barber si le
  // pays choisi en utilise une autre (le serveur refuserait le changement).
  const [savedCurrency, setSavedCurrency] = useState<Currency | null>(null);
  const { hash } = useLocation();
  const navigate = useNavigate();
  // Chaque étape a son ancre (/pro/profile#localisation, issue #56) : l'URL
  // suit l'étape affichée et un lien direct ouvre l'étape visée, avec le
  // focus sur sa carte (useScrollToHash).
  useScrollToHash(!loading);

  useEffect(() => {
    let cancelled = false;
    barberApi
      .getProfile()
      .then((res) => {
        if (cancelled) return;
        setForm(fromProfile(res.profile));
        setSavedCurrency(res.profile.currency);
        setMode("edit");
        setReachable(LAST_STEP);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "BARBER_PROFILE_NOT_FOUND") {
          setMode("create");
          const draft = userId ? loadProfileDraft(userId) : null;
          if (draft) {
            setForm(draft.form);
            setStep(draft.step);
            setReachable(draft.step);
          }
        } else {
          setError(err instanceof Error ? err.message : t("common.loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` : texte de repli seulement.
  }, [userId]);

  // Brouillon de création : conservé à chaque saisie, après le chargement
  // (sinon le formulaire vide écraserait le brouillon à restaurer).
  useEffect(() => {
    if (loading || mode !== "create" || !userId) return;
    saveProfileDraft(userId, { form, step: reachable });
  }, [form, reachable, loading, mode, userId]);

  // Ancre d'URL → étape, si elle est déjà atteignable (toutes en modification).
  useEffect(() => {
    if (loading) return;
    const target = stepFromHash(hash);
    if (target !== -1 && target <= reachable) setStep(target);
  }, [hash, loading, reachable]);

  function goTo(next: number) {
    setStep(next);
    setReachable((current) => Math.max(current, next));
    navigate({ hash: PROFILE_STEPS[next].anchor }, { replace: true });
  }

  function update<K extends ProfileField>(field: K, value: ProfileFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSuccess(null);
  }

  function togglePlace(place: ServicePlace) {
    update(
      "places",
      form.places.includes(place)
        ? form.places.filter((item) => item !== place)
        : [...form.places, place],
    );
    // Les règles croisées (adresse, rayon) dépendent des lieux choisis.
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.address;
      delete next.travelRadiusKm;
      return next;
    });
  }

  function showErrors(errors: ProfileErrors) {
    setFieldErrors(errors);
    const errorStep = firstStepWithError(errors);
    if (errorStep !== -1 && errorStep !== step) goTo(errorStep);
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    try {
      const saved = await barberApi.updateProfile(toProfileRequest(form));
      setSavedCurrency(saved.profile.currency);
      if (mode === "create" && userId) clearProfileDraft(userId);
      setMode("edit");
      setReachable(LAST_STEP);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.code === "AVATAR_REQUIRED") {
        setAvatarError(err.message);
        if (step !== 0) goTo(0);
        return false;
      }
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
        const errors: ProfileErrors = fieldErrorsFrom(err, PROFILE_FIELDS);
        if (Object.keys(errors).length > 0) {
          showErrors(errors);
          setError(t("profile.errors.fixFields"));
          return false;
        }
      }
      setError(err instanceof Error ? err.message : t("profile.errors.saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const isLast = step === LAST_STEP;
    // En modification (ou à la dernière étape), tout le profil est envoyé :
    // toutes les étapes sont donc validées, pas seulement l'étape courante.
    const errors = validateProfileSteps(
      form,
      mode === "edit" || isLast ? LAST_STEP : step,
    );
    const missingAvatar = mode === "create" && !hasAvatar;
    if (Object.keys(errors).length > 0 || missingAvatar) {
      setAvatarError(
        missingAvatar ? t("profile.errors.avatarRequired") : null,
      );
      showErrors(errors);
      if (missingAvatar && step !== 0) goTo(0);
      return;
    }
    setFieldErrors({});
    setAvatarError(null);

    if (mode === "create" && !isLast) {
      goTo(step + 1);
      return;
    }

    const wasCreate = mode === "create";
    if (!(await save())) return;
    if (isLast) {
      setSuccess(
        wasCreate ? t("profile.success.created") : t("profile.success.saved"),
      );
    } else {
      setSuccess(t("profile.success.stepSaved"));
      goTo(step + 1);
    }
  }

  const countryCurrency = currencyForCountry(form.countryCode as CountryCode);
  const isLast = step === LAST_STEP;
  const submitLabel = saving
    ? t("profile.actions.saving")
    : mode === "create"
      ? isLast
        ? t("profile.actions.create")
        : t("profile.actions.continue")
      : isLast
        ? t("profile.actions.save")
        : t("profile.actions.saveAndContinue");

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <PageContainer width="reading">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-11 w-44" />
          </div>
          <Card className="space-y-4 p-6" aria-busy="true">
            <span className="sr-only" role="status">
              {t("profile.loading")}
            </span>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </Card>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <PageContainer width="reading">
        <ProPageHeader
          title={
            mode === "create"
              ? t("profile.title.create")
              : t("profile.title.edit")
          }
          description={
            mode === "create"
              ? t("profile.description.create")
              : t("profile.description.edit")
          }
        />

        <StepIndicator
          current={step}
          reachable={reachable}
          onSelect={(index) => {
            setError(null);
            setSuccess(null);
            goTo(index);
          }}
        />

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <Card
            id={PROFILE_STEPS[step].anchor}
            className="scroll-mt-4 space-y-4 p-6"
          >
            <h2 className="text-lg font-bold text-foreground">
              {profileStepTitle(step)}
            </h2>

            {step === 0 && (
              <>
                {(mode === "create" || !hasAvatar) && (
                  <section
                    aria-labelledby="profile-photo-title"
                    className="space-y-3 rounded-lg border border-border p-3"
                  >
                    <h3
                      id="profile-photo-title"
                      className="text-sm font-semibold text-foreground"
                    >
                      {t("profile.identity.photoTitle")}
                    </h3>
                    <p className="text-sm text-foreground-muted">
                      {t("profile.identity.photoHint")}
                    </p>
                    <AvatarEditor />
                    {avatarError && !hasAvatar && (
                      <p role="alert" className="text-sm text-danger">
                        {avatarError}
                      </p>
                    )}
                  </section>
                )}
                <Field label={t("profile.identity.displayName")} error={fieldErrors.displayName}>
                  {(control) => (
                    <Input
                      {...control}
                      required
                      maxLength={LIMITS.profileDisplayName}
                      value={form.displayName}
                      onChange={(e) => update("displayName", e.target.value)}
                    />
                  )}
                </Field>
                <Field label={t("profile.identity.description")} error={fieldErrors.description}>
                  {(control) => (
                    <textarea
                      {...control}
                      required
                      rows={4}
                      maxLength={LIMITS.profileDescription}
                      value={form.description}
                      onChange={(e) => update("description", e.target.value)}
                      className={CONTROL_CLASS}
                    />
                  )}
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <fieldset
                  className="space-y-2 rounded-lg border border-border p-3"
                  aria-invalid={fieldErrors.places ? true : undefined}
                  aria-describedby={fieldErrors.places ? "places-error" : undefined}
                >
                  <legend className="px-1 text-sm font-medium text-foreground">
                    {t("profile.places.legend")}
                  </legend>
                  {SERVICE_PLACES.map((place) => (
                    <label
                      key={place}
                      className="flex min-h-11 items-center gap-2.5 text-sm text-foreground"
                    >
                      <input
                        type="checkbox"
                        className={CHECKBOX_CLASS}
                        checked={form.places.includes(place)}
                        onChange={() => togglePlace(place)}
                      />
                      {label("servicePlace", place)}
                    </label>
                  ))}
                  {fieldErrors.places ? (
                    <p id="places-error" className="text-sm text-danger">
                      {fieldErrors.places}
                    </p>
                  ) : (
                    <p className="text-xs text-foreground-muted">
                      {t("profile.places.hint")}
                    </p>
                  )}
                </fieldset>

                <Field
                  label={t("profile.places.address")}
                  hint={t("profile.places.addressHint")}
                  error={fieldErrors.address}
                >
                  {(control) => (
                    <Input
                      {...control}
                      maxLength={LIMITS.profileAddress}
                      value={form.address}
                      onChange={(e) => update("address", e.target.value)}
                    />
                  )}
                </Field>

                {form.places.includes("AT_CLIENT") && (
                  <Field
                    label={t("profile.places.travelRadius")}
                    error={fieldErrors.travelRadiusKm}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        type="number"
                        min={LIMITS.travelRadiusKmMin}
                        max={LIMITS.travelRadiusKmMax}
                        value={form.travelRadiusKm}
                        onChange={(e) => update("travelRadiusKm", e.target.value)}
                      />
                    )}
                  </Field>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("profile.location.city")} error={fieldErrors.city}>
                    {(control) => (
                      <Input
                        {...control}
                        required
                        maxLength={LIMITS.profileCity}
                        value={form.city}
                        onChange={(e) => update("city", e.target.value)}
                      />
                    )}
                  </Field>
                  <Field
                    label={t("profile.location.postalCode")}
                    error={fieldErrors.postalCode}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        maxLength={LIMITS.profilePostalCode}
                        value={form.postalCode}
                        onChange={(e) => update("postalCode", e.target.value)}
                      />
                    )}
                  </Field>
                </div>
                <Field label={t("profile.location.country")} error={fieldErrors.countryCode}>
                  {(control) => (
                    <select
                      {...control}
                      required
                      value={form.countryCode}
                      onChange={(e) => update("countryCode", e.target.value)}
                      className={CONTROL_CLASS}
                    >
                      {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{t("profile.location.currency")}</p>
                  <p className="text-sm text-foreground">
                    {label("currency", countryCurrency)}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {t("profile.location.currencyHint")}
                  </p>
                </div>
                {savedCurrency !== null && countryCurrency !== savedCurrency && (
                  <Alert variant="warning">
                    {t("profile.location.currencyMismatch", {
                      currency: savedCurrency,
                    })}
                  </Alert>
                )}
                <LocationPicker
                  position={positionOf(form)}
                  onChange={(next) => {
                    update("latitude", String(next.latitude));
                    update("longitude", String(next.longitude));
                  }}
                  countryCode={form.countryCode}
                  initialQuery={[form.address, form.postalCode, form.city]
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .join(", ")}
                  error={fieldErrors.latitude ?? fieldErrors.longitude}
                />
                <Alert variant="info">
                  {t("profile.location.privacy")}
                </Alert>
              </>
            )}

            {step === 3 && (
              <>
                <Field
                  label={t("profile.timezone.label")}
                  hint={t("profile.timezone.hint")}
                  error={fieldErrors.timezone}
                >
                  {(control) =>
                    hasIanaTimeZoneList() ? (
                      <select
                        {...control}
                        value={form.timezone}
                        onChange={(e) => update("timezone", e.target.value)}
                        className={CONTROL_CLASS}
                      >
                        <option value="">{t("profile.timezone.none")}</option>
                        <optgroup label={t("profile.timezone.universal")}>
                          <option value="UTC">UTC</option>
                        </optgroup>
                        {form.timezone !== "" &&
                          !KNOWN_TIMEZONES.has(form.timezone) && (
                            <optgroup label={t("profile.timezone.saved")}>
                              <option value={form.timezone}>{form.timezone}</option>
                            </optgroup>
                          )}
                        {TIMEZONE_GROUPS.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.zones.map((zone) => (
                              <option key={zone} value={zone}>
                                {zone}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    ) : (
                      <input
                        {...control}
                        maxLength={LIMITS.profileTimezone}
                        value={form.timezone}
                        placeholder="Europe/Zurich"
                        onChange={(e) => update("timezone", e.target.value)}
                        className={CONTROL_CLASS}
                      />
                    )
                  }
                </Field>

                {form.timezone === "" && (
                  <Alert variant="warning">
                    {t("profile.timezone.missing")}
                  </Alert>
                )}
              </>
            )}
          </Card>

          {/* Actions et résultat collés en bas de l'écran (issue #56). */}
          <StickyActionBar error={error} success={success}>
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                className="min-h-[44px]"
                disabled={step === 0 || saving}
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  goTo(step - 1);
                }}
              >
                {t("profile.actions.previous")}
              </Button>
              <Button
                type="submit"
                isLoading={saving}
                className="min-h-[44px] sm:min-w-56"
              >
                {submitLabel}
              </Button>
            </div>
          </StickyActionBar>
        </form>
      </PageContainer>
    </div>
  );
}
