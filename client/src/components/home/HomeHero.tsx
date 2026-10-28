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

// Hero de nuit de l'accueil : éclairage studio cobalt et laiton, titre
// d'affichage bicolore, capsule de recherche encadrée de verre (ville, lieu,
// CTA) et accès direct « Autour de moi ».
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
        "relative isolate overflow-hidden bg-night text-white shadow-[inset_0_-1px_0_rgb(255_255_255/0.08)]",
        fullBleed
          ? // Glisse sous la barre flottante (4,5 rem) : la nuit commence en haut.
            "-mt-[4.5rem] rounded-b-4xl px-4 pb-14 pt-[calc(4.5rem+2.5rem)] sm:px-8 sm:pb-20 lg:pt-[calc(4.5rem+4.5rem)]"
          : "rounded-4xl px-5 pb-12 pt-10 shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] sm:px-10 sm:pb-16",
      )}
    >
      {/* Halos d'atelier (cobalt et laiton) : profondeur sans image à charger. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(56rem_36rem_at_82%_10%,rgb(var(--fb-cobalt)/0.28),transparent_68%),radial-gradient(42rem_26rem_at_12%_86%,rgb(var(--fb-brass)/0.14),transparent_70%)]"
      />

      <div className="mx-auto max-w-[65rem]">
        <div
          className={cn(
            "flex items-center gap-3",
            playSignature && "motion-safe:animate-hero-in",
          )}
        >
          {user ? (
            <>
              {/* Avatar ou initiale : mène à Mon compte, où l'on change sa photo
                  (issues #55 et #60). */}
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
            <p className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm sm:text-[0.8125rem]">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full bg-ring-on-night ring-4 ring-ring-on-night/20 motion-safe:animate-pulse"
              />
              {t("home.hero.liveBadge")}
            </p>
          )}
        </div>

        <h1
          id={titleId}
          className={cn(
            "mt-6 max-w-[16ch] text-balance font-display text-display font-extrabold tracking-[-0.03em]",
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

        {/* Capsule de recherche (§2.6.2) : encadrée d'un halo de verre sur la
            nuit, empilée sur mobile, anneau sur toute la capsule au focus. */}
        <form
          role="search"
          aria-label={t("home.hero.searchLabel")}
          onSubmit={handleSubmit}
          className={cn(
            "mt-8 flex flex-col gap-2 rounded-3xl border border-border bg-surface p-2 text-foreground",
            "shadow-[0_24px_60px_-20px_rgb(0_0_0/0.65),0_0_0_6px_rgb(255_255_255/0.07)]",
            "transition-shadow duration-base focus-within:ring-2 focus-within:ring-ring-on-night focus-within:ring-offset-2 focus-within:ring-offset-night",
            "lg:flex-row lg:items-center lg:rounded-full lg:p-1.5 lg:pl-5",
          )}
        >
          <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3 lg:px-0">
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
            {/* Label lu par les lecteurs d'écran ; l'exemple reste en placeholder. */}
            <label htmlFor={cityId} className="sr-only">
              {t("home.hero.cityLabel")}
            </label>
            <CityCombobox
              id={cityId}
              value={city}
              onChange={setCity}
              placeholder={t("home.hero.cityPlaceholder")}
              wrapperClassName="min-w-0 flex-1"
              className="w-full bg-transparent py-2 text-base text-foreground outline-none placeholder:text-foreground-muted"
            />
          </div>
          <span
            aria-hidden="true"
            className="hidden h-7 w-px shrink-0 bg-border lg:block"
          />
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
            className="w-full lg:w-auto"
          />
          <Button
            type="submit"
            size="xl"
            className="group/cta w-full shadow-cta lg:w-auto"
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
        </form>

        {/* Accès direct « Autour de moi » et repères fonctionnels vérifiables. */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {onAroundMe && (
            <button
              type="button"
              onClick={() => onAroundMe(place)}
              className={buttonClasses(
                "outline-inverse",
                "sm",
                "bg-white/[0.06] backdrop-blur-sm",
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
    </section>
  );
}
