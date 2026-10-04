import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@findbarber/shared/constants";
import type { AdminUser, Role } from "@findbarber/shared/types";
import { adminApi } from "../../lib/apiClient";
import { useAuth } from "../../app/auth-context";
import { AdminLayout } from "../../components/AdminLayout";
import { AdminPagination } from "../../components/AdminPagination";
import { adminUserDisplayName } from "../../lib/admin";
import { formatDateTime } from "../../lib/formatters";

type RoleFilter = "ALL" | Role;

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "CLIENT", label: "Clients" },
  { value: "BARBER", label: "Barbiers" },
  { value: "ADMIN", label: "Administrateurs" },
];

const PAGE_SIZE = 20;

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
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

  async function handleSuspend(target: AdminUser) {
    if (
      !window.confirm(
        `Suspendre ${target.email} ? Ses réservations futures seront annulées.`,
      )
    ) {
      return;
    }
    setActionId(target.id);
    setMessage(null);
    try {
      await adminApi.suspendUser(target.id);
      setMessage({
        kind: "success",
        text: `${target.email} a été suspendu.`,
      });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Suspension impossible.",
      });
    } finally {
      setActionId(null);
    }
  }

  async function handleReactivate(target: AdminUser) {
    if (!window.confirm(`Réactiver ${target.email} ?`)) {
      return;
    }
    setActionId(target.id);
    setMessage(null);
    try {
      await adminApi.reactivateUser(target.id);
      setMessage({
        kind: "success",
        text: `${target.email} a été réactivé.`,
      });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Réactivation impossible.",
      });
    } finally {
      setActionId(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-brand-900">Utilisateurs</h2>

        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => handleRoleChange(filter.value)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                role === filter.value
                  ? "bg-brand-700 text-white"
                  : "border border-gray-300 text-gray-700"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {message && (
          <p
            className={`rounded-lg p-3 text-sm ${
              message.kind === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-center text-gray-500">
            Chargement…
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-2 rounded-lg border border-brand-700 px-3 py-1 text-brand-700"
            >
              Réessayer
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-gray-600">
            Aucun utilisateur pour ce filtre.
          </div>
        ) : (
          <ul className="space-y-3">
            {users.map((item) => {
              const isSelf = item.id === currentUser?.id;
              const busy = actionId === item.id;
              return (
                <li
                  key={item.id}
                  className="rounded-xl bg-white p-4 shadow"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-brand-900">
                        {adminUserDisplayName(item)}
                      </p>
                      <p className="text-sm text-gray-600">{item.email}</p>
                      <p className="mt-1 text-sm text-gray-700">
                        {ROLE_LABELS[item.role]} ·{" "}
                        {USER_STATUS_LABELS[item.status]}
                      </p>
                      <p className="text-xs text-gray-500">
                        Inscrit le {formatDateTime(item.createdAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.role === "BARBER" && item.barberProfileId && (
                        <Link
                          to={`/admin/barbers/${item.barberProfileId}/stats`}
                          className="rounded-lg border border-brand-700 px-3 py-1.5 text-sm text-brand-700"
                        >
                          Voir les statistiques
                        </Link>
                      )}
                      {item.status === "ACTIVE" ? (
                        <button
                          type="button"
                          disabled={isSelf || busy}
                          title={
                            isSelf
                              ? "Vous ne pouvez pas suspendre votre propre compte."
                              : undefined
                          }
                          onClick={() => void handleSuspend(item)}
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
                        >
                          {busy ? "Suspension…" : "Suspendre"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleReactivate(item)}
                          className="rounded-lg border border-brand-700 px-3 py-1.5 text-sm text-brand-700 disabled:opacity-50"
                        >
                          {busy ? "Réactivation…" : "Réactiver"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <AdminPagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </AdminLayout>
  );
}
