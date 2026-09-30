import { Link } from "react-router-dom";
import { COUNTRY_NAME_BY_CODE } from "@findbarber/shared/countries";
import { TECHNIQUE_LABELS } from "@findbarber/shared/constants";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { audienceChips } from "../lib/barberTags";

interface BarbersMapCardProps {
  barber: PublicBarberSearchItem;
  onClose: () => void;
}

// Encart du barber sélectionné. Contenu React (JSX auto-échappé) : nom, ville,
// tags utiles et lien profil. Aucun avis, prix ni disponibilité inventés.
export function BarbersMapCard({ barber, onClose }: BarbersMapCardProps) {
  const audiences = audienceChips(barber.audiences);
  const country = COUNTRY_NAME_BY_CODE[barber.countryCode] ?? barber.countryCode;

  return (
    <div
      data-testid="barbers-map-card"
      className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 rounded-2xl bg-white/95 p-4 pr-10 shadow-lg ring-1 ring-black/5 backdrop-blur"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la fiche du barbier"
        className="absolute right-2 top-2 rounded-md px-2 py-1 text-lg leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      >
        <span aria-hidden="true">×</span>
      </button>
      <h3 className="text-base font-semibold text-brand-900">
        {barber.displayName}
      </h3>
      <p className="mt-0.5 text-sm text-gray-600">
        {barber.city}, {country}
      </p>
      {(audiences.length > 0 || barber.techniques.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {audiences.map((label) => (
            <span
              key={label}
              className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800"
            >
              {label}
            </span>
          ))}
          {barber.techniques.map((code) => (
            <span
              key={code}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
            >
              {TECHNIQUE_LABELS[code]}
            </span>
          ))}
        </div>
      )}
      <Link
        to={`/barbers/${barber.id}`}
        className="mt-3 inline-block rounded-lg bg-brand-700 px-3 py-1.5 text-sm text-white hover:bg-brand-900"
      >
        Voir le profil
      </Link>
    </div>
  );
}
