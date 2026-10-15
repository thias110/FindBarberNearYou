import { Badge } from "../ui/Badge";

// Badge « Certifié » (issue #41) : attribué uniquement par un ADMIN. Affiché sur
// le profil public, dans la recherche et dans l'administration.
export function CertifiedBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="accent"
      className={className}
      title="Professionnel vérifié par FindBarber"
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
      Certifié
    </Badge>
  );
}
