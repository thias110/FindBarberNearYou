import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { getMapSettings, MAP_ATTRIBUTION } from "../lib/mapConfig";

type MapStatus = "loading" | "ready" | "error" | "unconfigured";

interface BarbersMapProps {
  barbers: PublicBarberSearchItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  reducedMotion: boolean;
  onRetry: () => void;
  onShowList: () => void;
  /** Thème résolu du ThemeProvider (style sombre optionnel). */
  theme: "light" | "dark";
}

const SVG_NS = "http://www.w3.org/2000/svg";
// Une erreur ponctuelle de tuile ne doit pas déclarer la carte en panne. Tant que
// le style n'a pas chargé, une première erreur ouvre une courte marge : si `load`
// survient dans ce délai (tuile isolée), la carte reste utilisable ; sinon on
// considère la panne persistante. Un délai absolu sert de garde-fou.
const ERROR_GRACE_MS = 4000;
const LOAD_TIMEOUT_MS = 12000;

function createMarkerElement(
  barber: PublicBarberSearchItem,
  selected: boolean,
): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `fb-map-marker${
    selected ? " fb-map-marker--selected" : ""
  }`;
  element.dataset.barberId = barber.id;
  element.setAttribute(
    "aria-label",
    `${barber.displayName} à ${barber.city} — afficher sur la carte`,
  );
  element.setAttribute("aria-pressed", selected ? "true" : "false");

  // SVG construit via DOM (jamais innerHTML) : aucune donnée utilisateur n'entre
  // dans le balisage. Le nom/la ville passent uniquement par textContent.
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 32 44");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const pin = document.createElementNS(SVG_NS, "path");
  pin.setAttribute("class", "fb-map-marker__pin");
  pin.setAttribute(
    "d",
    "M16 0C7.2 0 0 7.2 0 16c0 11 16 28 16 28s16-17 16-28C32 7.2 24.8 0 16 0z",
  );

  const ring = document.createElementNS(SVG_NS, "circle");
  ring.setAttribute("class", "fb-map-marker__ring");
  ring.setAttribute("cx", "16");
  ring.setAttribute("cy", "16");
  ring.setAttribute("r", "10");

  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("class", "fb-map-marker__dot");
  dot.setAttribute("cx", "16");
  dot.setAttribute("cy", "16");
  dot.setAttribute("r", "5");

  svg.append(pin, ring, dot);
  element.appendChild(svg);
  return element;
}

// Signature des résultats : sert à ne recadrer QUE lors d'un changement réel
// (nouvelle page / nouveaux filtres), jamais à chaque rendu ni à la sélection.
function resultsSignature(barbers: PublicBarberSearchItem[]): string {
  return barbers
    .map((b) => `${b.id}:${b.latitude}:${b.longitude}`)
    .join("|");
}

function fitToResults(
  map: maplibregl.Map,
  barbers: PublicBarberSearchItem[],
  reducedMotion: boolean,
) {
  if (barbers.length === 0) return;
  const duration = reducedMotion ? 0 : 600;
  if (barbers.length === 1) {
    map.easeTo({
      center: [barbers[0].longitude, barbers[0].latitude],
      zoom: 13,
      duration,
      essential: true,
    });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  for (const barber of barbers) {
    bounds.extend([barber.longitude, barber.latitude]);
  }
  map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration });
}

