import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { OwnBarberProfile, ProfileCompletion } from "@findbarber/shared/types";
import { useAuth } from "../../app/auth-context";
import { ApiError, barberApi } from "../../lib/apiClient";
import { useScrollToHash } from "../../lib/useScrollToHash";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { AvatarEditor } from "../../components/account/AvatarEditor";
import { ProNavCard } from "../../components/barber/ProNavCard";
import { ProfileChecklist } from "../../components/barber/ProfileChecklist";
import { buttonClasses } from "../../components/ui/buttonStyles";
import { CONTROL_CLASS } from "../../components/ui/control";
import { PageContainer } from "../../components/ui/PageContainer";

// Routes BARBER existantes : aucune URL n'est introduite ni modifiée.
// Titre et description : `dashboard.nav.<clé>.title` / `.description`.
const PRO_NAV = [
  { to: "/pro/profile", key: "profile" },
  { to: "/pro/services", key: "services" },
  { to: "/pro/working-hours", key: "workingHours" },
  { to: "/pro/time-off", key: "timeOff" },
  { to: "/pro/bookings", key: "bookings" },
  { to: "/pro/stats", key: "stats" },
  { to: "/pro/gallery", key: "gallery" },
  { to: "/pro/payments", key: "payments" },
] as const;

export function BarberDashboardPage() {
  const { t } = useTranslation("barber");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const copyTimeoutRef = useRef<number | null>(null);

  const [profile, setProfile] = useState<OwnBarberProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Checklist de finalisation (issue #42) : facultative, un échec de
  // chargement la masque simplement sans bloquer le tableau de bord.
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);
  const loadProfile = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setProfileMissing(false);
    setProfile(null);
    barberApi
      .getProfile()
      .then((res) => {
        setProfile(res.profile);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.code === "BARBER_PROFILE_NOT_FOUND") {
          setProfileMissing(true);
        } else {
          setLoadError(
            err instanceof Error
              ? err.message
              : t("dashboard.loadProfileFailed"),
          );
        }
      })
      .finally(() => {
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` : texte de repli seulement.
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const avatarPath = user?.avatarPath ?? null;
  // Lien direct depuis la checklist vers la photo (#photo-profil).
  useScrollToHash(!loading);

  useEffect(() => {
    let cancelled = false;
    barberApi
      .getProfileCompletion()
      .then((res) => {
        if (!cancelled) setCompletion(res.completion);
      })
      .catch(() => {
        if (!cancelled) setCompletion(null);
      });
    return () => {
      cancelled = true;
    };
    // Rechargée quand la photo change (issue #44) : l'étape se coche aussitôt.
  }, [avatarPath]);

  // Nettoyage du minuteur de confirmation de copie (évite un setState après
  // démontage).
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const publicLink = profile
    ? `${window.location.origin}/barbers/${profile.id}`
    : null;

  async function handleCopy() {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setCopyError(null);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(
        t("dashboard.copyFailed"),
      );
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <PageContainer width="wide">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {t("dashboard.title")}
            </h1>
            <p className="mt-1 break-words text-sm text-foreground-muted">
              {user?.name ? `${user.name} · ${user.email}` : user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            className="min-h-[44px]"
            onClick={() => void handleLogout()}
          >
            {t("dashboard.logout")}
          </Button>
        </header>

        {/* Profil en attente d'approbation (issue #40) : invisible du public. */}
        {profile && !profile.approved && (
          <Alert variant="info">
            <p className="font-semibold">{t("dashboard.pendingApproval.title")}</p>
            <p className="mt-1">{t("dashboard.pendingApproval.body")}</p>
          </Alert>
        )}

        {completion && <ProfileChecklist completion={completion} />}

        <Card id="photo-profil" className="scroll-mt-4 p-6">
          <h2 className="mb-4 text-lg font-bold text-foreground">
            {t("dashboard.avatarTitle")}
          </h2>
          <AvatarEditor />
        </Card>

        {/* Sur mobile, accès aux sections que la barre d'onglets ne porte pas ;
            à partir de `lg:`, la barre latérale les remplace (plan §2.6.6). */}
        <nav
          aria-label={t("dashboard.navLabel")}
          className="grid gap-3 sm:grid-cols-2 lg:hidden"
        >
          {PRO_NAV.map((item) => (
            <ProNavCard
              key={item.to}
              to={item.to}
              title={t(`dashboard.nav.${item.key}.title`)}
              description={t(`dashboard.nav.${item.key}.description`)}
            />
          ))}
        </nav>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-foreground">
            {t("dashboard.publicLink.title")}
          </h2>

          {loading ? (
            <div className="mt-3 space-y-2" aria-busy="true">
              <span className="sr-only" role="status">
                {t("dashboard.publicLink.loading")}
              </span>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-40" />
            </div>
          ) : loadError ? (
            <Alert variant="danger" className="mt-3">
              <p>{loadError}</p>
              <Button
                variant="secondary"
                className="mt-3 min-h-[44px]"
                onClick={loadProfile}
              >
                {t("common.retry")}
              </Button>
            </Alert>
          ) : profileMissing ? (
            <div className="mt-3">
              <Alert variant="info">
                {t("dashboard.publicLink.profileMissing")}
              </Alert>
              <Button
                className="mt-3 min-h-[44px]"
                onClick={() => navigate("/pro/profile")}
              >
                {t("common.createProfile")}
              </Button>
            </div>
          ) : publicLink ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-foreground-muted">
                {t("dashboard.publicLink.help")}
              </p>
              <input
                readOnly
                value={publicLink}
                onFocus={(event) => event.currentTarget.select()}
                aria-label={t("dashboard.publicLink.inputLabel")}
                className={CONTROL_CLASS}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  className="min-h-[44px]"
                  onClick={() => void handleCopy()}
                >
                  {copied
                    ? t("dashboard.publicLink.copied")
                    : t("dashboard.publicLink.copy")}
                </Button>
                <a
                  href={publicLink}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClasses("secondary")}
                >
                  {t("dashboard.publicLink.view")}
                </a>
              </div>
              {copied && (
                <p role="status" className="text-sm text-success">
                  {t("dashboard.publicLink.copiedStatus")}
                </p>
              )}
              {copyError && <Alert variant="warning">{copyError}</Alert>}
            </div>
          ) : null}
        </Card>
      </PageContainer>
    </div>
  );
}
