import { useId, useState, type FormEvent } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { SERVICE_PLACES, type ServicePlace } from "@findbarber/shared/constants";
import type { PublicUser } from "@findbarber/shared/types";
import { resolveUploadUrl } from "../../lib/apiClient";
import { cn } from "../../lib/cn";
import { useSignatureOnce } from "../../lib/useSignatureOnce";
import { Button } from "../ui/Button";
import { buttonClasses } from "../ui/buttonStyles";
import { SegmentedControl } from "../ui/SegmentedControl";
import { CityCombobox } from "../search/CityCombobox";

export type HeroPlace = ServicePlace | "";

interface HomeHeroProps {
  user: PublicUser | null;
  /** Reçoit la ville (non trimée) et le lieu : la navigation est décidée par la page. */
  onSearch: (city: string, place: HeroPlace) => void;
  /** Recherche directe autour de la position du visiteur, en gardant le lieu choisi. */
  onAroundMe?: (place: HeroPlace) => void;
  /**
   * Hero pleine largeur glissé sous la barre flottante (visiteur). Sinon,
   * panneau arrondi dans la page (espace client, sous la barre opaque).
   */
  fullBleed?: boolean;
}

function greetingFor(user: PublicUser | null, t: TFunction<"client">): string {
  const firstName = user?.name?.trim().split(/\s+/)[0];
  return firstName
    ? t("home.hero.greeting", { name: firstName })
    : t("home.hero.welcome");
}

const SHOWCASE_SLOTS = ["09:30", "11:15", "14:30", "17:00"] as const;

