import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { SocialNetwork } from "@findbarber/shared/types";
import { useSiteConfig } from "../lib/siteConfig";

// Pied de page global (issue #59) : réseaux sociaux, contact (issue #58) et
// mentions légales. Chaque lien n'apparaît que si sa cible est configurée
// côté serveur : aucune URL écrite en dur, aucun lien vide ni « # ».
const LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-lg px-1 text-sm text-foreground-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const NETWORK_LABEL: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

function SocialIcon({ network }: { network: SocialNetwork }) {
  const paths: Record<SocialNetwork, ReactNode> = {
    instagram: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    facebook: (
      <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v7h4v-7h3l1-4h-4V8Z" />
    ),
    tiktok: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 3 2.5 5 5.5 5" />,
    linkedin: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[network]}
    </svg>
  );
}

export function SiteFooter() {
  const { supportEmail, socialLinks } = useSiteConfig();
  const { t } = useTranslation("common");

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label={t("footer.nav")} className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {supportEmail && (
            <a href={`mailto:${supportEmail}`} className={LINK_CLASS}>
              {t("footer.contact")}
            </a>
          )}
          <Link to="/mentions-legales" className={LINK_CLASS}>
            {t("footer.legal")}
          </Link>
          <span className="text-sm text-foreground-muted">
            © {new Date().getFullYear()} FindBarber
          </span>
        </nav>
        {socialLinks.length > 0 && (
          <ul aria-label={t("footer.social")} className="flex items-center gap-1">
            {socialLinks.map((link) => (
              <li key={link.network}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("footer.newTab", {
                    network: NETWORK_LABEL[link.network],
                  })}
                  className={`${LINK_CLASS} min-w-11 justify-center`}
                >
                  <SocialIcon network={link.network} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
