import type { ReactNode } from "react";
import { Logo } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";
import { Card } from "../ui/Card";
import { AuthBrandPanel } from "./AuthBrandPanel";

// Coque partagée Login/Register : mobile-first, une colonne ; à partir de lg,
// deux colonnes (panneau de marque + formulaire dans une Card centrée). Le
// header global de App.tsx est masqué sur ces routes, donc Logo et ThemeToggle
// ne sont rendus qu'une seule fois : ici.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* En-tête compact mobile : le panneau de marque n'existe qu'en lg. */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Logo />
        <ThemeToggle />
      </header>

      <div className="lg:grid lg:min-h-screen lg:grid-cols-2">
        <aside className="hidden lg:block">
          <AuthBrandPanel />
        </aside>

        <main className="flex min-w-0 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
          <Card className="w-full max-w-md p-6 sm:p-8">{children}</Card>
        </main>
      </div>
    </div>
  );
}
