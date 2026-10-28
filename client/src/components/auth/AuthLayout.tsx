import type { ReactNode } from "react";
import { LanguageSelect } from "../LanguageSelect";
import { Logo } from "../Logo";
import { Card } from "../ui/Card";
import { AuthBrandPanel } from "./AuthBrandPanel";

// Coque partagée Login/Register : mobile-first, une colonne ; à partir de lg,
// deux colonnes (panneau de marque + formulaire dans une Card centrée). Le
// header global de App.tsx est masqué sur ces routes, donc le logo n'est
// rendu qu'une seule fois : ici. Pas de sélecteur de thème (issue #30) : le
// thème suit l'appareil ou la préférence choisie dans Paramètres.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* En-tête compact mobile : le panneau de marque n'existe qu'en lg. */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Logo />
        <LanguageSelect compact />
      </header>

      <div className="lg:grid lg:min-h-screen lg:grid-cols-2">
        <aside className="hidden lg:block">
          <AuthBrandPanel />
        </aside>

        <main className="relative flex min-w-0 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
          {/* Langue (issue #37) : en lg, le header mobile est masqué. */}
          <LanguageSelect compact className="absolute right-6 top-4 hidden lg:block" />
          <Card className="w-full max-w-md p-6 shadow-card sm:p-8">
            {children}
          </Card>
        </main>
      </div>
    </div>
  );
}
