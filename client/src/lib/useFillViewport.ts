import { useLayoutEffect, useState, type RefObject } from "react";

// Hauteur disponible sous le header global (issue #49) : la carte de recherche
// occupe tout l'écran restant, sans dépendre de la hauteur exacte du header
// (qui peut changer : bandeau, langue, notifications).
export function useFillViewport(ref: RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(320, Math.round(window.innerHeight - top)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ref]);

  return height;
}
