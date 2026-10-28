import { useTranslation } from "react-i18next";
import { Logo } from "../Logo";

const BENEFITS = [
  "brand.benefits.book",
  "brand.benefits.compare",
  "brand.benefits.keep",
] as const;

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Panneau de marque desktop (deuxième colonne de la coque AuthLayout). Caché
// sur mobile : l'en-tête compact de AuthLayout porte alors le logo.
export function AuthBrandPanel() {
  const { t } = useTranslation("auth");
  return (
    <div className="relative flex h-full min-h-screen flex-col justify-between overflow-hidden bg-night text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_75%_at_85%_10%,rgb(var(--fb-cobalt)/0.34),transparent_70%),radial-gradient(55%_65%_at_10%_95%,rgb(var(--fb-brass)/0.18),transparent_70%)]"
      />

      <div className="relative p-10 pb-0">
        <Logo tone="onNight" />
      </div>

      <div className="relative max-w-lg px-10 py-8">
        <p className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white xl:text-4xl">
          {t("brand.tagline")}
        </p>
        <p className="mt-4 text-base leading-relaxed text-night-muted">
          {t("brand.description")}
        </p>
        <ul className="mt-8 space-y-3.5">
          {BENEFITS.map((benefit) => (
            <li
              key={benefit}
              className="flex items-start gap-3 text-sm text-white"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-ring-on-night">
                <CheckIcon />
              </span>
              <span className="leading-relaxed">{t(benefit)}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative border-t border-white/10 px-10 py-6 text-xs text-night-muted">
        {t("brand.footer")}
      </p>
    </div>
  );
}
