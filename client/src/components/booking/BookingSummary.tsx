import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Currency, ServicePlace } from "@findbarber/shared/constants";
import { cn } from "../../lib/cn";
import { formatCurrency, formatDuration } from "../../lib/formatters";
import { label } from "../../lib/labels";
import { formatMinutes } from "../../lib/time";
import { formatDayLong } from "./format";

export interface BookingSummaryData {
  barberName: string;
  currency: Currency;
  serviceName?: string;
  durationMinutes?: number;
  priceMinor?: number;
  place?: ServicePlace | "";
  /** Jour civil du salon (`AAAA-MM-JJ`). */
  date?: string;
  startMinute?: number | null;
  /** Montant payé en ligne (0 = tout sur place), via `amountDueOnline`. */
  onlineAmount: number;
}

function Pending() {
  const { t } = useTranslation("client");
  return (
    <span className="text-foreground-muted">{t("booking.flow.summary.pending")}</span>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2.5 text-sm">
      <dt className="text-foreground-muted">{term}</dt>
      <dd className="min-w-0 font-semibold text-foreground">{children}</dd>
    </div>
  );
}

/** Détail du récapitulatif : lignes puis total. */
export function SummaryList({ data }: { data: BookingSummaryData }) {
  const { t } = useTranslation("client");
  const hasService = data.priceMinor !== undefined;
  const hasSlot = Boolean(data.date) && data.startMinute != null;

  let payment: ReactNode = <Pending />;
  if (hasService) {
    payment =
      data.onlineAmount === 0
        ? t("booking.flow.summary.paymentOnSite")
        : data.onlineAmount === data.priceMinor
          ? t("booking.flow.summary.paymentFull")
          : t("booking.flow.summary.paymentDeposit", {
              amount: formatCurrency(data.onlineAmount, data.currency),
            });
  }

  return (
    <div>
      <dl className="divide-y divide-border/70">
        <Row term={t("booking.flow.summary.barber")}>{data.barberName}</Row>
        <Row term={t("booking.flow.summary.service")}>
          {data.serviceName ? (
            <>
              {data.serviceName}
              {data.durationMinutes !== undefined && (
                <span className="block text-xs font-normal text-foreground-muted">
                  {formatDuration(data.durationMinutes)}
                </span>
              )}
            </>
          ) : (
            <Pending />
          )}
        </Row>
        <Row term={t("booking.flow.summary.when")}>
          {hasSlot ? (
            <>
              <span className="first-letter:uppercase">{formatDayLong(data.date as string)}</span>
              <span className="block tabular-nums">
                {formatMinutes(data.startMinute as number)}
                <span className="ml-1.5 text-xs font-normal text-foreground-muted">
                  {t("booking.flow.summary.salonTime")}
                </span>
              </span>
            </>
          ) : (
            <Pending />
          )}
        </Row>
        <Row term={t("booking.flow.summary.place")}>
          {data.place ? label("servicePlace", data.place) : <Pending />}
        </Row>
        <Row term={t("booking.flow.summary.payment")}>{payment}</Row>
      </dl>
      <div className="mt-3 flex items-baseline justify-between gap-3 rounded-xl bg-surface-muted px-3.5 py-3">
        <span className="text-sm font-bold text-foreground">
          {t("booking.flow.summary.total")}
        </span>
        <span className="font-display text-xl font-extrabold tabular-nums text-foreground">
          {hasService ? formatCurrency(data.priceMinor as number, data.currency) : "–"}
        </span>
      </div>
    </div>
  );
}

/** Desktop : colonne collante de 320 px (le conteneur impose la largeur). */
export function BookingSummaryAside({
  data,
  className,
}: {
  data: BookingSummaryData;
  className?: string;
}) {
  const { t } = useTranslation("client");
  return (
    <aside
      aria-label={t("booking.flow.summary.title")}
      className={cn(
        "hidden rounded-2xl border border-border bg-surface p-5 shadow-card-sm lg:sticky lg:top-24 lg:block",
        className,
      )}
    >
      <h3 className="mb-1 text-h4 font-bold text-foreground">
        {t("booking.flow.summary.title")}
      </h3>
      <SummaryList data={data} />
    </aside>
  );
}

/**
 * Mobile : barre collée en bas, repliée sur le total, qui se déplie pour le
 * détail. `bottomClassName` place la barre au-dessus de la barre d'onglets des
 * espaces connectés.
 */
export function BookingSummaryBar({
  data,
  bottomClassName,
}: {
  data: BookingSummaryData;
  bottomClassName: string;
}) {
  const { t } = useTranslation("client");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const hasService = data.priceMinor !== undefined;

  return (
    <div
      className={cn(
        "sticky z-30 -mx-4 mt-4 rounded-t-2xl border border-b-0 border-border bg-surface shadow-2 lg:hidden",
        bottomClassName,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="focus-ring-inset flex min-h-14 w-full items-center justify-between gap-3 rounded-t-2xl px-4 text-left"
      >
        <span className="text-sm font-semibold text-foreground">
          {open
            ? t("booking.flow.summary.hide")
            : t("booking.flow.summary.show")}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-display text-h4 font-bold tabular-nums text-foreground">
            {hasService ? formatCurrency(data.priceMinor as number, data.currency) : "–"}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className={cn(
              "h-4 w-4 text-foreground-muted transition-transform duration-fast",
              open ? "rotate-180" : "",
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 10L8 5.5 12.5 10" />
          </svg>
        </span>
      </button>
      <div id={panelId} hidden={!open} className="max-h-[60vh] overflow-y-auto px-4 pb-4">
        <SummaryList data={data} />
      </div>
    </div>
  );
}
