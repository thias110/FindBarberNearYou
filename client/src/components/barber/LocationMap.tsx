import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// Worker bundlé par Vite (voir BarbersMap) : compatible CSP `worker-src 'self'`.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { getMapSettings, MAP_ATTRIBUTION } from "../../lib/mapConfig";

maplibregl.setWorkerUrl(maplibreWorkerUrl);

export interface MapPosition {
  latitude: number;
  longitude: number;
}

interface LocationMapProps {
  position: MapPosition | null;
  /** Clic sur la carte : nouvelle position choisie par le barber. */
  onPick: (position: MapPosition) => void;
  theme: "light" | "dark";
  /** Carte indisponible (pas de clé, WebGL absent, panne) : repli géré par le parent. */
  onUnavailable: () => void;
}

// Vue par défaut sans position : la Suisse romande (marché de lancement).
const DEFAULT_CENTER: [number, number] = [6.6, 46.5];
const LOAD_TIMEOUT_MS = 12000;

function createPinElement(): HTMLDivElement {
  // Marqueur décoratif (le choix au clavier passe par la recherche d'adresse).
  const element = document.createElement("div");
  element.className = "fb-map-marker fb-map-marker--selected";
  element.setAttribute("aria-hidden", "true");
  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("viewBox", "0 0 32 44");
  const pin = document.createElementNS(svgNs, "path");
  pin.setAttribute("class", "fb-map-marker__pin");
  pin.setAttribute(
    "d",
    "M16 0C7.2 0 0 7.2 0 16c0 11 16 28 16 28s16-17 16-28C32 7.2 24.8 0 16 0z",
  );
  const dot = document.createElementNS(svgNs, "circle");
  dot.setAttribute("class", "fb-map-marker__dot");
  dot.setAttribute("cx", "16");
  dot.setAttribute("cy", "16");
  dot.setAttribute("r", "5");
  svg.append(pin, dot);
  element.appendChild(svg);
  return element;
}

/**
 * Carte de prévisualisation de la position du profil (issue #45) : affiche le
 * point choisi et permet d'en choisir un autre d'un clic. Position privée et
 * exacte (vue du propriétaire) ; le public ne voit qu'une position arrondie.
 */
export default function LocationMap({
  position,
  onPick,
  theme,
  onUnavailable,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;
  const initialPosition = useRef(position);
  const themeRef = useRef(theme);

  useEffect(() => {
    const settings = getMapSettings(themeRef.current);
    const container = containerRef.current;
    if (!settings.configured || !settings.styleUrl || !container) {
      onUnavailableRef.current();
      return;
    }
    let map: maplibregl.Map;
    try {
      const start = initialPosition.current;
      map = new maplibregl.Map({
        container,
        style: settings.styleUrl,
        center: start ? [start.longitude, start.latitude] : DEFAULT_CENTER,
        zoom: start ? 14 : 7,
        attributionControl: false,
      });
    } catch {
      onUnavailableRef.current();
      return;
    }
    mapRef.current = map;
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: MAP_ATTRIBUTION }),
      "bottom-right",
    );
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    let loaded = false;
    const watchdog = window.setTimeout(() => {
      if (!loaded) onUnavailableRef.current();
    }, LOAD_TIMEOUT_MS);
    map.on("load", () => {
      loaded = true;
      window.clearTimeout(watchdog);
      setReady(true);
    });
    map.on("click", (event) => {
      onPickRef.current({
        latitude: Number(event.lngLat.lat.toFixed(6)),
        longitude: Number(event.lngLat.lng.toFixed(6)),
      });
    });

    return () => {
      window.clearTimeout(watchdog);
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Marqueur et cadrage suivent la position choisie (adresse ou clic).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!position) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const lngLat: [number, number] = [position.longitude, position.latitude];
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ element: createPinElement(), anchor: "bottom" })
        .setLngLat(lngLat)
        .addTo(map);
    } else {
      markerRef.current.setLngLat(lngLat);
    }
    if (!map.getBounds().contains(lngLat)) {
      map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 13) });
    }
  }, [position, ready]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Carte de prévisualisation : cliquez pour placer votre position"
      className="h-64 w-full overflow-hidden rounded-xl border border-border"
    />
  );
}
