import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Technique } from "@findbarber/shared/constants";
import { label } from "../../lib/labels";
import { chipClasses } from "../ui/chipStyles";

// Prestations populaires (issue #47) : classement calculé par le serveur
// (techniques les plus réservées), complété par une liste par défaut. Les chips
// pointent vers le contrat d'URL de la recherche (`technique=<CODE>`).
export function CategoryChips({ techniques }: { techniques: readonly Technique[] }) {
  const { t } = useTranslation("client");
  return (
    <section aria-labelledby="home-categories-title">
      <h2
        id="home-categories-title"
        className="text-xl font-bold text-foreground"
      >
        {t("home.categories.title")}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {techniques.map((technique) => (
          <li key={technique}>
            <Link
              to={`/barbers?technique=${technique}`}
              className={chipClasses(false)}
            >
              {label("technique", technique)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
