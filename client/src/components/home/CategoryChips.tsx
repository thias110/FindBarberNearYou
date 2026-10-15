import { Link } from "react-router-dom";
import { TECHNIQUE_LABELS, type Technique } from "@findbarber/shared/constants";
import { chipClasses } from "../ui/chipStyles";

// Uniquement des techniques réellement existantes dans le projet. Les chips
// pointent vers le contrat d'URL de la recherche (`technique=<CODE>`).
const CHIPS: { technique: Technique; label: string }[] = [
  { technique: "COUPE", label: TECHNIQUE_LABELS.COUPE },
  { technique: "DEGRADE", label: TECHNIQUE_LABELS.DEGRADE },
  { technique: "BARBE", label: TECHNIQUE_LABELS.BARBE },
  { technique: "TRESSES", label: TECHNIQUE_LABELS.TRESSES },
  { technique: "COLORATION", label: TECHNIQUE_LABELS.COLORATION },
];

export function CategoryChips() {
  return (
    <section aria-labelledby="home-categories-title">
      <h2
        id="home-categories-title"
        className="text-xl font-bold text-foreground"
      >
        Prestations populaires
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <li key={chip.technique}>
            <Link
              to={`/barbers?technique=${chip.technique}`}
              className={chipClasses(false)}
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
