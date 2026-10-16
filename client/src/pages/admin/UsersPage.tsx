import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import type { AdminUser, Role } from "@findbarber/shared/types";
import i18n from "../../i18n";
import { adminApi } from "../../lib/apiClient";
import { label } from "../../lib/labels";
import { useAuth } from "../../app/auth-context";
import { AdminLayout } from "../../components/AdminLayout";
import { AdminPagination } from "../../components/AdminPagination";
import { AdminListState } from "../../components/admin/AdminListState";
import { CertifiedBadge } from "../../components/barber/CertifiedBadge";
import { FilterChips } from "../../components/admin/FilterChips";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { adminUserDisplayName } from "../../lib/admin";
import { formatDateTime } from "../../lib/formatters";
import { buttonClasses } from "../../components/ui/buttonStyles";

// « PENDING » : profils barber en attente d'approbation (issue #40),
// accessible directement par /admin/users?filtre=a-approuver.
type RoleFilter = "ALL" | Role | "PENDING";

// Libellés : clés `admin:users.filters.<valeur>`.
const ROLE_FILTERS: RoleFilter[] = ["ALL", "CLIENT", "BARBER", "ADMIN", "PENDING"];

export const PENDING_FILTER_PARAM = "a-approuver";

const PAGE_SIZE = 20;

const SECONDARY_LINK_CLASS = buttonClasses("secondary");

type ActionKind = "suspend" | "reactivate" | "certify" | "uncertify" | "approve";

type PendingAction = { kind: ActionKind; user: AdminUser };

// Effets de chaque action confirmée. Le badge « Certifié » (issue #41) cible
// le profil barber, les autres actions le compte. Les textes (titre, bouton,
// description, succès, échec) sont sous `admin:users.actions.<action>`.
const ACTIONS: Record<
  ActionKind,
  {
    tone: "danger" | "primary";
    run: (user: AdminUser) => Promise<unknown>;
  }
> = {
  suspend: {
    tone: "danger",
    run: (user) => adminApi.suspendUser(user.id),
  },
  reactivate: {
    tone: "primary",
    run: (user) => adminApi.reactivateUser(user.id),
  },
  certify: {
    tone: "primary",
    run: (user) => adminApi.certifyBarber(user.barberProfileId!),
  },
  // Approbation d'un nouveau profil barber (issue #40).
  approve: {
    tone: "primary",
    run: (user) => adminApi.approveBarber(user.barberProfileId!),
  },
  uncertify: {
    tone: "danger",
    run: (user) => adminApi.uncertifyBarber(user.barberProfileId!),
  },
};

export function AdminUsersPage() {
  const { t } = useTranslation("admin");
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState<RoleFilter>(() =>
    searchParams.get("filtre") === PENDING_FILTER_PARAM ? "PENDING" : "ALL",
  );
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .listUsers({
        page,
        pageSize: PAGE_SIZE,
        role: role === "ALL" || role === "PENDING" ? undefined : role,
        pendingApproval: role === "PENDING" ? "true" : undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setUsers(res.users);
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
  }, [role, page, reloadKey]);

  function handleRoleChange(next: RoleFilter) {
    setRole(next);
    setPage(1);
  }

  async function handleConfirm() {
    if (!pending) return;
    const { kind, user: target } = pending;
    setBusy(true);
    setMessage(null);
    const action = ACTIONS[kind];
    try {
      await action.run(target);
      setMessage({
        kind: "success",
        text: t(`users.actions.${kind}.success`, { email: target.email }),
      });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setMessage({
        kind: "error",
        text:
          err instanceof Error
            ? err.message
            : t(`users.actions.${kind}.failure`),
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">
          {t("users.title")}
        </h2>

        <FilterChips
          label={t("users.filterLabel")}
          options={ROLE_FILTERS.map((value) => ({
            value,
            label: t(`users.filters.${value}`),
          }))}
          value={role}
          onChange={handleRoleChange}
        />

        {message && (
          <Alert variant={message.kind === "success" ? "success" : "danger"}>
            {message.text}
          </Alert>
        )}

        <AdminListState
          loading={loading}
          error={error}
          onRetry={() => setReloadKey((key) => key + 1)}
          isEmpty={users.length === 0}
          emptyTitle={t("users.empty")}
          loadingLabel={t("users.loading")}
        >
          <ul className="space-y-3">
            {users.map((item) => {
              const isSelf = item.id === currentUser?.id;
              const suspended = item.status === "SUSPENDED";
              const deleted = item.status === "DELETED";
              return (
                <li key={item.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {adminUserDisplayName(item)}
                        </p>
                        <p className="break-all text-sm text-foreground-muted">
                          {item.email}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="neutral">
                            {label("role", item.role)}
                          </Badge>
                          <Badge
                            variant={
                              deleted
                                ? "neutral"
                                : suspended
                                  ? "danger"
                                  : "success"
                            }
                          >
                            {label("userStatus", item.status)}
                          </Badge>
                          {item.certifiedAt && (
                            <CertifiedBadge />
                          )}
                          {item.barberPendingApproval && !deleted && (
                            <Badge variant="warning">
                              {t("users.pendingApproval")}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-foreground-muted">
                          {t("users.registeredAt", {
                            date: formatDateTime(item.createdAt),
                          })}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {item.barberPendingApproval && !deleted && (
                          <Button
                            className="min-h-11"
                            onClick={() =>
                              setPending({ kind: "approve", user: item })
                            }
                          >
                            {t("users.approve")}
                          </Button>
                        )}
                        {item.role === "BARBER" &&
                          item.barberProfileId &&
                          !deleted && (
                            <Link
                              to={`/admin/barbers/${item.barberProfileId}/stats`}
                              className={SECONDARY_LINK_CLASS}
                            >
                              {t("users.viewStats")}
                            </Link>
                          )}
                        {item.role === "BARBER" &&
                          item.barberProfileId &&
                          !deleted && (
                            <Button
                              variant="secondary"
                              className="min-h-11"
                              onClick={() =>
                                setPending({
                                  kind: item.certifiedAt ? "uncertify" : "certify",
                                  user: item,
                                })
                              }
                            >
                              {item.certifiedAt
                                ? t("users.removeBadge")
                                : t("users.certify")}
                            </Button>
                          )}
                        {deleted ? null : suspended ? (
                          <Button
                            variant="secondary"
                            className="min-h-11"
                            onClick={() =>
                              setPending({ kind: "reactivate", user: item })
                            }
                          >
                            {t("users.reactivate")}
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            className="min-h-11"
                            disabled={isSelf}
                            title={
                              isSelf
                                ? t("users.cannotSuspendSelf")
                                : undefined
                            }
                            onClick={() =>
                              setPending({ kind: "suspend", user: item })
                            }
                          >
                            {t("users.suspend")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </AdminListState>

        <AdminPagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? t(`users.actions.${pending.kind}.title`) : ""}
        confirmLabel={
          pending ? t(`users.actions.${pending.kind}.confirmLabel`) : ""
        }
        tone={pending ? ACTIONS[pending.kind].tone : "primary"}
        isLoading={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setPending(null)}
      >
        {pending ? (
          <p>
            {t(`users.actions.${pending.kind}.description`, {
              email: pending.user.email,
            })}
          </p>
        ) : null}
      </ConfirmDialog>
    </AdminLayout>
  );
}
