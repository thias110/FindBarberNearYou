import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { SocialNetwork } from "@findbarber/shared/types";
import { useAuth } from "../app/auth-context";
import { useSiteConfig } from "../lib/siteConfig";
import { Logo } from "./Logo";
import { FadeMotif } from "./ui/FadeMotif";

// Pied de page global (issue #59, design system « Dégradé » : plan §2.6.10) :
// section nuit annoncée par le motif « dégradé », colonnes Rechercher, Pour
// les pros, Aide et Légal, puis réseaux sociaux et ©. Chaque lien n'apparaît
// que si sa cible existe ou est configurée côté serveur : aucune URL écrite en
// dur, aucun lien vide ni « # ».
const LINK_CLASS =
  "focus-ring-on-night inline-flex min-h-11 items-center rounded-md text-sm text-night-muted transition-colors duration-fast hover:text-white";

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

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="font-sans text-xs font-bold uppercase tracking-[0.08em] text-white">
        {title}
      </h2>
      <ul className="mt-2.5">{children}</ul>
    </div>
  );
}

export function SiteFooter() {
  const { supportEmail, socialLinks } = useSiteConfig();
  const { user } = useAuth();
  const { t } = useTranslation("common");
  const proArea = !user ? "/login" : user.role === "BARBER" ? "/pro/dashboard" : null;

  return (
    <footer>
      {/* Raccord avec la section précédente : les lignes se resserrent vers la nuit. */}
      <FadeMotif className="h-10 w-full rotate-180 text-night" />
      <div className="relative overflow-hidden bg-night text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_0%,rgb(var(--fb-cobalt)/0.18),transparent_70%)]"
        />
        <nav
          aria-label={t("footer.nav")}
          className="relative mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-4 pb-8 pt-12 sm:px-8 lg:grid-cols-4"
        >
          <FooterColumn title={t("footer.searchTitle")}>
            <li>
              <Link to="/barbers" className={LINK_CLASS}>
                {t("footer.findBarber")}
              </Link>
            </li>
          </FooterColumn>
          {(!user || proArea) && (
            <FooterColumn title={t("footer.prosTitle")}>
              {!user && (
                <li>
                  <Link to="/register?role=BARBER" className={LINK_CLASS}>
                    {t("nav.becomePartner")}
                  </Link>
                </li>
              )}
              {proArea && (
                <li>
                  <Link to={proArea} className={LINK_CLASS}>
                    {t("nav.proLogin")}
                  </Link>
                </li>
              )}
            </FooterColumn>
          )}
          <FooterColumn title={t("footer.helpTitle")}>
            <li>
              <Link to="/aide" className={LINK_CLASS}>
                {t("footer.faq")}
              </Link>
            </li>
            {supportEmail && (
              <li>
                <a href={`mailto:${supportEmail}`} className={LINK_CLASS}>
                  {t("footer.contact")}
                </a>
              </li>
            )}
          </FooterColumn>
          <FooterColumn title={t("footer.legalTitle")}>
            <li>
              <Link to="/mentions-legales" className={LINK_CLASS}>
                {t("footer.legal")}
              </Link>
            </li>
          </FooterColumn>
        </nav>
        <div className="relative mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-white/10 px-4 py-6 sm:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <Logo tone="onNight" />
            <p className="text-sm text-night-muted">
              © {new Date().getFullYear()} FindBarber
            </p>
          </div>
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
                    className={`${LINK_CLASS} min-w-11 justify-center rounded-full hover:bg-white/[0.08]`}
                  >
                    <SocialIcon network={link.network} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
