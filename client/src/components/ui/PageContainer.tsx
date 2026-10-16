import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

// Conteneur de page (lot DS-2, plan §2.3) : largeur maximale par rôle et
// espacement vertical entre blocs, au lieu des `mx-auto max-w-* space-y-*`
// recopiés dans chaque page. Les marges latérales restent portées par le
// <main> de la coque (App, AuthLayout, AdminLayout).

export type PageWidth = "form" | "reading" | "wide" | "page";
export type PageStack = "none" | "md" | "lg";

const WIDTHS: Record<PageWidth, string> = {
  form: "max-w-[35rem]", // 560 px : formulaires isolés
  reading: "max-w-[45rem]", // 720 px : contenu de lecture, listes, réglages
  wide: "max-w-[65rem]", // 1040 px : tableaux de bord, fiches, tunnel
  page: "max-w-7xl", // 1280 px : pages vitrine pleine largeur
};

const STACKS: Record<PageStack, string> = {
  none: "",
  md: "space-y-6",
  lg: "space-y-8",
};

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  width?: PageWidth;
  stack?: PageStack;
}

export function PageContainer({
  width = "reading",
  stack = "md",
  className,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full", WIDTHS[width], STACKS[stack], className)}
      {...props}
    />
  );
}
