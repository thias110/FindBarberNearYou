import { useNavigate } from "react-router-dom";
import { COUNTRY_NAME_BY_CODE } from "@findbarber/shared/countries";
import { TECHNIQUE_LABELS } from "@findbarber/shared/constants";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const MAX_TECHNIQUES = 3;

// Contenu strictement limité à la whitelist publique `PublicBarberSearchItem` :
// aucun prix, avis, distance, adresse exacte ni disponibilité.
export function BarberPreviewCard({
  barber,
}: {
  barber: PublicBarberSearchItem;
}) {
  const navigate = useNavigate();
  const country = COUNTRY_NAME_BY_CODE[barber.countryCode] ?? barber.countryCode;
  const techniques = barber.techniques.slice(0, MAX_TECHNIQUES);
  const servicesLabel =
    barber.activeServiceCount > 1
      ? `${barber.activeServiceCount} services actifs`
      : `${barber.activeServiceCount} service actif`;

  return (
    <Card className="flex h-full flex-col p-5">
      <h3 className="text-base font-semibold text-foreground">
        {barber.displayName}
      </h3>
      <p className="mt-1 text-sm text-foreground-muted">
        {barber.city}
        {country ? `, ${country}` : ""}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">{servicesLabel}</p>

      {techniques.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {techniques.map((technique) => (
            <li key={technique}>
              <Badge variant="neutral">{TECHNIQUE_LABELS[technique]}</Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-4">
        <Button
          className="min-h-[44px] w-full"
          onClick={() => navigate(`/barbers/${barber.id}`)}
        >
          Voir le profil
        </Button>
      </div>
    </Card>
  );
}
