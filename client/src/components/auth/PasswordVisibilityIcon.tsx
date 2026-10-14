// Icône œil / œil barré des champs mot de passe (connexion, inscription,
// réinitialisation). Décorative : le bouton porte l'aria-label.
export function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a3 3 0 0 0 4.24 4.24" />
        <path d="M9.9 5.1A10.9 10.9 0 0 1 12 4.9c6.5 0 10 7.1 10 7.1a17.6 17.6 0 0 1-3.2 4.2M6.1 6.1A17.2 17.2 0 0 0 2 12s3.5 7.1 10 7.1a10.5 10.5 0 0 0 4.1-.8" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
