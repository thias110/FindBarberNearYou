import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { AUDIT_ACTIONS, type AuditAction } from "@findbarber/shared/constants";
import type { AdminAuditLog } from "@findbarber/shared/types";
import i18n from "../../i18n";
import { adminApi } from "../../lib/apiClient";
import { AdminLayout } from "../../components/AdminLayout";
import { AdminPagination } from "../../components/AdminPagination";
import { AdminListState } from "../../components/admin/AdminListState";
import { Badge, type BadgeVariant } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Select } from "../../components/ui/Select";
import { formatDateTime } from "../../lib/formatters";
import { label } from "../../lib/labels";

type ActionFilter = "ALL" | AuditAction;

const PAGE_SIZE = 50;

function actionVariant(action: AuditAction): BadgeVariant {
  switch (action) {
    case "USER_SUSPENDED":
    case "REVIEW_HIDDEN":
    case "BOOKING_CANCELLED":
    case "BOOKING_DECLINED":
      return "danger";
    case "BOOKING_EXPIRED":
      return "warning";
    case "USER_DELETED":
    case "BARBER_UNCERTIFIED":
      return "neutral";
    case "USER_REACTIVATED":
    case "BARBER_CERTIFIED":
    case "BARBER_APPROVED":
    case "BOOKING_CONFIRMED":
    case "BOOKING_COMPLETED":
      return "success";
  }
}

function actorLabel(entry: AdminAuditLog, t: TFunction<"admin">): string {
  if (!entry.actorRole) return t("audit.system");
  const role = label("role", entry.actorRole);
  return entry.actorEmail
    ? t("audit.actorWithRole", { email: entry.actorEmail, role })
    : t("audit.deletedActor", { role });
}

// Journal d'audit (issue #13) : lecture seule. Un compte ciblé est affiché par
// son email ; les autres cibles par un identifiant tronqué.
export function AdminAuditLogPage() {
  const { t } = useTranslation("admin");
  const [action, setAction] = useState<ActionFilter>("ALL");
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<AdminAuditLog[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .listAuditLogs({
        page,
        pageSize: PAGE_SIZE,
        action: action === "ALL" ? undefined : action,
      })
      .then((res) => {
        if (cancelled) return;
        setEntries(res.entries);
        setTotalPages(res.pagination.totalPages);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : i18n.t("admin:common.loadError"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [action, page, reloadKey]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {t("audit.title")}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            {t("audit.description")}
          </p>
        </div>

        <Field label={t("audit.actionLabel")} className="max-w-xs">
          {(control) => (
            <Select
              {...control}
              value={action}
              onChange={(event) => {
                setAction(event.target.value as ActionFilter);
                setPage(1);
              }}
            >
              <option value="ALL">{t("audit.allActions")}</option>
              {AUDIT_ACTIONS.map((value) => (
                <option key={value} value={value}>
                  {label("auditAction", value)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <AdminListState
          loading={loading}
          error={error}
          onRetry={() => setReloadKey((key) => key + 1)}
          isEmpty={entries.length === 0}
          emptyTitle={t("audit.empty")}
          loadingLabel={t("audit.loading")}
        >
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <Badge variant={actionVariant(entry.action)}>
                        {label("auditAction", entry.action)}
                      </Badge>
                      <p className="break-all text-sm text-foreground">
                        {t("audit.by", { actor: actorLabel(entry, t) })}
                      </p>
                      <p className="break-all text-xs text-foreground-muted">
                        {t(`audit.targets.${entry.targetType}`)} ·{" "}
                        {entry.targetEmail ?? (
                          <span className="font-mono" title={entry.targetId}>
                            {entry.targetId.slice(0, 8)}
                          </span>
                        )}
                      </p>
                    </div>
                    <time
                      dateTime={entry.createdAt}
                      className="text-xs text-foreground-muted"
                    >
                      {formatDateTime(entry.createdAt)}
                    </time>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </AdminListState>

        <AdminPagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </AdminLayout>
  );
}
