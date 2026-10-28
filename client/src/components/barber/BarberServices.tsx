import { useTranslation } from "react-i18next";
import type {
  PublicBarberProfile,
  PublicBarberService,
} from "@findbarber/shared/types";
import { cn } from "../../lib/cn";
import { formatCurrency, formatDuration } from "../../lib/formatters";
import { label } from "../../lib/labels";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface BarberServicesProps {
  profile: PublicBarberProfile;
  services: PublicBarberService[];
  selectedServiceId?: string;
  onSelectService?: (serviceId: string) => void;
}

export function BarberServices({
  profile,
  services,
  selectedServiceId,
  onSelectService,
}: BarberServicesProps) {
  const { t } = useTranslation("barber");
  const canBook = profile.places.length > 0 && Boolean(onSelectService);

  return (
    <Card className="p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-h3 font-bold text-foreground">{t("public.services.title")}</h2>
        {services.length > 0 && (
          <span className="text-xs font-semibold tabular-nums text-foreground-muted">
            {services.length}
          </span>
        )}
      </div>

      {services.length === 0 ? (
        <p className="mt-2 text-foreground-muted">
          {t("public.services.empty")}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {services.map((service) => {
            const isSelected = selectedServiceId === service.id;
            return (
              <li
                key={service.id}
                className={cn(
                  "rounded-xl border p-4 transition-colors duration-fast",
                  isSelected
                    ? "border-accent bg-accent-soft/40"
                    : "border-border bg-surface hover:border-border-strong/60 hover:bg-surface-muted/40",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-foreground">
                      {service.name}
                    </p>
                    {service.description && (
                      <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
                        {service.description}
                      </p>
                    )}
                    {(service.audiences.length > 0 ||
                      service.techniques.length > 0) && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {service.audiences.map((code) => (
                          <Badge key={code} variant="accent" size="sm">
                            {label("audience", code)}
                          </Badge>
                        ))}
                        {service.techniques.map((code) => (
                          <Badge key={code} variant="neutral" size="sm">
                            {label("technique", code)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                    <div className="sm:text-right">
                      <p className="font-display text-lg font-extrabold tabular-nums text-foreground">
                        {formatCurrency(service.priceMinor, profile.currency)}
                      </p>
                      <p className="text-xs font-medium tabular-nums text-foreground-muted">
                        {formatDuration(service.durationMinutes)}
                      </p>
                    </div>
                    {canBook && (
                      <Button
                        type="button"
                        variant={isSelected ? "primary" : "secondary"}
                        size="sm"
                        aria-pressed={isSelected}
                        onClick={() => onSelectService?.(service.id)}
                      >
                        {isSelected ? t("public.services.selected") : t("public.services.choose")}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
