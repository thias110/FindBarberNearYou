import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { NotificationType } from "@findbarber/shared/constants";
import type { Notification } from "@findbarber/shared/types";
import { notificationApi } from "../lib/apiClient";
import { formatDateTime } from "../lib/formatters";
import { cn } from "../lib/cn";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";

const PANEL_ID = "notifications-panel";

// Libellés statiques (`common:notifications.type.*`) : la réponse du serveur
// ne contient aucune donnée personnelle (ni nom de client, ni service) — on
// n'en invente aucune.
function notificationKey(type: NotificationType): string {
  return `notifications.type.${type}`;
}

export function NotificationBell() {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[] | null>(
    null,
  );
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [markAllBusy, setMarkAllBusy] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const loadCount = useCallback(async () => {
    try {
      const res = await notificationApi.unreadCount();
      setUnreadCount(res.count);
    } catch {
      // Compteur indisponible : badge masqué (comportement sûr).
      setUnreadCount(null);
    }
  }, []);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(false);
    try {
      const res = await notificationApi.list();
      setNotifications(res.notifications);
    } catch {
      setListError(true);
    } finally {
      setListLoading(false);
    }
  }, []);

  // Compteur rafraîchi au montage, puis chaque minute et au retour sur
  // l'onglet (uniquement quand la page est visible).
  useEffect(() => {
    void loadCount();
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void loadCount();
    };
    const timer = window.setInterval(refreshIfVisible, 60_000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [loadCount]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setActionError(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setActionError(null);
        bellRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleToggle() {
    if (open) {
      setOpen(false);
      setActionError(null);
      return;
    }
    setOpen(true);
    void loadCount();
    void loadList();
  }

  async function handleMarkRead(id: string) {
    setActionError(null);
    setActionId(id);
    try {
      await notificationApi.markRead(id);
      await Promise.all([loadList(), loadCount()]);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("notifications.actionError"),
      );
    } finally {
      setActionId(null);
    }
  }

  async function handleMarkAllRead() {
    setActionError(null);
    setMarkAllBusy(true);
    try {
      await notificationApi.markAllRead();
      await Promise.all([loadList(), loadCount()]);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("notifications.actionError"),
      );
    } finally {
      setMarkAllBusy(false);
    }
  }

  const hasUnread = notifications?.some((n) => n.readAt === null) ?? false;

  const badge =
    unreadCount !== null && unreadCount > 0
      ? unreadCount > 9
        ? "9+"
        : String(unreadCount)
      : null;

  const ariaLabel =
    unreadCount !== null && unreadCount > 0
      ? t("notifications.unread", { count: unreadCount })
      : t("notifications.title");

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={bellRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={handleToggle}
        className={cn(
          "relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground-muted transition-colors",
          "hover:bg-surface-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {badge && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-none text-accent-foreground"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          id={PANEL_ID}
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-surface text-foreground shadow-card sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
            <h2 className="text-sm font-bold text-foreground">
              {t("notifications.title")}
            </h2>
            {hasUnread && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                disabled={markAllBusy}
                className={cn(
                  "inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-accent-strong underline",
                  "transition-colors hover:text-accent-strong",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                {markAllBusy
                  ? t("notifications.marking")
                  : t("notifications.markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {listError && !listLoading ? (
              <div className="p-4">
                <Alert variant="danger">
                  {t("notifications.loadError")}
                </Alert>
                <Button
                  variant="secondary"
                  className="mt-3 min-h-[44px] w-full"
                  onClick={() => {
                    void loadCount();
                    void loadList();
                  }}
                >
                  {t("notifications.retry")}
                </Button>
              </div>
            ) : listLoading ? (
              <div aria-busy="true" className="space-y-3 p-4">
                <span className="sr-only" role="status">
                  {t("notifications.loading")}
                </span>
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : notifications && notifications.length === 0 ? (
              <p className="p-4 text-sm text-foreground-muted">
                {t("notifications.empty")}
              </p>
            ) : notifications ? (
              <ul className="divide-y divide-border">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className="flex items-start justify-between gap-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm",
                          notification.readAt
                            ? "text-foreground-muted"
                            : "font-medium text-foreground",
                        )}
                      >
                        {t(notificationKey(notification.type))}
                      </p>
                      <p className="mt-0.5 text-xs text-foreground-muted">
                        {formatDateTime(notification.createdAt)}
                      </p>
                    </div>

                    {notification.readAt ? (
                      <span
                        aria-label={t("notifications.readLabel")}
                        className="shrink-0 text-xs font-medium text-foreground-muted"
                      >
                        {t("notifications.read")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleMarkRead(notification.id)}
                        disabled={actionId === notification.id}
                        className={cn(
                          "inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-2 text-xs font-medium text-accent-strong underline",
                          "transition-colors hover:text-accent-strong",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          "disabled:pointer-events-none disabled:opacity-50",
                        )}
                      >
                        {actionId === notification.id
                          ? t("notifications.marking")
                          : t("notifications.markRead")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {actionError && (
            <div className="border-t border-border px-4 py-3">
              <Alert variant="danger">{actionError}</Alert>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
