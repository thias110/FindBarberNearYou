import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { COUNTRIES, type CountryCode } from "@findbarber/shared/countries";
import {
  CURRENCY_LABELS,
  DEFAULT_CURRENCY,
  LIMITS,
  SERVICE_PLACE_LABELS,
  SERVICE_PLACES,
  SUPPORTED_CURRENCIES,
  type Currency,
  type ServicePlace,
} from "@findbarber/shared/constants";
import {
  hasIanaTimeZoneList,
  listIanaTimeZones,
} from "@findbarber/shared/timezones";
import { ApiError, barberApi } from "../../lib/apiClient";

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

interface FormState {
  displayName: string;
  description: string;
  address: string;
  city: string;
  postalCode: string;
  countryCode: string;
  latitude: string;
  longitude: string;
  currency: Currency;
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
  currency: DEFAULT_CURRENCY,
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
          currency: profile.currency,
          timezone: profile.timezone ?? "",
          places: profile.places,
          travelRadiusKm:
            profile.travelRadiusKm === null
              ? ""
              : String(profile.travelRadiusKm),
        });
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
      await barberApi.updateProfile({
        displayName: form.displayName,
        description: form.description,
        address: form.address.trim() === "" ? null : form.address.trim(),
        city: form.city,
        postalCode: form.postalCode.trim() ? form.postalCode.trim() : null,
        countryCode: form.countryCode as CountryCode,
        latitude,
        longitude,
        currency: form.currency,
        // "" = « Non renseigné » : effacement explicite (null). Sinon le
        // fuseau choisi est envoyé tel quel, validé côté serveur.
        timezone: form.timezone.trim() === "" ? null : form.timezone,
        travelRadiusKm: isMobile ? travelRadiusKm : null,
        places: form.places,
      });
      setMode("edit");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement échoué.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 p-8 text-center text-gray-500">
        Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50 p-4 sm:p-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-white p-6 shadow"
      >
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">
            {mode === "create" ? "Créer mon profil" : "Modifier mon profil"}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            <Link to="/pro/dashboard" className="text-brand-700 underline">
              Retour au tableau de bord
            </Link>
          </p>
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Profil enregistré.
          </p>
        )}

        <label className="block">
          <span className="text-sm text-gray-700">Nom affiché</span>
          <input
            required
            maxLength={LIMITS.profileDisplayName}
            value={form.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-700">Description</span>
          <textarea
            required
            maxLength={LIMITS.profileDescription}
            rows={4}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>

        <fieldset className="space-y-2 rounded-lg border border-gray-200 p-3">
          <legend className="px-1 text-sm font-medium text-gray-700">
            Lieux de prestation (au moins un)
          </legend>
          {SERVICE_PLACES.map((place) => (
            <label key={place} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.places.includes(place)}
                onChange={() => togglePlace(place)}
              />
              {SERVICE_PLACE_LABELS[place]}
            </label>
          ))}
          <p className="text-xs text-gray-500">
            Vos horaires et indisponibilités s'appliquent à tous les lieux.
          </p>
        </fieldset>

        <label className="block">
          <span className="text-sm text-gray-700">
            Adresse privée (facultative)
          </span>
          <input
            maxLength={LIMITS.profileAddress}
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-gray-500">
            Requise pour un lieu en salon ou chez le professionnel. Jamais
            publiée : seul le propriétaire la voit.
          </span>
        </label>

        {form.places.includes("AT_CLIENT") && (
          <label className="block">
            <span className="text-sm text-gray-700">
              Rayon d'intervention chez le client (km)
            </span>
            <input
              type="number"
              min={LIMITS.travelRadiusKmMin}
              max={LIMITS.travelRadiusKmMax}
              value={form.travelRadiusKm}
              onChange={(e) => update("travelRadiusKm", e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-gray-700">Ville</span>
            <input
              required
              maxLength={LIMITS.profileCity}
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Code postal (facultatif)</span>
            <input
              maxLength={LIMITS.profilePostalCode}
              value={form.postalCode}
              onChange={(e) => update("postalCode", e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-gray-700">Pays</span>
          <select
            required
            value={form.countryCode}
            onChange={(e) => update("countryCode", e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
          >
            {COUNTRIES_SORTED.map((country) => (
              <option key={country.code} value={country.code}>
                {country.nameFr}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-gray-700">Latitude</span>
            <input
              required
              inputMode="decimal"
              value={form.latitude}
              onChange={(e) => update("latitude", e.target.value)}
              placeholder="46.2044"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Longitude</span>
            <input
              required
              inputMode="decimal"
              value={form.longitude}
              onChange={(e) => update("longitude", e.target.value)}
              placeholder="6.1432"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-gray-700">Devise</span>
          <select
            value={form.currency}
            disabled={mode === "edit"}
            onChange={(e) => update("currency", e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:bg-gray-100"
          >
            {SUPPORTED_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {CURRENCY_LABELS[currency]}
              </option>
            ))}
          </select>
          {mode === "edit" && (
            <span className="mt-1 block text-xs text-gray-500">
              La devise est fixée à la création du profil et ne peut plus être modifiée.
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm text-gray-700">Fuseau horaire du salon</span>
          {hasIanaTimeZoneList() ? (
            <select
              value={form.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              <option value="">— Non renseigné —</option>
              <optgroup label="Temps universel">
                <option value="UTC">UTC</option>
              </optgroup>
              {form.timezone !== "" && !KNOWN_TIMEZONES.has(form.timezone) && (
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
              maxLength={LIMITS.profileTimezone}
              value={form.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              placeholder="Europe/Zurich"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          )}
          <span className="mt-1 block text-xs text-gray-500">
            Choisi explicitement : jamais déduit du pays ni du navigateur. Il servira
            à calculer vos créneaux de réservation.
          </span>
          {mode === "edit" && form.timezone === "" && (
            <span className="mt-1 block text-xs text-amber-700">
              Fuseau non renseigné : la réservation en ligne restera indisponible
              tant qu'il n'est pas défini.
            </span>
          )}
        </label>

        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Votre nom, description, ville et lieux de prestation sont publics. Les
          coordonnées affichées publiquement sont approximatives (arrondies) ;
          votre adresse exacte reste privée.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-brand-700 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
