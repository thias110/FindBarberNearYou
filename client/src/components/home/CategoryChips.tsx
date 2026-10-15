import { Link } from "react-router-dom";
import { TECHNIQUE_LABELS, type Technique } from "@findbarber/shared/constants";
import { chipClasses } from "../ui/chipStyles";

// Prestations populaires (issue #47) : classement calculé par le serveur
// (techniques les plus réservées), complété par une liste par défaut. Les chips
// pointent vers le contrat d'URL de la recherche (`technique=<CODE>`).
export function CategoryChips({ techniques }: { techniques: readonly Technique[] }) {
  return (
    <section aria-labelledby="home-categories-title">
      <h2
        id="home-categories-title"
        className="text-xl font-bold text-foreground"
      >
        Prestations populaires
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {techniques.map((technique) => (
          <li key={technique}>
            <Link
              to={`/barbers?technique=${technique}`}
              className={chipClasses(false)}
            >
              {TECHNIQUE_LABELS[technique]}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
