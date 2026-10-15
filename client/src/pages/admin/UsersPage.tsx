import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@findbarber/shared/constants";
import type { AdminUser, Role } from "@findbarber/shared/types";
import { adminApi } from "../../lib/apiClient";
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

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "CLIENT", label: "Clients" },
  { value: "BARBER", label: "Barbiers" },
  { value: "ADMIN", label: "Administrateurs" },
  { value: "PENDING", label: "À approuver" },
];

export const PENDING_FILTER_PARAM = "a-approuver";

const PAGE_SIZE = 20;

const SECONDARY_LINK_CLASS = buttonClasses("secondary");

type ActionKind = "suspend" | "reactivate" | "certify" | "uncertify" | "approve";

type PendingAction = { kind: ActionKind; user: AdminUser };

// Libellés et effets de chaque action confirmée. Le badge « Certifié »
// (issue #41) cible le profil barber, les autres actions le compte.
const ACTIONS: Record<
  ActionKind,
  {
    title: string;
    confirmLabel: string;
    tone: "danger" | "primary";
    failure: string;
    success: (user: AdminUser) => string;
    description: (user: AdminUser) => string;
    run: (user: AdminUser) => Promise<unknown>;
  }
> = {
  suspend: {
    title: "Suspendre ce compte ?",
    confirmLabel: "Suspendre",
    tone: "danger",
    failure: "Suspension impossible.",
    success: (user) => `${user.email} a été suspendu.`,
    description: (user) =>
      `${user.email} ne pourra plus se connecter et ses réservations futures seront annulées.`,
    run: (user) => adminApi.suspendUser(user.id),
  },
  reactivate: {
    title: "Réactiver ce compte ?",
    confirmLabel: "Réactiver",
    tone: "primary",
    failure: "Réactivation impossible.",
    success: (user) => `${user.email} a été réactivé.`,
    description: (user) => `${user.email} pourra de nouveau se connecter.`,
    run: (user) => adminApi.reactivateUser(user.id),
  },
  certify: {
    title: "Attribuer le badge « Certifié » ?",
    confirmLabel: "Certifier",
    tone: "primary",
    failure: "Attribution du badge impossible.",
    success: (user) => `${user.email} est désormais certifié.`,
    description: (user) =>
      `Le badge « Certifié » de ${user.email} apparaîtra sur son profil public et dans la recherche.`,
    run: (user) => adminApi.certifyBarber(user.barberProfileId!),
  },
  // Approbation d'un nouveau profil barber (issue #40).
  approve: {
    title: "Approuver ce profil ?",
    confirmLabel: "Approuver",
    tone: "primary",
    failure: "Approbation impossible.",
    success: (user) => `${user.email} est approuvé : son profil est en ligne.`,
    description: (user) =>
      `Le profil de ${user.email} apparaîtra immédiatement dans la recherche et pourra recevoir des réservations.`,
    run: (user) => adminApi.approveBarber(user.barberProfileId!),
  },
  uncertify: {
    title: "Retirer le badge « Certifié » ?",
    confirmLabel: "Retirer le badge",
    tone: "danger",
    failure: "Retrait du badge impossible.",
    success: (user) => `Le badge de ${user.email} a été retiré.`,
    description: (user) =>
      `Le badge « Certifié » de ${user.email} disparaîtra de son profil public et de la recherche.`,
    run: (user) => adminApi.uncertifyBarber(user.barberProfileId!),
  },
};

export function AdminUsersPage() {
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
            err instanceof Error ? err.message : "Chargement impossible.",
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
      setMessage({ kind: "success", text: action.success(target) });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : action.failure,
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">Utilisateurs</h2>

        <FilterChips
          label="Filtrer par rôle"
          options={ROLE_FILTERS}
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
          emptyTitle="Aucun utilisateur pour ce filtre."
          loadingLabel="Chargement des utilisateurs…"
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
                            {ROLE_LABELS[item.role]}
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
                            {USER_STATUS_LABELS[item.status]}
                          </Badge>
                          {item.certifiedAt && (
                            <CertifiedBadge />
                          )}
                          {item.barberPendingApproval && !deleted && (
                            <Badge variant="warning">En attente d'approbation</Badge>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-foreground-muted">
                          Inscrit le {formatDateTime(item.createdAt)}
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
                            Approuver
                          </Button>
                        )}
                        {item.role === "BARBER" &&
                          item.barberProfileId &&
                          !deleted && (
                            <Link
                              to={`/admin/barbers/${item.barberProfileId}/stats`}
                              className={SECONDARY_LINK_CLASS}
                            >
                              Voir les statistiques
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
                              {item.certifiedAt ? "Retirer le badge" : "Certifier"}
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
                            Réactiver
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            className="min-h-11"
                            disabled={isSelf}
                            title={
                              isSelf
                                ? "Vous ne pouvez pas suspendre votre propre compte."
                                : undefined
                            }
                            onClick={() =>
                              setPending({ kind: "suspend", user: item })
                            }
                          >
                            Suspendre
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
        title={pending ? ACTIONS[pending.kind].title : ""}
        confirmLabel={pending ? ACTIONS[pending.kind].confirmLabel : ""}
        tone={pending ? ACTIONS[pending.kind].tone : "primary"}
        isLoading={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setPending(null)}
      >
        {pending ? <p>{ACTIONS[pending.kind].description(pending.user)}</p> : null}
      </ConfirmDialog>
    </AdminLayout>
  );
}
