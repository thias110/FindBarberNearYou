import { Link } from "react-router-dom";
import { useSiteConfig } from "../lib/siteConfig";
import { Card } from "../components/ui/Card";

// Mentions légales (issue #59). L'éditeur et le contact viennent de la
// configuration serveur (LEGAL_OPERATOR_*, SUPPORT_EMAIL) ; une information
// absente n'est pas affichée.
export function LegalNoticePage() {
  const { supportEmail, legal } = useSiteConfig();
  const hasOperator = Boolean(legal.operatorName || legal.operatorAddress);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
          Mentions légales
        </h1>

        <Card className="space-y-6 p-6 text-sm leading-relaxed text-foreground">
          {hasOperator && (
            <section aria-labelledby="editeur">
              <h2 id="editeur" className="mb-2 text-base font-bold">
                Éditeur du site
              </h2>
              {legal.operatorName && <p>{legal.operatorName}</p>}
              {legal.operatorAddress && (
                <p className="whitespace-pre-line">{legal.operatorAddress}</p>
              )}
            </section>
          )}

          {supportEmail && (
            <section aria-labelledby="contact">
              <h2 id="contact" className="mb-2 text-base font-bold">
                Contact
              </h2>
              <p>
                Pour toute question :{" "}
                <a
                  href={`mailto:${supportEmail}`}
                  className="font-medium text-accent underline underline-offset-4"
                >
                  {supportEmail}
                </a>
              </p>
            </section>
          )}

          <section aria-labelledby="role">
            <h2 id="role" className="mb-2 text-base font-bold">
              Rôle de la plateforme
            </h2>
            <p>
              FindBarber met en relation des clients et des barbers
              indépendants. Chaque barber fixe ses prestations, ses prix et ses
              disponibilités et reste seul responsable des services qu'il
              fournit.
            </p>
          </section>

          <section aria-labelledby="donnees">
            <h2 id="donnees" className="mb-2 text-base font-bold">
              Données personnelles
            </h2>
            <p>
              Vos données sont traitées conformément à la loi fédérale sur la
              protection des données (LPD). Depuis votre compte, vous pouvez
              exporter vos données (
              <Link
                to="/settings#confidentialite"
                className="font-medium text-accent underline underline-offset-4"
              >
                Paramètres &gt; Confidentialité
              </Link>
              ) ou supprimer votre compte.
            </p>
          </section>

          <section aria-labelledby="propriete">
            <h2 id="propriete" className="mb-2 text-base font-bold">
              Propriété intellectuelle
            </h2>
            <p>
              Les contenus du site (textes, logo, interface) sont protégés.
              Les photos publiées par les barbers restent leur propriété. Les
              fonds de carte sont fournis par © MapTiler et © les contributeurs
              OpenStreetMap.
            </p>
          </section>
        </Card>
      </div>
    </div>
  );
}