// Hero éditorial asymétrique : colonne gauche dédiée à l'action immédiate
// (lieu, autocomplétion de ville, géolocalisation en un clic) et colonne droite
// « Atelier » combinant photographie de métier et aperçu de créneaux en direct.
export function HomeHero({
  user,
  onSearch,
  onAroundMe,
  fullBleed = false,
}: HomeHeroProps) {
  const { t } = useTranslation(["client", "labels"]);
  const [city, setCity] = useState("");
  const [place, setPlace] = useState<HeroPlace>("");
  const playSignature = useSignatureOnce();
  const cityId = useId();
  const titleId = useId();

  const initialSource = user?.name?.trim() || user?.email || "";
  const initial = initialSource.charAt(0).toUpperCase();
  const avatarUrl = user?.avatarPath ? resolveUploadUrl(user.avatarPath) : null;

  const titleText = t("home.hero.title");
  const commaIndex = titleText.indexOf(",");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSearch(city, place);
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "relative isolate overflow-hidden bg-night text-white shadow-[inset_0_-1px_0_rgb(255_255_255/0.09)]",
        fullBleed
          ? "-mt-[4.5rem] rounded-b-4xl px-4 pb-14 pt-[calc(4.5rem+2.25rem)] sm:px-8 sm:pb-20 lg:pt-[calc(4.5rem+3.75rem)]"
          : "rounded-4xl px-5 pb-12 pt-10 shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] sm:px-10 sm:pb-16",
      )}
    >
      {/* Éclairage d'atelier : projecteur cobalt haut-droit, contre-jour laiton et voile subtil. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(58rem_40rem_at_84%_14%,rgb(var(--fb-cobalt)/0.34),transparent_68%),radial-gradient(46rem_30rem_at_10%_88%,rgb(var(--fb-brass)/0.18),transparent_70%),radial-gradient(32rem_24rem_at_48%_0%,rgb(255_255_255/0.05),transparent_70%)]"
      />

      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="min-w-0 lg:col-span-7">
          <div
            className={cn(
              "flex items-center gap-3",
              playSignature && "motion-safe:animate-hero-in",
            )}
          >
            {user ? (
              <>
                <Link
                  to="/account"
                  aria-label={t("home.hero.account")}
                  title={t("home.hero.account")}
                  className="focus-ring-on-night shrink-0 rounded-full transition-opacity duration-fast hover:opacity-85"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover ring-2 ring-white/15"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-lg font-semibold text-white"
                    >
                      {initial}
                    </span>
                  )}
                </Link>
                <p className="text-sm font-medium text-night-muted">
                  {greetingFor(user, t)}
                </p>
              </>
            ) : (
              <p className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] backdrop-blur-md sm:text-[0.8125rem]">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full bg-ring-on-night ring-4 ring-ring-on-night/25 motion-safe:animate-pulse"
                />
                {t("home.hero.liveBadge")}
              </p>
            )}
          </div>

          <h1
            id={titleId}
            className={cn(
              "mt-5 max-w-[16ch] text-balance font-display text-display font-extrabold tracking-[-0.032em]",
              playSignature && "motion-safe:animate-hero-in",
            )}
          >
            {commaIndex !== -1 ? (
              <>
                {titleText.slice(0, commaIndex + 1)}{" "}
                <span className="text-ring-on-night">
                  {titleText.slice(commaIndex + 1).trimStart()}
                </span>
              </>
            ) : (
              titleText
            )}
          </h1>

          <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-night-muted sm:text-lg">
            {t("home.hero.subtitle")}
          </p>

          {/* Module de commande de recherche : sélecteur de lieu aéré + barre de ville et CTA. */}
          <form
            role="search"
            aria-label={t("home.hero.searchLabel")}
            onSubmit={handleSubmit}
            className={cn(
              "mt-7 flex flex-col gap-2.5 rounded-3xl border border-border bg-surface p-2.5 text-foreground sm:p-3",
              "shadow-[0_28px_68px_-20px_rgb(0_0_0/0.72),0_0_0_6px_rgb(255_255_255/0.08)]",
              "transition-shadow duration-base focus-within:ring-2 focus-within:ring-ring-on-night focus-within:ring-offset-2 focus-within:ring-offset-night",
            )}
          >
            <SegmentedControl<HeroPlace>
              label={t("home.hero.placeLabel")}
              value={place}
              onChange={setPlace}
              stackOnMobile
              options={[
                { value: "", label: t("home.hero.place.any") },
                ...SERVICE_PLACES.map((code) => ({
                  value: code,
                  label: t(`home.hero.place.${code}`),
                })),
              ]}
              className="w-full"
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border/80 bg-surface-muted/45 px-3.5 transition-colors duration-fast focus-within:border-accent focus-within:bg-surface">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 text-accent-strong"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
                  <circle cx="12" cy="10" r="2.3" />
                </svg>
                <label htmlFor={cityId} className="sr-only">
                  {t("home.hero.cityLabel")}
                </label>
                <CityCombobox
                  id={cityId}
                  value={city}
                  onChange={setCity}
                  placeholder={t("home.hero.cityPlaceholder")}
                  wrapperClassName="min-w-0 flex-1"
                  className="w-full bg-transparent py-2.5 text-base text-foreground outline-none placeholder:text-foreground-muted"
                />
              </div>

              <Button
                type="submit"
                size="xl"
                className="group/cta w-full shrink-0 shadow-cta sm:w-auto"
              >
                {t("home.hero.submit")}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="h-5 w-5 transition-transform duration-fast ease-out motion-safe:group-hover/cta:translate-x-[3px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 10h11M11 5.5L15.5 10 11 14.5" />
                </svg>
              </Button>
            </div>
          </form>

          {/* Accès direct « Autour de moi » et garanties fonctionnelles réelles. */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            {onAroundMe && (
              <button
                type="button"
                onClick={() => onAroundMe(place)}
                className={buttonClasses(
                  "outline-inverse",
                  "sm",
                  "bg-white/[0.07] shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] backdrop-blur-sm",
                )}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="10" cy="10" r="3" />
                  <circle cx="10" cy="10" r="6.5" />
                  <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2" />
                </svg>
                {t("home.hero.aroundMe")}
              </button>
            )}
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-night-muted sm:text-sm">
              <li className="flex items-center gap-1.5">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4 shrink-0 text-brass"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
                    clipRule="evenodd"
                  />
                </svg>
                {t("home.hero.highlights.certified")}
              </li>
              <li className="flex items-center gap-1.5">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0 text-ring-on-night"
                >
                  <circle cx="10" cy="10" r="7.5" />
                  <path d="M10 5.5V10l3 2" />
                </svg>
                {t("home.hero.highlights.realtime")}
              </li>
              <li className="flex items-center gap-1.5">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0 text-ring-on-night"
                >
                  <path d="M11 2.5L4.5 11H10l-1 6.5L15.5 9H10l1-6.5Z" />
                </svg>
                {t("home.hero.highlights.express")}
              </li>
            </ul>
          </div>
        </div>

        {/* Scène visuelle « Atelier » : portrait éditorial + dock de créneaux temps réel.
            Purement illustrative (`aria-hidden`) : aucun faux profil, aucun arrêt clavier. */}
        <div
          aria-hidden="true"
          className={cn(
            "relative mx-auto w-full max-w-md lg:col-span-5 lg:max-w-none",
            playSignature && "motion-safe:animate-hero-in",
          )}
        >
          <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[2.5rem] bg-[radial-gradient(60%_60%_at_50%_40%,rgb(var(--fb-cobalt)/0.38),transparent_72%)] blur-2xl" />

          <div className="group/stage relative overflow-hidden rounded-[2rem] border border-white/15 bg-night-2/90 p-2.5 shadow-[0_32px_72px_-24px_rgb(0_0_0/0.82),inset_0_1px_0_rgb(255_255_255/0.22)]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] sm:aspect-[5/4] lg:aspect-[4/5]">
              <img
                src="/images/editorial/hero-atelier.webp"
                alt=""
                width={960}
                height={1200}
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover object-[center_22%] transition-transform duration-[800ms] ease-out motion-safe:group-hover/stage:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-night via-night/35 to-night/25" />

              {/* Pastille supérieure : polyvalence Salon / Studio / Domicile */}
              <div className="absolute left-3.5 right-3.5 top-3.5 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-night/80 px-3 py-1.5 text-xs font-semibold text-white shadow-1 backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-brass" />
                  {t("home.hero.showcase.modeBadge")}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-night/80 px-2.5 py-1 text-[0.6875rem] font-bold text-white backdrop-blur-md">
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5 text-brass"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
                    <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" />
                  </svg>
                  {t("home.hero.showcase.confirmedChip")}
                </span>
              </div>

              {/* Dock inférieur en verre sombre : démonstration visuelle des créneaux directs */}
              <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-night/85 p-3.5 shadow-2 backdrop-blur-xl sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-sm font-bold text-white sm:text-base">
                      {t("home.hero.showcase.slotTitle")}
                    </p>
                    <p className="text-xs text-night-muted">
                      {t("home.hero.showcase.slotMeta")}
                    </p>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cobalt text-white shadow-cta">
                    <svg
                      viewBox="0 0 16 16"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3.5 8.5l2.8 2.8 6.2-6.2" />
                    </svg>
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {SHOWCASE_SLOTS.map((slot, idx) => {
                    const active = idx === 2;
                    return (
                      <span
                        key={slot}
                        className={cn(
                          "flex h-9 items-center justify-center rounded-xl border text-xs font-bold tabular-nums",
                          active
                            ? "border-ring-on-night/60 bg-cobalt text-white shadow-cta"
                            : "border-white/12 bg-white/[0.06] text-white",
                        )}
                      >
                        {slot}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
