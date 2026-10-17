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
import { FadeMotif } from "../ui/FadeMotif";
import { SegmentedControl } from "../ui/SegmentedControl";

export type HeroPlace = ServicePlace | "";

interface HomeHeroProps {
  user: PublicUser | null;
  /** Reçoit la ville (non trimée) et le lieu : la navigation est décidée par la page. */
  onSearch: (city: string, place: HeroPlace) => void;
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

// Hero de nuit de l'accueil (lot P-1, plan §2.4, §2.5 et §2.6.2) : l'endroit
// où le design system dépense son audace. Titre d'affichage, capsule de
// recherche (ville, lieu, CTA) et motif « dégradé » en bas, qui se met en
// paliers une fois par session (rien ne bouge si reduced-motion).
export function HomeHero({ user, onSearch, fullBleed = false }: HomeHeroProps) {
  const { t } = useTranslation(["client", "labels"]);
  const [city, setCity] = useState("");
  const [place, setPlace] = useState<HeroPlace>("");
  const playSignature = useSignatureOnce();
  const cityId = useId();
  const titleId = useId();

  const initialSource = user?.name?.trim() || user?.email || "";
  const initial = initialSource.charAt(0).toUpperCase();
  const avatarUrl = user?.avatarPath ? resolveUploadUrl(user.avatarPath) : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSearch(city, place);
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "relative isolate overflow-hidden bg-night text-white",
        fullBleed
          ? // Glisse sous la barre flottante (4,5 rem) : la nuit commence en haut.
            "-mt-[4.5rem] rounded-b-4xl px-4 pb-28 pt-[calc(4.5rem+2.5rem)] sm:px-8 sm:pb-36 lg:pt-[calc(4.5rem+5rem)]"
          : "rounded-4xl px-5 pb-28 pt-10 sm:px-10 sm:pb-32",
      )}
    >
      <div className="mx-auto max-w-[65rem]">
        <div
          className={cn(
            "flex items-center gap-3",
            playSignature && "motion-safe:animate-hero-in",
          )}
        >
          {/* Avatar ou initiale : mène à Mon compte, où l'on change sa photo
              (issues #55 et #60). */}
          {user && (
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
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white"
                >
                  {initial}
                </span>
              )}
            </Link>
          )}
          <p className="text-sm font-medium text-night-muted">
            {greetingFor(user, t)}
          </p>
        </div>

        <h1
          id={titleId}
          className={cn(
            "mt-5 max-w-[15ch] text-balance font-display text-display font-extrabold tracking-[-0.03em]",
            playSignature && "motion-safe:animate-hero-in",
          )}
        >
          {t("home.hero.title")}
        </h1>
        <p className="mt-4 max-w-[45ch] text-base text-night-muted sm:text-lg">
          {t("home.hero.subtitle")}
        </p>

        {/* Capsule de recherche (§2.6.2) : 64 px sur desktop, éléments
            empilés sur mobile, anneau sur toute la capsule au focus. */}
        <form
          role="search"
          aria-label={t("home.hero.searchLabel")}
          onSubmit={handleSubmit}
          className={cn(
            "mt-8 flex flex-col gap-2 rounded-3xl border border-border bg-surface p-2 text-foreground shadow-3",
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
            <input
              id={cityId}
              type="text"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder={t("home.hero.cityPlaceholder")}
              autoComplete="address-level2"
              className="min-w-0 flex-1 bg-transparent py-2 text-base text-foreground outline-none placeholder:text-foreground-muted"
            />
          </div>
          <SegmentedControl<HeroPlace>
            label={t("home.hero.placeLabel")}
            value={place}
            onChange={setPlace}
            options={[
              { value: "", label: t("home.hero.place.any") },
              ...SERVICE_PLACES.map((code) => ({
                value: code,
                label: t(`home.hero.place.${code}`),
              })),
            ]}
            className="w-full overflow-x-auto lg:w-auto"
          />
          <Button
            type="submit"
            size="lg"
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
      </div>

      {/* Motif « dégradé » : seule occurrence décorative de l'écran. */}
      <FadeMotif
        animate={playSignature}
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-20 w-full text-cobalt/30 sm:h-24"
      />
    </section>
  );
}
