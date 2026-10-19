import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";
import { PageContainer } from "../components/ui/PageContainer";
import { buttonClasses } from "../components/ui/buttonStyles";

// Page introuvable (lot N7, plan E25). La coque sert toujours le code HTTP 200
// (SPA) : on demande donc aux moteurs de ne pas indexer l'adresse, le temps
// que la page est affichée.
export function NotFoundPage() {
  const { t } = useTranslation("common");

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <PageContainer width="form">
        <EmptyState
          headingLevel={2}
          title={t("notFound.title")}
          description={t("notFound.description")}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/barbers" className={buttonClasses("primary")}>
                {t("notFound.search")}
              </Link>
              <Link to="/" className={buttonClasses("secondary")}>
                {t("notFound.home")}
              </Link>
            </div>
          }
        />
      </PageContainer>
    </div>
  );
}
