import { useTranslation } from "react-i18next";
import { Button } from "./ui/Button";

// Pagination simple et réutilisable des listes d'administration. La cohérence
// avec la pagination serveur est garantie par l'appelant (page/totalPages
// proviennent du DTO).
export function AdminPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation("admin");
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label={t("pagination.label")}
      className="flex items-center justify-center gap-3"
    >
      <Button
        variant="secondary"
        className="min-h-11"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t("pagination.previous")}
      </Button>
      <span className="text-sm text-foreground-muted">
        {t("pagination.pageOf", { page, total: totalPages })}
      </span>
      <Button
        variant="secondary"
        className="min-h-11"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t("pagination.next")}
      </Button>
    </nav>
  );
}
