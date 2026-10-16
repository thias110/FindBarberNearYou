import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useSiteConfig } from "../lib/siteConfig";
import { Card } from "../components/ui/Card";
import { PageContainer } from "../components/ui/PageContainer";

// Mentions légales (issue #59). L'éditeur et le contact viennent de la
// configuration serveur (LEGAL_OPERATOR_*, SUPPORT_EMAIL) ; une information
// absente n'est pas affichée.
export function LegalNoticePage() {
  const { supportEmail, legal } = useSiteConfig();
  const { t } = useTranslation("common");
  const hasOperator = Boolean(legal.operatorName || legal.operatorAddress);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <PageContainer width="reading">
        <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
          {t("legal.title")}
        </h1>

        <Card className="space-y-6 p-6 text-sm leading-relaxed text-foreground">
          {hasOperator && (
            <section aria-labelledby="editeur">
              <h2 id="editeur" className="mb-2 text-base font-bold">
                {t("legal.publisherTitle")}
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
                {t("legal.contactTitle")}
              </h2>
              <p>
                {t("legal.contactText")}{" "}
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
              {t("legal.roleTitle")}
            </h2>
            <p>{t("legal.roleText")}</p>
          </section>

          <section aria-labelledby="donnees">
            <h2 id="donnees" className="mb-2 text-base font-bold">
              {t("legal.dataTitle")}
            </h2>
            <p>
              {t("legal.dataTextBefore")}
              <Link
                to="/settings#confidentialite"
                className="font-medium text-accent underline underline-offset-4"
              >
                {t("legal.dataLink")}
              </Link>
              {t("legal.dataTextAfter")}
            </p>
          </section>

          <section aria-labelledby="propriete">
            <h2 id="propriete" className="mb-2 text-base font-bold">
              {t("legal.ipTitle")}
            </h2>
            <p>{t("legal.ipText")}</p>
          </section>
        </Card>
      </PageContainer>
    </div>
  );
}
