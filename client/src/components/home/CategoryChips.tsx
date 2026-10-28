import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Technique } from "@findbarber/shared/constants";
import { label } from "../../lib/labels";
import { chipClasses } from "../ui/chipStyles";

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
        <path d="M3.5 5h13" strokeWidth={2.2} />
        <path d="M3.5 8.5h13" strokeWidth={1.8} />
        <path d="M3.5 12h13" strokeWidth={1.4} />
        <path d="M3.5 15.5h13" strokeWidth={1} />
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
      className="h-4 w-4 shrink-0 text-accent-strong"
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

// Prestations populaires (issue #47) : classement calculé par le serveur
// (techniques les plus réservées), complété par une liste par défaut. Les chips
// pointent vers le contrat d'URL de la recherche (`technique=<CODE>`).
export function CategoryChips({ techniques }: { techniques: readonly Technique[] }) {
  const { t } = useTranslation("client");
  return (
    <section aria-labelledby="home-categories-title">
      <div>
        <h2
          id="home-categories-title"
          className="font-display text-h2 font-bold text-foreground"
        >
          {t("home.categories.title")}
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          {t("home.categories.subtitle")}
        </p>
      </div>
      <ul className="mt-5 flex flex-wrap gap-2.5">
        {techniques.map((technique) => (
          <li key={technique}>
            <Link
              to={`/barbers?technique=${technique}`}
              className={chipClasses(false, {
                className:
                  "group/chip gap-2 pl-3.5 pr-4 shadow-1 hover:border-accent motion-safe:hover:-translate-y-0.5",
              })}
            >
              <TechniqueIcon technique={technique} />
              <span>{label("technique", technique)}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5 shrink-0 text-foreground-muted transition-[transform,color] duration-fast ease-out group-hover/chip:text-accent-strong motion-safe:group-hover/chip:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 3.5L10.5 8 6 12.5" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
