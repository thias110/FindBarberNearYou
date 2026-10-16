import { useTranslation } from "react-i18next";
import { Badge } from "../ui/Badge";

// Badge « Certifié » (issue #41) : attribué uniquement par un ADMIN. Affiché sur
// le profil public, dans la recherche et dans l'administration. En laiton, la
// couleur réservée à la confiance (design system « Dégradé », §2.6.5).
export function CertifiedBadge({ className }: { className?: string }) {
  const { t } = useTranslation("barber");
  return (
    <Badge
      variant="brass"
      className={className}
      title={t("certified.title")}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-3.5 w-3.5"
      >
        <path
          fillRule="evenodd"
          d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
          clipRule="evenodd"
        />
      </svg>
      {t("certified.label")}
    </Badge>
  );
}
