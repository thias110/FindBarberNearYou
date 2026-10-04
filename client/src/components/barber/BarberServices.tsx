import {
  AUDIENCE_LABELS,
  TECHNIQUE_LABELS,
} from "@findbarber/shared/constants";
import type {
  PublicBarberProfile,
  PublicBarberService,
} from "@findbarber/shared/types";
import { formatCurrency, formatDuration } from "../../lib/formatters";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

interface BarberServicesProps {
  profile: PublicBarberProfile;
  services: PublicBarberService[];
}

// Lecture seule : aucun clic de pré-sélection ; le formulaire conserve son
// propre select de service.
export function BarberServices({ profile, services }: BarberServicesProps) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground">Services</h2>
      {services.length === 0 ? (
        <p className="mt-2 text-foreground-muted">
          Aucun service pour le moment.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {services.map((service) => (
            <li key={service.id} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {service.name}
                  </p>
                  {service.description && (
                    <p className="mt-1 text-sm text-foreground-muted">
                      {service.description}
                    </p>
                  )}
                  {(service.audiences.length > 0 ||
                    service.techniques.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {service.audiences.map((code) => (
                        // Accent doux : même gabarit que `Badge`, variante absente.
                        <span
                          key={code}
                          className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-foreground"
                        >
                          {AUDIENCE_LABELS[code]}
                        </span>
                      ))}
                      {service.techniques.map((code) => (
                        <Badge key={code} variant="neutral">
                          {TECHNIQUE_LABELS[code]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <p className="whitespace-nowrap text-right text-sm text-foreground">
                  <span className="font-semibold">
                    {formatCurrency(service.priceMinor, profile.currency)}
                  </span>
                  <br />
                  {formatDuration(service.durationMinutes)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
