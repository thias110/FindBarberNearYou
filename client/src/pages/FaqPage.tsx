import { useTranslation } from "react-i18next";
import { Accordion, type AccordionItem } from "../components/ui/Accordion";
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
    <div className="fb-canvas-glow min-h-screen bg-background p-4 sm:p-8">
      <PageContainer width="reading" stack="lg">
        <div className="relative overflow-hidden rounded-3xl border border-night-border bg-night p-7 text-white shadow-card sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_90%_at_85%_0%,rgb(var(--fb-cobalt)/0.34),transparent_70%),radial-gradient(50%_80%_at_10%_100%,rgb(var(--fb-brass)/0.2),transparent_70%)]"
          />
          <header className="relative">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-[60ch] leading-relaxed text-night-muted">
              {t("intro")}
            </p>
          </header>
        </div>
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
