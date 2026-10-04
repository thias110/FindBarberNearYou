import { Link } from "react-router-dom";
import { TECHNIQUE_LABELS, type Technique } from "@findbarber/shared/constants";

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
        className="text-xl font-semibold text-foreground"
      >
        Prestations populaires
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <li key={chip.technique}>
            <Link
              to={`/barbers?technique=${chip.technique}`}
              className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
