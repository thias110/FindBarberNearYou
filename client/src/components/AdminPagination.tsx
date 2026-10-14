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
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-3"
    >
      <Button
        variant="secondary"
        className="min-h-11"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Précédent
      </Button>
      <span className="text-sm text-foreground-muted">
        Page {page} / {totalPages}
      </span>
      <Button
        variant="secondary"
        className="min-h-11"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Suivant
      </Button>
    </nav>
  );
}
