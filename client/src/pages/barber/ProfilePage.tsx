import { useEffect, useState, type FormEvent } from "react";
import {
  COUNTRIES,
  currencyForCountry,
  type CountryCode,
} from "@findbarber/shared/countries";
import {
  CURRENCY_LABELS,
  LIMITS,
  SERVICE_PLACE_LABELS,
  SERVICE_PLACES,
  type Currency,
  type ServicePlace,
} from "@findbarber/shared/constants";
import {
  hasIanaTimeZoneList,
  listIanaTimeZones,
} from "@findbarber/shared/timezones";
import { ApiError, barberApi } from "../../lib/apiClient";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { ProPageHeader } from "../../components/barber/ProPageHeader";
import { CONTROL_CLASS } from "../../components/ui/control";

const COUNTRIES_SORTED = [...COUNTRIES].sort((a, b) =>
  a.nameFr.localeCompare(b.nameFr, "fr"),
);

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

interface FormState {
  displayName: string;
  description: string;
  address: string;
  city: string;
  postalCode: string;
  countryCode: string;
  latitude: string;
  longitude: string;
  timezone: string;
  places: ServicePlace[];
  travelRadiusKm: string;
}

const EMPTY_FORM: FormState = {
  displayName: "",
  description: "",
  address: "",
  city: "",
  postalCode: "",
  countryCode: "CH",
  latitude: "",
  longitude: "",
  timezone: "",
  places: [],
  travelRadiusKm: "",
};