export default function BarbersMap({
  barbers,
  selectedId,
  onSelect,
  reducedMotion,
  onRetry,
  onShowList,
  theme,
}: BarbersMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<
    Map<string, { marker: maplibregl.Marker; element: HTMLButtonElement }>
  >(new Map());
  const loadedRef = useRef(false);
  const signatureRef = useRef("");
  const [status, setStatus] = useState<MapStatus>("loading");
  const [transientTileError, setTransientTileError] = useState(false);

  // Refs pour garder les callbacks/valeurs à jour sans relancer l'init.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const barbersRef = useRef(barbers);
  barbersRef.current = barbers;
  const statusRef = useRef(status);
  statusRef.current = status;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const appliedStyleRef = useRef<string | null>(null);

  // --- Initialisation unique de la carte ---
  useEffect(() => {
    // Copie locale de la Map : garantit un nettoyage sur la bonne référence.
    const markers = markersRef.current;
    const settings = getMapSettings(themeRef.current);
    if (!settings.configured || !settings.styleUrl) {
      // Pas de clé : aucun appel fournisseur, message explicite côté rendu.
      setStatus("unconfigured");
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: settings.styleUrl,
        center: [6.1432, 46.2044],
        zoom: 6,
        attributionControl: false,
        fadeDuration: reducedMotionRef.current ? 0 : 300,
      });
    } catch (error) {
      // WebGL indisponible / contexte perdu : panne persistante, repli liste.
      console.error("BarbersMap init error", error);
      setStatus("error");
      return;
    }
    mapRef.current = map;
    appliedStyleRef.current = settings.styleUrl;

    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: MAP_ATTRIBUTION,
      }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    const watchdog = window.setTimeout(() => {
      if (!loadedRef.current) setStatus("error");
    }, LOAD_TIMEOUT_MS);

    let errorGraceTimer: number | undefined;
    const clearTimers = () => {
      window.clearTimeout(watchdog);
      if (errorGraceTimer !== undefined) window.clearTimeout(errorGraceTimer);
    };

    map.on("load", () => {
      loadedRef.current = true;
      clearTimers();
      setStatus("ready");
    });

    // Erreurs asynchrones du moteur : l'ErrorBoundary React ne les voit pas.
    map.on("error", (event) => {
      console.error("BarbersMap provider error", event.error ?? event);
      if (loadedRef.current) {
        // Carte déjà chargée : erreur de tuile ponctuelle, la carte reste utilisable.
        setTransientTileError(true);
        return;
      }
      // Erreur avant le premier `load` : courte marge de grâce. Si le style finit
      // par charger (tuile isolée), `load` annule le délai et la carte n'est pas
      // déclarée en panne ; sinon la panne est persistante.
      if (errorGraceTimer === undefined) {
        errorGraceTimer = window.setTimeout(() => {
          if (!loadedRef.current) setStatus("error");
        }, ERROR_GRACE_MS);
      }
    });

    // Redimensionnement correct (notamment à l'ouverture de la vue Carte mobile).
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);

    return () => {
      clearTimers();
      observer.disconnect();
      markers.clear();
      map.remove();
      mapRef.current = null;
      appliedStyleRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // --- Changement de thème : bascule de style SANS remount ---
  // Uniquement si une URL sombre dédiée est configurée. `setStyle` conserve la
  // caméra et les marqueurs (DOM) ; toute erreur laisse la carte intacte.
  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      statusRef.current === "unconfigured" ||
      statusRef.current === "error"
    ) {
      return;
    }
    const settings = getMapSettings(theme);
    if (!settings.styleUrl || settings.styleUrl === appliedStyleRef.current) {
      return;
    }
    try {
      map.setStyle(settings.styleUrl, { diff: false });
      appliedStyleRef.current = settings.styleUrl;
    } catch (error) {
      console.error("BarbersMap style change error", error);
    }
  }, [theme]);

  // --- Synchronisation des marqueurs + cadrage sur changement réel ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status === "error" || status === "unconfigured") return;

    const nextIds = new Set(barbers.map((b) => b.id));
    for (const [id, entry] of markersRef.current) {
      if (!nextIds.has(id)) {
        entry.marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const barber of barbers) {
      const selected = barber.id === selectedId;
      let entry = markersRef.current.get(barber.id);
      if (!entry) {
        const element = createMarkerElement(barber, selected);
        element.addEventListener("click", () =>
          onSelectRef.current(barber.id),
        );
        const marker = new maplibregl.Marker({ element, anchor: "bottom" })
          .setLngLat([barber.longitude, barber.latitude])
          .addTo(map);
        entry = { marker, element };
        markersRef.current.set(barber.id, entry);
      } else {
        entry.marker.setLngLat([barber.longitude, barber.latitude]);
        entry.element.classList.toggle("fb-map-marker--selected", selected);
        entry.element.setAttribute(
          "aria-pressed",
          selected ? "true" : "false",
        );
      }
    }

    if (status === "ready") {
      const signature = resultsSignature(barbers);
      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        fitToResults(map, barbers, reducedMotionRef.current);
      }
    }
  }, [barbers, status, selectedId]);

  // --- La sélection (clic liste) amène le marqueur dans la vue, sans recentrage global ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId || statusRef.current !== "ready") return;
    const barber = barbersRef.current.find((b) => b.id === selectedId);
    if (!barber) return;
    map.easeTo({
      center: [barber.longitude, barber.latitude],
      duration: reducedMotionRef.current ? 0 : 500,
      essential: true,
    });
  }, [selectedId]);

  return (
    <div
      className="relative h-full w-full"
      data-testid="barbers-map"
      data-map-status={status}
    >
      <div ref={containerRef} className="h-full w-full" />

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/70">
          <p className="text-sm text-foreground-muted">
            Chargement de la carte…
          </p>
        </div>
      )}

      {status === "unconfigured" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface p-6 text-center">
          {import.meta.env.DEV ? (
            // Développement (serveur Vite) : instructions techniques pour la clé.
            <>
              <p className="text-sm font-medium text-foreground">
                Carte non configurée.
              </p>
              <p className="max-w-xs text-xs text-foreground-muted">
                Renseignez <code>VITE_MAP_API_KEY</code> (clé publique MapTiler
                restreinte par origine) dans le fichier <code>.env</code>, puis
                redémarrez le serveur de développement. La liste reste
                pleinement utilisable.
              </p>
            </>
          ) : (
            // Production : message utilisateur neutre, sans détail technique.
            <p className="max-w-xs text-sm text-foreground">
              La carte est momentanément indisponible. Vous pouvez continuer
              avec la liste.
            </p>
          )}
          <button
            type="button"
            onClick={onShowList}
            className="mt-1 inline-flex min-h-[44px] items-center rounded-lg border border-accent px-3 text-sm text-accent lg:hidden"
          >
            Revenir à la liste
          </button>
        </div>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface p-6 text-center"
        >
          <p className="text-sm font-medium text-foreground">
            La carte n'a pas pu se charger.
          </p>
          <p className="max-w-xs text-xs text-foreground-muted">
            La liste des résultats reste utilisable.
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-accent px-3 text-sm text-accent"
            >
              Réessayer la carte
            </button>
            <button
              type="button"
              onClick={onShowList}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-border px-3 text-sm text-foreground-muted lg:hidden"
            >
              Revenir à la liste
            </button>
          </div>
        </div>
      )}

      {status === "ready" && transientTileError && (
        <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] text-foreground-muted">
          Certaines tuiles n'ont pas pu se charger.
        </p>
      )}
    </div>
  );
}
