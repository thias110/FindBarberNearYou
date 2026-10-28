import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Technique } from "@findbarber/shared/constants";
import { label } from "../../lib/labels";

const TECHNIQUE_IMAGES: Record<Technique, string> = {
  COUPE: "/images/editorial/craft-cut.webp",
  DEGRADE: "/images/editorial/craft-fade.webp",
  TAPER: "/images/editorial/craft-fade.webp",
  BARBE: "/images/editorial/craft-beard.webp",
  TRESSES: "/images/editorial/craft-braids.webp",
  LOCKS: "/images/editorial/craft-braids.webp",
  COLORATION: "/images/editorial/craft-color.webp",
};

function TechniqueIcon({ technique }: { technique: Technique }) {
  const paths: Record<Technique, ReactNode> = {
    COUPE: (
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="6" cy="14" r="2.5" />
        <path d="M8.1 7.4L16.5 15M8.1 12.6L16.5 5" />
      </>
    ),
    DEGRADE: (
      <>
        <circle cx="10" cy="10" r="6.5" />
        <path d="M10 3.5v13" />
      </>
    ),
    TAPER: (
      <>
        <path d="M4 15.5V7a2.5 2.5 0 0 1 2.5-2.5H16" />
        <path d="M8 15.5v-4.5a2 2 0 0 1 2-2h6" />
      </>
    ),
    BARBE: (
      <>
        <path d="M4.5 7.5c0 5 3.2 8.5 5.5 8.5s5.5-3.5 5.5-8.5" />
        <path d="M7.5 10.5c.8.8 1.6 1 2.5 1s1.7-.2 2.5-1" />
      </>
    ),
    TRESSES: (
      <>
        <path d="M7 3.5c0 3 6 3 6 6s-6 3-6 6" />
        <path d="M13 3.5c0 3-6 3-6 6s6 3 6 6" />
      </>
    ),
    LOCKS: (
      <>
        <path d="M7.5 3.5v13M12.5 3.5v13" />
        <path d="M6 7h3M11 9.5h3M6 12h3M11 14.5h3" />
      </>
    ),
    COLORATION: (
      <path d="M10 3.2S5.2 8.6 5.2 12a4.8 4.8 0 0 0 9.6 0c0-3.4-4.8-8.8-4.8-8.8Z" />
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0 text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[technique]}
    </svg>
  );
}

// Galerie tactile des spécialités (issue #47) : classement calculé par le
// serveur, présenté sous forme de tuiles photographiques éditoriales qui mènent
// directement au filtre `technique=<CODE>` de la recherche.
export function CategoryChips({ techniques }: { techniques: readonly Technique[] }) {
  const { t } = useTranslation("client");
  return (
    <section aria-labelledby="home-categories-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="home-categories-title"
            className="font-display text-h2 font-bold text-foreground"
          >
            {t("home.categories.title")}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted sm:text-base">
            {t("home.categories.subtitle")}
          </p>
        </div>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {techniques.map((technique, idx) => (
          <li
            key={technique}
            className={
              techniques.length === 5 && idx === 0
                ? "col-span-2 sm:col-span-1"
                : undefined
            }
          >
            <Link
              to={`/barbers?technique=${technique}`}
              className="focus-ring group/cat relative isolate flex aspect-[16/10] w-full flex-col justify-between overflow-hidden rounded-3xl bg-night p-4 text-white shadow-1 ring-1 ring-inset ring-white/12 transition-[transform,box-shadow] duration-base ease-out hover:shadow-3 hover:ring-white/30 motion-safe:hover:-translate-y-1 sm:aspect-[4/3]"
            >
              <img
                src={TECHNIQUE_IMAGES[technique]}
                alt=""
                width={720}
                height={540}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-[650ms] ease-out motion-safe:group-hover/cat:scale-105"
              />
              {/* Voile de nuit renforcé : contraste AA garanti quelle que soit la photo */}
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/60 to-night/25"
              />

              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-night/75 shadow-1 backdrop-blur-md">
                <TechniqueIcon technique={technique} />
              </span>

              <div className="flex items-end justify-between gap-2">
                <div>
                  <span className="block font-display text-lg font-extrabold leading-tight text-white">
                    {label("technique", technique)}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-night-muted transition-colors duration-fast group-hover/cat:text-white">
                    {t("home.categories.explore")}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm transition-[transform,background-color,color] duration-fast ease-out group-hover/cat:border-white group-hover/cat:bg-white group-hover/cat:text-night motion-safe:group-hover/cat:translate-x-0.5"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3.5 8h8.5M8.5 4.5L12 8l-3.5 3.5" />
                  </svg>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