export function BarberProfilePage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Devise enregistrée (issue #39) : immuable, sert à prévenir le barber si le
  // pays choisi en utilise une autre (le serveur refuserait le changement).
  const [savedCurrency, setSavedCurrency] = useState<Currency | null>(null);

  useEffect(() => {
    let cancelled = false;
    barberApi
      .getProfile()
      .then((res) => {
        if (cancelled) return;
        const profile = res.profile;
        setForm({
          displayName: profile.displayName,
          description: profile.description,
          address: profile.address ?? "",
          city: profile.city,
          postalCode: profile.postalCode ?? "",
          countryCode: profile.countryCode,
          latitude: String(profile.latitude),
          longitude: String(profile.longitude),
          timezone: profile.timezone ?? "",
          places: profile.places,
          travelRadiusKm:
            profile.travelRadiusKm === null
              ? ""
              : String(profile.travelRadiusKm),
        });
        setSavedCurrency(profile.currency);
        setMode("edit");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "BARBER_PROFILE_NOT_FOUND") {
          setMode("create");
        } else {
          setError(err instanceof Error ? err.message : "Chargement impossible.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function togglePlace(place: ServicePlace) {
    setForm((current) => ({
      ...current,
      places: current.places.includes(place)
        ? current.places.filter((item) => item !== place)
        : [...current.places, place],
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (form.places.length === 0) {
      setError("Sélectionnez au moins un lieu de prestation.");
      return;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setError("La latitude doit être un nombre entre -90 et 90.");
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError("La longitude doit être un nombre entre -180 et 180.");
      return;
    }

    const requiresAddress =
      form.places.includes("SALON") || form.places.includes("AT_PROVIDER");
    if (requiresAddress && form.address.trim() === "") {
      setError(
        "Une adresse est requise pour un lieu en salon ou chez le professionnel.",
      );
      return;
    }

    const isMobile = form.places.includes("AT_CLIENT");
    const travelRadiusKm =
      form.travelRadiusKm.trim() === "" ? null : Number(form.travelRadiusKm);
    if (
      isMobile &&
      (travelRadiusKm === null ||
        !Number.isInteger(travelRadiusKm) ||
        travelRadiusKm < LIMITS.travelRadiusKmMin ||
        travelRadiusKm > LIMITS.travelRadiusKmMax)
    ) {
      setError(
        `Un rayon d'intervention entier entre ${LIMITS.travelRadiusKmMin} et ${LIMITS.travelRadiusKmMax} km est requis pour les prestations chez le client.`,
      );
      return;
    }

    setSaving(true);
    try {
      const saved = await barberApi.updateProfile({
        displayName: form.displayName,
        description: form.description,
        address: form.address.trim() === "" ? null : form.address.trim(),
        city: form.city,
        postalCode: form.postalCode.trim() ? form.postalCode.trim() : null,
        countryCode: form.countryCode as CountryCode,
        latitude,
        longitude,
        // "" = « Non renseigné » : effacement explicite (null). Sinon le
        // fuseau choisi est envoyé tel quel, validé côté serveur.
        timezone: form.timezone.trim() === "" ? null : form.timezone,
        travelRadiusKm: isMobile ? travelRadiusKm : null,
        places: form.places,
      });
      setSavedCurrency(saved.profile.currency);
      setMode("edit");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement échoué.");
    } finally {
      setSaving(false);
    }
  }

  const countryCurrency = currencyForCountry(form.countryCode as CountryCode);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-11 w-44" />
          </div>
          <Card className="space-y-4 p-6" aria-busy="true">
            <span className="sr-only" role="status">
              Chargement du profil…
            </span>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <ProPageHeader
          title={mode === "create" ? "Créer mon profil" : "Modifier mon profil"}
          description="Nom, adresse, coordonnées et pays."
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">Profil enregistré.</Alert>}

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-bold text-foreground">Identité</h2>
            <Field label="Nom affiché">
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
            <Field label="Description">
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
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-bold text-foreground">
              Lieux de prestation
            </h2>
            <fieldset className="space-y-2 rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-medium text-foreground">
                Lieux de prestation (au moins un)
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
                  {SERVICE_PLACE_LABELS[place]}
                </label>
              ))}
              <p className="text-xs text-foreground-muted">
                Vos horaires et indisponibilités s'appliquent à tous les lieux.
              </p>
            </fieldset>

            <Field
              label="Adresse privée (facultative)"
              hint="Requise pour un lieu en salon ou chez le professionnel. Jamais publiée : seul le propriétaire la voit."
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
              <Field label="Rayon d'intervention chez le client (km)">
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
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-bold text-foreground">
              Localisation
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ville">
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
              <Field label="Code postal (facultatif)">
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
            <Field label="Pays">
              {(control) => (
                <select
                  {...control}
                  required
                  value={form.countryCode}
                  onChange={(e) => update("countryCode", e.target.value)}
                  className={CONTROL_CLASS}
                >
                  {COUNTRIES_SORTED.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.nameFr}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude">
                {(control) => (
                  <Input
                    {...control}
                    required
                    inputMode="decimal"
                    value={form.latitude}
                    placeholder="46.2044"
                    onChange={(e) => update("latitude", e.target.value)}
                  />
                )}
              </Field>
              <Field label="Longitude">
                {(control) => (
                  <Input
                    {...control}
                    required
                    inputMode="decimal"
                    value={form.longitude}
                    placeholder="6.1432"
                    onChange={(e) => update("longitude", e.target.value)}
                  />
                )}
              </Field>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-bold text-foreground">
              Devise et fuseau horaire
            </h2>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Devise</p>
              <p className="text-sm text-foreground">
                {CURRENCY_LABELS[countryCurrency]}
              </p>
              <p className="text-xs text-foreground-muted">
                Déduite automatiquement du pays : vos prix sont affichés dans
                cette devise, sans conversion.
              </p>
            </div>
            {savedCurrency !== null && countryCurrency !== savedCurrency && (
              <Alert variant="warning">
                Ce pays utilise une autre devise que votre profil (
                {savedCurrency}) : le changement de pays sera refusé.
              </Alert>
            )}

            <Field
              label="Fuseau horaire du salon"
              hint="Choisi explicitement : jamais déduit du pays ni du navigateur. Il servira à calculer vos créneaux de réservation."
            >
              {(control) =>
                hasIanaTimeZoneList() ? (
                  <select
                    {...control}
                    value={form.timezone}
                    onChange={(e) => update("timezone", e.target.value)}
                    className={CONTROL_CLASS}
                  >
                    <option value="">— Non renseigné —</option>
                    <optgroup label="Temps universel">
                      <option value="UTC">UTC</option>
                    </optgroup>
                    {form.timezone !== "" &&
                      !KNOWN_TIMEZONES.has(form.timezone) && (
                        <optgroup label="Valeur enregistrée">
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

            {mode === "edit" && form.timezone === "" && (
              <Alert variant="warning">
                Fuseau non renseigné : la réservation en ligne restera
                indisponible tant qu'il n'est pas défini.
              </Alert>
            )}
          </Card>

          <Alert variant="info">
            Votre nom, description, ville et lieux de prestation sont publics.
            Les coordonnées affichées publiquement sont approximatives
            (arrondies) ; votre adresse exacte reste privée.
          </Alert>

          <Button
            type="submit"
            isLoading={saving}
            className="min-h-[44px] w-full"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </div>
    </div>
  );
}
