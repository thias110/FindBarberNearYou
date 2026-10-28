import { useTranslation } from "react-i18next";
import { Accordion, type AccordionItem } from "../components/ui/Accordion";
import { Card } from "../components/ui/Card";
import { FadeMotif } from "../components/ui/FadeMotif";
import { PageContainer } from "../components/ui/PageContainer";

// Questions fréquentes (lot N7, plan E26). Chaque réponse ne décrit que ce que
// l'application fait réellement ; les textes sont dans l'espace `faq`.
const CLIENT_QUESTIONS = ["book", "pending", "cancel", "payment", "address"] as const;
const BARBER_QUESTIONS = ["visible", "certified", "payments", "requests", "hours"] as const;

export function FaqPage() {
  const { t } = useTranslation("faq");

  const clientItems: AccordionItem[] = CLIENT_QUESTIONS.map((id) => ({
    id,
    title: t(`clients.items.${id}.q`),
    content: <p className="max-w-[65ch] leading-relaxed">{t(`clients.items.${id}.a`)}</p>,
  }));
  const barberItems: AccordionItem[] = BARBER_QUESTIONS.map((id) => ({
    id,
    title: t(`barbers.items.${id}.q`),
    content: <p className="max-w-[65ch] leading-relaxed">{t(`barbers.items.${id}.a`)}</p>,
  }));

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <PageContainer width="reading" stack="lg">
        <Card className="overflow-hidden p-0">
          <FadeMotif className="h-2.5 w-full text-accent/20" />
          <header className="p-6 sm:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-2 max-w-[60ch] leading-relaxed text-foreground-muted">
              {t("intro")}
            </p>
          </header>
        </Card>
        <section aria-labelledby="faq-clients" className="space-y-3">
          <h2 id="faq-clients" className="text-xl font-bold text-foreground">
            {t("clients.title")}
          </h2>
          <Accordion items={clientItems} headingLevel={3} />
        </section>
        <section aria-labelledby="faq-barbers" className="space-y-3">
          <h2 id="faq-barbers" className="text-xl font-bold text-foreground">
            {t("barbers.title")}
          </h2>
          <Accordion items={barberItems} headingLevel={3} />
        </section>
      </PageContainer>
    </div>
  );
}
