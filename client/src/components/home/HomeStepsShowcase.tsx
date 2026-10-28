import { useState } from "react";
import { useTranslation } from "react-i18next";
import { label } from "../../lib/labels";
import { cn } from "../../lib/cn";

const STEPS = ["search", "compare", "book"] as const;
type StepKey = (typeof STEPS)[number];

const PREVIEW_SLOTS = ["09:00", "10:30", "14:30", "16:00", "17:15", "18:30"] as const;

// Section « Comment ça marche » interactive : liste ordonnée cliquable à gauche
// et scène produit codée à droite illustrant la carte, les créneaux réels sur
// 7 jours et la confirmation express (.ics + adresse révélée après confirmation),
// sans blocage du défilement (zéro scroll-jacking) ni fausses données.
export function HomeStepsShowcase() {
  const { t } = useTranslation("client");
  const [activeStep, setActiveStep] = useState<StepKey>("search");

  return (
    <section aria-labelledby="home-steps-title">
      <div className="max-w-2xl">
        <h2
          id="home-steps-title"
          className="font-display text-h2 font-bold text-foreground"
        >
          {t("home.steps.title")}
        </h2>
        <p className="mt-1 text-sm text-foreground-muted sm:text-base">
          {t("home.steps.subtitle")}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* Séquence ordonnée interactive (3 arrêts clavier propres, sans piège de défilement) */}
        <ol className="flex flex-col justify-between gap-3 lg:col-span-5">
          {STEPS.map((step, index) => {
            const isActive = activeStep === step;
            return (
              <li key={step} className="flex-1">
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveStep(step)}
                  onMouseEnter={() => setActiveStep(step)}
                  className={cn(
                    "focus-ring group/step flex h-full w-full items-start gap-4 rounded-3xl border p-5 text-left transition-[border-color,background-color,box-shadow,transform] duration-base ease-out sm:p-6",
                    isActive
                      ? "border-accent bg-surface shadow-2"
                      : "border-border bg-surface/75 shadow-1 hover:border-border-strong hover:bg-surface",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex h-12 min-w-12 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-extrabold tabular-nums transition-colors duration-base",
                      isActive
                        ? "bg-accent text-accent-foreground shadow-cta"
                        : "bg-surface-muted text-foreground-muted group-hover/step:bg-accent-soft group-hover/step:text-accent-strong",
                    )}
                  >
                    0{index + 1}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display text-h3 font-bold text-foreground">
                        {t(`home.steps.${step}.title`)}
                      </span>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        className={cn(
                          "h-4 w-4 shrink-0 transition-[transform,color] duration-fast ease-out",
                          isActive
                            ? "translate-x-0.5 text-accent-strong"
                            : "text-foreground-muted",
                        )}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5.5 3.5L10 8l-4.5 4.5" />
                      </svg>
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-foreground-muted">
                      {t(`home.steps.${step}.description`)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Scène visuelle illustrative de l'étape active (`aria-hidden` : démonstration produit) */}
        <div
          aria-hidden="true"
          className="relative isolate flex flex-col justify-between overflow-hidden rounded-4xl bg-night p-6 text-white shadow-3 ring-1 ring-inset ring-white/12 sm:p-8 lg:col-span-7"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_26rem_at_88%_12%,rgb(var(--fb-cobalt)/0.36),transparent_70%),radial-gradient(32rem_22rem_at_12%_92%,rgb(var(--fb-brass)/0.2),transparent_70%)]" />

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-ring-on-night">
                <span className="h-1.5 w-1.5 rounded-full bg-ring-on-night" />
                {t(`home.steps.stage.${activeStep}.badge`)}
              </span>
              <span className="font-display text-2xl font-extrabold tabular-nums text-ring-on-night">
                0{STEPS.indexOf(activeStep) + 1}
              </span>
            </div>

            <p className="mt-3 font-display text-xl font-extrabold text-white sm:text-2xl">
              {t(`home.steps.stage.${activeStep}.headline`)}
            </p>
            <p className="mt-1.5 max-w-[54ch] text-sm leading-relaxed text-night-muted">
              {t(`home.steps.stage.${activeStep}.caption`)}
            </p>
          </div>

          <div className="mt-6">
            {activeStep === "search" && (
              <div className="grid gap-3.5 sm:grid-cols-12">
                {/* Carte stylisée avec épingles de prix et radar Autour de moi */}
                <div className="relative flex min-h-[12.5rem] flex-col justify-between overflow-hidden rounded-3xl border border-white/15 bg-night-2 p-4 sm:col-span-7">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_54%,rgb(var(--fb-cobalt)/0.26),transparent_62%)]" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-ring-on-night/35" />

                  <div className="relative flex flex-wrap gap-1.5">
                    {(["SALON", "AT_PROVIDER", "AT_CLIENT"] as const).map((code, i) => (
                      <span
                        key={code}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold",
                          i === 0
                            ? "bg-cobalt text-white shadow-cta"
                            : "border border-white/15 bg-night/80 text-white",
                        )}
                      >
                        {label("servicePlace", code)}
                      </span>
                    ))}
                  </div>

                  <div className="relative my-3 flex items-center justify-around gap-2">
                    <span className="rounded-full border border-white/20 bg-night/90 px-3 py-1 font-display text-xs font-extrabold text-white shadow-2">
                      45 CHF
                    </span>
                    <span className="scale-110 rounded-full border border-ring-on-night/60 bg-cobalt px-3.5 py-1 font-display text-xs font-extrabold text-white shadow-cta">
                      48 CHF
                    </span>
                    <span className="rounded-full border border-white/20 bg-night/90 px-3 py-1 font-display text-xs font-extrabold text-white shadow-2">
                      60 CHF
                    </span>
                  </div>

                  <div className="relative flex items-center gap-2 text-xs font-semibold text-ring-on-night">
                    <span className="h-2 w-2 rounded-full bg-ring-on-night" />
                    {t("home.steps.stage.search.aroundPill")}
                  </div>
                </div>

                {/* Visuel service à domicile / salon */}
                <div className="relative min-h-[12.5rem] overflow-hidden rounded-3xl border border-white/15 sm:col-span-5">
                  <img
                    src="/images/editorial/craft-home.webp"
                    alt=""
                    width={800}
                    height={600}
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-night via-night/30 to-transparent" />
                  <p className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/15 bg-night/80 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md">
                    {t("home.hero.showcase.modeBadge")}
                  </p>
                </div>
              </div>
            )}

            {activeStep === "compare" && (
              <div className="rounded-3xl border border-white/15 bg-night-2/90 p-4 shadow-2 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-brass/45 bg-brass/15 px-3 py-1 text-xs font-bold text-white">
                      <span className="h-2 w-2 rounded-full bg-brass" />
                      {label("technique", "DEGRADE")} · 45 min
                    </span>
                    <span className="font-display text-base font-extrabold tabular-nums text-white">
                      48.00 CHF
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-ring-on-night">
                    {t("home.steps.stage.compare.selectedPill")}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {PREVIEW_SLOTS.map((slot, idx) => {
                    const selected = idx === 2;
                    return (
                      <span
                        key={slot}
                        className={cn(
                          "flex h-11 items-center justify-center gap-1 rounded-xl border text-xs font-bold tabular-nums",
                          selected
                            ? "border-ring-on-night/70 bg-cobalt text-white shadow-cta"
                            : "border-white/12 bg-white/[0.06] text-white",
                        )}
                      >
                        {selected && (
                          <svg
                            viewBox="0 0 16 16"
                            className="h-3.5 w-3.5 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 8.5l3 3 6.5-6.5" />
                          </svg>
                        )}
                        {slot}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {activeStep === "book" && (
              <div className="rounded-3xl border border-white/15 bg-night-2/90 p-5 shadow-2">
                <div className="flex items-center gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brass/45 bg-brass/20 text-brass">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-display text-base font-extrabold text-white sm:text-lg">
                      14:30 · {label("technique", "COUPE")} + {label("technique", "BARBE")}
                    </p>
                    <p className="text-xs text-night-muted">
                      {label("servicePlace", "SALON")} · CHF
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white">
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3.5 w-3.5 text-ring-on-night"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
                      <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" />
                    </svg>
                    {t("home.steps.stage.book.icsPill")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/15 px-3 py-1.5 text-xs font-semibold text-white">
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3.5 w-3.5 text-brass"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 1 0-9 0C3.5 9.8 8 14 8 14Z" />
                      <circle cx="8" cy="6.5" r="1.5" />
                    </svg>
                    {t("home.steps.stage.book.privacyPill")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
