import { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { Trans, useTranslation } from "react-i18next";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre 6 charge son worker depuis `maplibre-gl-worker.mjs` à côté de son
// propre module ; une fois bundlé par Vite, ce fichier n'existe pas dans
// /assets et la carte échoue (« Worker failed to load »). `?worker&url` fait
// bundler le worker (et ses imports) par Vite et renvoie son URL same-origin,
// compatible avec la CSP `worker-src 'self'`.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import type { GeoBounds, LatLng } from "../lib/geo";
import type { VisitorPositionStatus } from "../lib/visitorPosition";
import { getMapSettings, MAP_ATTRIBUTION } from "../lib/mapConfig";
import { groupPins } from "../lib/mapClusters";
import { intlLocale } from "../i18n";

type MapStatus = "loading" | "ready" | "error" | "unconfigured";

interface BarbersMapProps {
  barbers: PublicBarberSearchItem[];
  selectedId: string | null;
  hoveredId?: string | null;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
  reducedMotion: boolean;
  onRetry: () => void;
  onShowList: () => void;
  /** Thème résolu du ThemeProvider (style sombre optionnel). */
  theme: "light" | "dark";
  /**
   * Marges de cadrage en pixels (issue #49) : zones de la carte couvertes par
   * les panneaux superposés, où les marqueurs ne doivent pas être placés.
   */
  padding?: MapPadding;
  /**
   * Zone visible après un déplacement ou un zoom DU VISITEUR (issue #50), pas
   * après un recadrage automatique. Absente : la carte ne remonte rien.
   */
  onViewportChange?: (bounds: GeoBounds) => void;
  /**
   * `false` quand les résultats viennent de la zone visible : la carte ne se
   * recadre pas sur eux (sinon elle bougerait sous les doigts du visiteur).
   */
  autoFit?: boolean;
  /**
   * Bouton « Ma position » (lot « Ma position ») : position du visiteur (en
   * mémoire seulement), état de la demande, action du bouton et compteur qui
   * recentre la carte sur la position à chaque incrément.
   */
  userPosition?: LatLng | null;
  locateStatus?: VisitorPositionStatus;
  onLocate?: () => void;
  recenterCount?: number;
}

const VIEWPORT_DEBOUNCE_MS = 400;
// Zoom d'arrivée sur la position du visiteur (quartier) ; on ne dézoome jamais.
const LOCATE_ZOOM = 13;

export interface MapPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const DEFAULT_PADDING: MapPadding = { top: 56, bottom: 56, left: 56, right: 56 };

maplibregl.setWorkerUrl(maplibreWorkerUrl);

// Une erreur ponctuelle de tuile ne doit pas déclarer la carte en panne. Tant que
// le style n'a pas chargé, une première erreur ouvre une courte marge : si `load`
// survient dans ce délai (tuile isolée), la carte reste utilisable ; sinon on
// considère la panne persistante. Un délai absolu sert de garde-fou.
const ERROR_GRACE_MS = 4000;
const LOAD_TIMEOUT_MS = 12000;

// Prix compact de l'épingle : « dès 35 CHF » (sans décimales si entier).
function pinPrice(barber: PublicBarberSearchItem): string | null {
  if (barber.startingPriceMinor === null) return null;
  const amount = barber.startingPriceMinor / 100;
  return new Intl.NumberFormat(intlLocale(), {
    style: "currency",
    currency: barber.currency,
    currencyDisplay: "code",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Épingle de prix (lot P-2, plan §2.6.9) : pilule focalisable, `aria-label`
// « Nom, dès 35 CHF ». Le corps visuel est un enfant : MapLibre positionne
// l'élément racine par `transform`, l'agrandissement se fait donc sur l'enfant.
// Construit via DOM (jamais innerHTML) : les données passent par textContent.
function createMarkerElement(
  barber: PublicBarberSearchItem,
  selected: boolean,
  t: TFunction<"client">,
): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `fb-price-pin${selected ? " fb-price-pin--selected" : ""}`;
  element.dataset.barberId = barber.id;
  const body = document.createElement("span");
  body.className = "fb-price-pin__body";
  body.setAttribute("aria-hidden", "true");
  element.appendChild(body);
  updateMarkerElement(element, barber, selected, t);
  return element;
}

function updateMarkerElement(
  element: HTMLButtonElement,
  barber: PublicBarberSearchItem,
  selected: boolean,
  t: TFunction<"client">,
) {
  const price = pinPrice(barber);
  element.classList.toggle("fb-price-pin--selected", selected);
  element.setAttribute("aria-pressed", selected ? "true" : "false");
  element.setAttribute("aria-label", markerLabel(barber, price, t));
  const body = element.firstElementChild as HTMLSpanElement;
  // Sans prestation active : l'initiale du nom, jamais un prix inventé.
  body.textContent = price
    ? t("map.pin.from", { price })
    : barber.displayName.charAt(0).toUpperCase();
}

function markerLabel(
  barber: PublicBarberSearchItem,
  price: string | null,
  t: TFunction<"client">,
): string {
  return price
    ? t("map.pin.aria", { name: barber.displayName, price })
    : t("map.marker", { name: barber.displayName, city: barber.city });
}

// Cercle de regroupement : nombre de barbers ; un clic zoome sur eux.
function createClusterElement(count: number, t: TFunction<"client">): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "fb-map-cluster";
  element.textContent = String(count);
  element.setAttribute("aria-label", t("map.cluster", { count }));
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
  padding: MapPadding,
) {
  if (barbers.length === 0) return;
  const duration = reducedMotion ? 0 : 600;
  if (barbers.length === 1) {
    map.easeTo({
      center: [barbers[0].longitude, barbers[0].latitude],
      zoom: 13,
      padding: safePadding(map, padding),
      duration,
      essential: true,
    });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  for (const barber of barbers) {
    bounds.extend([barber.longitude, barber.latitude]);
  }
  map.fitBounds(bounds, { padding: safePadding(map, padding), maxZoom: 15, duration });
}

// MapLibre refuse un cadrage si les marges dépassent la taille de la carte
// (petit écran) : on les réduit proportionnellement.
function safePadding(map: maplibregl.Map, padding: MapPadding): MapPadding {
  const { clientWidth: width, clientHeight: height } = map.getContainer();
  const scaleX = Math.min(1, (width * 0.8) / Math.max(1, padding.left + padding.right));
  const scaleY = Math.min(1, (height * 0.8) / Math.max(1, padding.top + padding.bottom));
  return {
    top: padding.top * scaleY,
    bottom: padding.bottom * scaleY,
    left: padding.left * scaleX,
    right: padding.right * scaleX,
  };
}

// Contrôle « Ma position » : un bouton dans le groupe des boutons de zoom
// (mêmes dimensions et styles, thème sombre compris). Il fait donc 29 px comme
// ces boutons et non les 44 px du design system : dérogation assumée, un seul
// bouton plus grand que son voisin de groupe serait incohérent.
// L'état « occupé » (aria-busy) est habillé dans index.css.
const LOCATE_ICON =
  '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20" ' +
  'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
  '<circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="7.5"/>' +
  '<path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg>';

class LocateControl implements maplibregl.IControl {
  private container: HTMLDivElement | null = null;
  private button: HTMLButtonElement | null = null;

  constructor(private readonly onClick: () => void) {}

  onAdd(): HTMLElement {
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = LOCATE_ICON;
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.addEventListener("click", this.onClick);
    container.appendChild(button);
    this.container = container;
    this.button = button;
    return container;
  }

  onRemove(): void {
    this.container?.remove();
    this.container = null;
    this.button = null;
  }

  update(label: string, busy: boolean): void {
    if (!this.button) return;
    this.button.setAttribute("aria-label", label);
    this.button.title = label;
    this.button.setAttribute("aria-busy", busy ? "true" : "false");
  }
}

// Repère de la position du visiteur : un point, purement décoratif.
function createUserElement(): HTMLDivElement {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  element.className =
    "h-4 w-4 rounded-full border-2 border-white bg-accent shadow-2 ring-4 ring-accent/25";
  return element;
}

export default function BarbersMap({
  barbers,
  selectedId,
  hoveredId = null,
  onSelect,
  onHover,
  reducedMotion,
  onRetry,
  onShowList,
  theme,
  padding = DEFAULT_PADDING,
  onViewportChange,
  autoFit = true,
  userPosition = null,
  locateStatus = "idle",
  onLocate,
  recenterCount = 0,
}: BarbersMapProps) {
  const { t } = useTranslation("client");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<
    Map<string, { marker: maplibregl.Marker; element: HTMLButtonElement }>
  >(new Map());
  const clustersRef = useRef<maplibregl.Marker[]>([]);
  const loadedRef = useRef(false);
  const signatureRef = useRef("");
  const [status, setStatus] = useState<MapStatus>("loading");
  const [transientTileError, setTransientTileError] = useState(false);

  // Refs pour garder les callbacks/valeurs à jour sans relancer l'init.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const hoveredIdRef = useRef(hoveredId);
  hoveredIdRef.current = hoveredId;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const barbersRef = useRef(barbers);
  barbersRef.current = barbers;
  const statusRef = useRef(status);
  statusRef.current = status;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const paddingRef = useRef(padding);
  paddingRef.current = padding;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const tRef = useRef(t);
  tRef.current = t;
  const onLocateRef = useRef(onLocate);
  onLocateRef.current = onLocate;
  const locateControlRef = useRef<LocateControl | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Regroupement (plan §2.6.9) : recalculé après chaque déplacement et chaque
  // mise à jour des épingles. Les épingles réunies sont masquées (donc hors de
  // l'ordre de tabulation) ; le cercle les remplace.
  const reclusterRef = useRef<() => void>(() => {});
  reclusterRef.current = () => {
    const map = mapRef.current;
    if (!map) return;
    for (const cluster of clustersRef.current) cluster.remove();
    clustersRef.current = [];
    const bounds = map.getBounds();
    const visible = barbersRef.current.filter((b) =>
      bounds.contains([b.longitude, b.latitude]),
    );
    const groups = groupPins(
      visible.map((b) => {
        const point = map.project([b.longitude, b.latitude]);
        return { id: b.id, x: point.x, y: point.y };
      }),
      { keepAlone: selectedIdRef.current },
    );
    const hidden = new Set<string>();
    for (const group of groups) {
      if (group.kind !== "cluster") continue;
      group.ids.forEach((id) => hidden.add(id));
      const members = barbersRef.current.filter((b) => group.ids.includes(b.id));
      const element = createClusterElement(group.ids.length, tRef.current);
      element.addEventListener("click", () => {
        const area = new maplibregl.LngLatBounds();
        for (const b of members) area.extend([b.longitude, b.latitude]);
        map.fitBounds(area, {
          padding: safePadding(map, paddingRef.current),
          duration: reducedMotionRef.current ? 0 : 500,
          maxZoom: 16,
        });
      });
      clustersRef.current.push(
        new maplibregl.Marker({ element })
          .setLngLat(map.unproject([group.x, group.y]))
          .addTo(map),
      );
    }
    for (const [id, entry] of markersRef.current) {
      entry.element.style.display = hidden.has(id) ? "none" : "";
    }
  };
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
    const locateControl = new LocateControl(() => onLocateRef.current?.());
    map.addControl(locateControl, "top-right");
    locateControlRef.current = locateControl;

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
    map.on("moveend", () => reclusterRef.current());

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

    // Zone visible (issue #50) : uniquement après un geste du visiteur
    // (glisser, zoomer, boutons +/−), reconnu à `originalEvent`. Les
    // recadrages automatiques n'en ont pas et ne relancent pas la recherche.
    let viewportTimer: number | undefined;
    map.on("moveend", (event) => {
      if (!("originalEvent" in event) || !event.originalEvent) return;
      if (viewportTimer !== undefined) window.clearTimeout(viewportTimer);
      viewportTimer = window.setTimeout(() => {
        const bounds = map.getBounds();
        onViewportChangeRef.current?.({
          minLat: bounds.getSouth(),
          maxLat: bounds.getNorth(),
          minLng: bounds.getWest(),
          maxLng: bounds.getEast(),
        });
      }, VIEWPORT_DEBOUNCE_MS);
    });

    // Redimensionnement correct (notamment à l'ouverture de la vue Carte mobile).
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);

    return () => {
      clearTimers();
      if (viewportTimer !== undefined) window.clearTimeout(viewportTimer);
      observer.disconnect();
      markers.clear();
      clustersRef.current = [];
      userMarkerRef.current = null;
      locateControlRef.current = null;
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
        const element = createMarkerElement(barber, selected, t);
        element.addEventListener("click", () =>
          onSelectRef.current(barber.id),
        );
        element.addEventListener("mouseenter", () =>
          onHoverRef.current?.(barber.id),
        );
        element.addEventListener("mouseleave", () =>
          onHoverRef.current?.(null),
        );
        element.classList.toggle("fb-price-pin--hovered", barber.id === hoveredIdRef.current);
        const marker = new maplibregl.Marker({ element, anchor: "bottom" })
          .setLngLat([barber.longitude, barber.latitude])
          .addTo(map);
        entry = { marker, element };
        markersRef.current.set(barber.id, entry);
      } else {
        entry.marker.setLngLat([barber.longitude, barber.latitude]);
        updateMarkerElement(entry.element, barber, selected, t);
        entry.element.classList.toggle("fb-price-pin--hovered", barber.id === hoveredIdRef.current);
      }
    }
    if (status === "ready") reclusterRef.current();

    if (status === "ready") {
      const signature = resultsSignature(barbers);
      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        if (autoFit) {
          fitToResults(map, barbers, reducedMotionRef.current, paddingRef.current);
        }
      }
    }
  }, [barbers, status, selectedId, autoFit, t]);

  // --- Survol bidirectionnel liste <-> carte (sans recadrage ni reclustering) ---
  useEffect(() => {
    for (const [id, entry] of markersRef.current) {
      entry.element.classList.toggle("fb-price-pin--hovered", id === hoveredId);
    }
  }, [hoveredId, status]);

  // --- La sélection (clic liste) amène le marqueur dans la vue, sans recentrage global ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId || statusRef.current !== "ready") return;
    const barber = barbersRef.current.find((b) => b.id === selectedId);
    if (!barber) return;
    map.easeTo({
      center: [barber.longitude, barber.latitude],
      padding: safePadding(map, paddingRef.current),
      duration: reducedMotionRef.current ? 0 : 500,
      essential: true,
    });
  }, [selectedId]);

  // --- Bouton « Ma position » : libellé, état d'attente, repère et recentrage ---
  useEffect(() => {
    locateControlRef.current?.update(
      t("map.locate.label"),
      locateStatus === "pending",
    );
  }, [t, locateStatus, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status === "error" || status === "unconfigured") return;
    if (!userPosition) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    const lngLat: [number, number] = [userPosition.longitude, userPosition.latitude];
    if (!userMarkerRef.current) {
      userMarkerRef.current = new maplibregl.Marker({ element: createUserElement() })
        .setLngLat(lngLat)
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(lngLat);
    }
  }, [userPosition, status]);

  // Recentrage à chaque appui (le compteur change), sans relancer la recherche
  // de zone : un déplacement programmatique n'a pas d'`originalEvent`. Un appui
  // pendant le chargement de la carte est tenu en attente jusqu'à `ready`.
  const userPositionRef = useRef(userPosition);
  userPositionRef.current = userPosition;
  const handledRecenterRef = useRef(0);
  useEffect(() => {
    const map = mapRef.current;
    const target = userPositionRef.current;
    if (recenterCount === handledRecenterRef.current) return;
    if (!map || !target || status !== "ready") return;
    handledRecenterRef.current = recenterCount;
    map.easeTo({
      center: [target.longitude, target.latitude],
      zoom: Math.max(map.getZoom(), LOCATE_ZOOM),
      padding: safePadding(map, paddingRef.current),
      duration: reducedMotionRef.current ? 0 : 600,
      essential: true,
    });
  }, [recenterCount, status]);

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
            {t("map.loading")}
          </p>
        </div>
      )}

      {status === "unconfigured" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface p-6 text-center">
          {import.meta.env.DEV ? (
            // Développement (serveur Vite) : instructions techniques pour la clé.
            <>
              <p className="text-sm font-medium text-foreground">
                {t("map.unconfigured.devTitle")}
              </p>
              <p className="max-w-xs text-xs text-foreground-muted">
                <Trans
                  t={t}
                  ns="client"
                  i18nKey="map.unconfigured.devHelp"
                  components={{ code: <code /> }}
                />
              </p>
            </>
          ) : (
            // Production : message utilisateur neutre, sans détail technique.
            <p className="max-w-xs text-sm text-foreground">
              {t("map.unconfigured.message")}
            </p>
          )}
          <button
            type="button"
            onClick={onShowList}
            className="mt-1 inline-flex min-h-[44px] items-center rounded-lg border border-accent px-3 text-sm text-accent-strong lg:hidden"
          >
            {t("map.backToList")}
          </button>
        </div>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface p-6 text-center"
        >
          <p className="text-sm font-medium text-foreground">
            {t("map.error.title")}
          </p>
          <p className="max-w-xs text-xs text-foreground-muted">
            {t("map.error.listStillWorks")}
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-accent px-3 text-sm text-accent-strong"
            >
              {t("map.error.retry")}
            </button>
            <button
              type="button"
              onClick={onShowList}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-border px-3 text-sm text-foreground-muted lg:hidden"
            >
              {t("map.backToList")}
            </button>
          </div>
        </div>
      )}

      {status === "ready" && transientTileError && (
        <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] text-foreground-muted">
          {t("map.tileError")}
        </p>
      )}
    </div>
  );
}
