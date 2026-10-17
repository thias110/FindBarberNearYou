import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { cn } from "../../lib/cn";
import { buttonClasses } from "../ui/buttonStyles";
import { BarberPhoto, RatingSummary } from "./BarberHighlights";

type CompactBarber = Pick<
  PublicBarberSearchItem,
  | "id"
  | "displayName"
  | "avatarPath"
  | "averageRating"
  | "reviewCount"
  | "startingPriceMinor"
  | "currency"
>;

// Carte « compacte » (gabarit du lot DS-3 : plan §2.6.4) : popup de carte,
// favoris, « déjà visité ». Photo de 56 px, nom, une ligne d'information (la
// note) et un lien vers le profil. Le nom est un lien étendu à toute la carte.
export function BarberCompactCard({
  barber,
  className,
}: {
  barber: CompactBarber;
  className?: string;
}) {
  const { t } = useTranslation("client");
  return (
    <article
      className={cn(
        "relative flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-1",
        "transition-[transform,box-shadow] duration-base ease-out hover:shadow-2 motion-safe:hover:-translate-y-0.5",
        "has-[.fb-card-link:focus-visible]:ring-2 has-[.fb-card-link:focus-visible]:ring-ring has-[.fb-card-link:focus-visible]:ring-offset-2 has-[.fb-card-link:focus-visible]:ring-offset-background",
        className,
      )}
    >
      <BarberPhoto barber={barber} className="h-14 w-14 rounded-lg text-lg" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-bold text-foreground">
          <Link
            to={`/barbers/${barber.id}`}
            className="fb-card-link outline-none after:absolute after:inset-0 after:content-['']"
          >
            {barber.displayName}
          </Link>
        </h3>
        <RatingSummary barber={barber} />
      </div>
      <span aria-hidden="true" className={buttonClasses("link", "md", "shrink-0 text-sm")}>
        {t("search.result.viewProfile")}
      </span>
    </article>
  );
}
