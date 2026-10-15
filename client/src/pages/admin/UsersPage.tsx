import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@findbarber/shared/constants";
import type { AdminUser, Role } from "@findbarber/shared/types";
import { adminApi } from "../../lib/apiClient";
import { useAuth } from "../../app/auth-context";
import { AdminLayout } from "../../components/AdminLayout";
import { AdminPagination } from "../../components/AdminPagination";
import { AdminListState } from "../../components/admin/AdminListState";
import { FilterChips } from "../../components/admin/FilterChips";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { adminUserDisplayName } from "../../lib/admin";
import { formatDateTime } from "../../lib/formatters";
import { buttonClasses } from "../../components/ui/buttonStyles";

type RoleFilter = "ALL" | Role;

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "CLIENT", label: "Clients" },
  { value: "BARBER", label: "Barbiers" },
  { value: "ADMIN", label: "Administrateurs" },
];

const PAGE_SIZE = 20;

const SECONDARY_LINK_CLASS = buttonClasses("secondary");

type PendingAction = { kind: "suspend" | "reactivate"; user: AdminUser };

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [role, setRole] = useState<RoleFilter>("ALL");
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
        role: role === "ALL" ? undefined : role,
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
    try {
      if (kind === "suspend") {
        await adminApi.suspendUser(target.id);
        setMessage({
          kind: "success",
          text: `${target.email} a été suspendu.`,
        });
      } else {
        await adminApi.reactivateUser(target.id);
        setMessage({
          kind: "success",
          text: `${target.email} a été réactivé.`,
        });
      }
      setReloadKey((key) => key + 1);
    } catch (err) {
      setMessage({
        kind: "error",
        text:
          err instanceof Error
            ? err.message
            : kind === "suspend"
              ? "Suspension impossible."
              : "Réactivation impossible.",
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Utilisateurs</h2>

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
                        </div>
                        <p className="mt-2 text-xs text-foreground-muted">
                          Inscrit le {formatDateTime(item.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
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
        title={
          pending?.kind === "suspend"
            ? "Suspendre ce compte ?"
            : "Réactiver ce compte ?"
        }
        confirmLabel={pending?.kind === "suspend" ? "Suspendre" : "Réactiver"}
        tone={pending?.kind === "suspend" ? "danger" : "primary"}
        isLoading={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === "suspend" ? (
          <p>
            {pending.user.email} ne pourra plus se connecter et ses réservations
            futures seront annulées.
          </p>
        ) : pending ? (
          <p>{pending.user.email} pourra de nouveau se connecter.</p>
        ) : null}
      </ConfirmDialog>
    </AdminLayout>
  );
}
