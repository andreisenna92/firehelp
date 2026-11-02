import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SAQUAREMA_CENTER, statusColor, type FireStatus } from "@/lib/firehelp";

export type MapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  status: FireStatus;
};

export type FireMapProps = {
  points?: MapPoint[];
  center?: [number, number];
  zoom?: number;
  picked?: { lat: number; lng: number } | null;
  onPick?: (coords: { lat: number; lng: number }) => void;
  renderPopup?: (id: string) => React.ReactNode;
};

declare global {
  interface Window {
    __firehelpInitMap?: () => void;
  }
}

let mapsLoader: Promise<typeof google.maps> | null = null;

function loadGoogleMaps(): Promise<typeof google.maps> {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    if (!key) {
      reject(new Error("Chave do Google Maps não configurada."));
      return;
    }
    window.__firehelpInitMap = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("Google Maps não inicializou."));
    };
    const script = document.createElement("script");
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__firehelpInitMap` +
      `&language=pt-BR&region=BR${channel ? `&channel=${channel}` : ""}`;
    script.async = true;
    script.onerror = () => reject(new Error("Não foi possível carregar o Google Maps."));
    document.head.appendChild(script);
  });
  return mapsLoader;
}

function cssColor(variable: string, fallback: string): string {
  const probe = document.createElement("span");
  probe.style.color = variable;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || fallback;
}

function markerIcon(status: FireStatus, maps: typeof google.maps): google.maps.Symbol {
  const scale = status === "active" ? 10 : status === "pending" ? 8 : 7;
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: cssColor(statusColor(status), "#D95D27"),
    fillOpacity: 1,
    strokeColor: cssColor("var(--marker-border)", "#FFF9F2"),
    strokeWeight: 2.5,
    scale,
  };
}

export default function FireMapImpl({
  points = [],
  center = SAQUAREMA_CENTER,
  zoom = 11,
  picked = null,
  onPick,
  renderPopup,
}: FireMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [loadError, setLoadError] = useState(false);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const popupRootRef = useRef<Root | null>(null);
  const renderPopupRef = useRef(renderPopup);
  renderPopupRef.current = renderPopup;

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const instance = new maps.Map(containerRef.current, {
          center: { lat: center[0], lng: center[1] },
          zoom,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        setMap(instance);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map) return;
    map.setCenter({ lat: center[0], lng: center[1] });
    map.setZoom(zoom);
  }, [map, center[0], center[1], zoom]);

  useEffect(() => {
    if (!map || !onPick) return;
    const listener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
      if (event.latLng) onPick({ lat: event.latLng.lat(), lng: event.latLng.lng() });
    });
    return () => listener.remove();
  }, [map, onPick]);

  useEffect(() => {
    if (!map) return;
    const maps = window.google.maps;
    const seen = new Set<string>();
    for (const point of points) {
      seen.add(point.id);
      const existing = markersRef.current.get(point.id);
      if (existing) {
        existing.setPosition({ lat: point.latitude, lng: point.longitude });
        existing.setIcon(markerIcon(point.status, maps));
        continue;
      }
      const marker = new maps.Marker({
        map,
        position: { lat: point.latitude, lng: point.longitude },
        icon: markerIcon(point.status, maps),
      });
      if (renderPopupRef.current) {
        marker.addListener("click", () => {
          const content = renderPopupRef.current?.(point.id);
          if (!content) return;
          if (!infoRef.current) infoRef.current = new maps.InfoWindow();
          const node = document.createElement("div");
          infoRef.current.setContent(node);
          infoRef.current.open({ map, anchor: marker });
          popupRootRef.current?.unmount();
          popupRootRef.current = createRoot(node);
          popupRootRef.current.render(content);
        });
      }
      markersRef.current.set(point.id, marker);
    }
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    }
  }, [map, points]);

  useEffect(() => {
    if (!map) return;
    const maps = window.google.maps;
    let pickedMarker: google.maps.Marker | null = null;
    if (picked) {
      pickedMarker = new maps.Marker({
        map,
        position: { lat: picked.lat, lng: picked.lng },
        icon: {
          path: maps.SymbolPath.CIRCLE,
          fillColor: cssColor("var(--alert)", "#C83E36"),
          fillOpacity: 1,
          strokeColor: cssColor("var(--marker-border)", "#FFF9F2"),
          strokeWeight: 3,
          scale: 11,
        },
      });
    }
    return () => pickedMarker?.setMap(null);
  }, [map, picked]);

  useEffect(() => {
    return () => {
      popupRootRef.current?.unmount();
      infoRef.current?.close();
      for (const marker of markersRef.current.values()) marker.setMap(null);
      markersRef.current.clear();
    };
  }, []);

  if (loadError) {
    return (
      <div className="grid size-full place-items-center bg-muted p-6 text-center text-sm text-muted-foreground">
        Não foi possível carregar o mapa agora. Tente novamente em instantes.
      </div>
    );
  }

  return <div ref={containerRef} className="size-full" role="application" aria-label="Mapa de ocorrências" />;
}
