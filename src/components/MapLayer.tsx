"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { PulseEvent } from "@/lib/types";

// Free public token — replace with your own for production
mapboxgl.accessToken = "MAPBOX_TOKEN_REMOVED";

const HYDERABAD = { lng: 78.4867, lat: 17.385 };

interface MapLayerProps {
  events: PulseEvent[];
}

export function MapLayer({ events }: MapLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const officerMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const linesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [HYDERABAD.lng, HYDERABAD.lat],
      zoom: 12,
      pitch: 30,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeIds = new Set(events.map(e => e.event_id));

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    });
    officerMarkersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) { marker.remove(); officerMarkersRef.current.delete(id); }
    });

    // Remove stale lines
    linesRef.current.forEach((sourceId, eventId) => {
      if (!activeIds.has(eventId)) {
        if (map.getLayer(sourceId)) map.removeLayer(sourceId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        linesRef.current.delete(eventId);
      }
    });

    events.forEach(event => {
      // Pulse event marker
      if (!markersRef.current.has(event.event_id)) {
        const el = document.createElement("div");
        el.style.cssText = `
          width: 14px; height: 14px; border-radius: 50%;
          background: ${event.severity_color};
          box-shadow: 0 0 10px ${event.severity_color}88;
          border: 2px solid ${event.severity_color};
          cursor: pointer;
        `;
        if (event.severity === "critical") {
          el.style.animation = "pulse-ring 1.5s ease-out infinite";
          el.style.width = "18px";
          el.style.height = "18px";
        }
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([event.coordinates.lng, event.coordinates.lat])
          .setPopup(new mapboxgl.Popup({ offset: 15, className: "pulse-popup" })
            .setHTML(`
              <div style="background:#1c2128;color:#e6edf3;padding:8px 12px;border-radius:8px;font-size:12px;max-width:200px;font-family:system-ui;">
                <div style="font-weight:600;margin-bottom:4px;">${event.summary}</div>
                <div style="color:#8b949e;font-size:10px;">${event.domain} · ${event.severity.toUpperCase()}</div>
                ${event.assigned_officer ? `<div style="color:#58a6ff;font-size:10px;margin-top:4px;">→ ${event.assigned_officer.officer_id}</div>` : ""}
              </div>
            `))
          .addTo(map);
        markersRef.current.set(event.event_id, marker);
      }

      // Officer marker + dispatch line
      if (event.assigned_officer) {
        const off = event.assigned_officer;
        if (!officerMarkersRef.current.has(event.event_id)) {
          const el = document.createElement("div");
          el.style.cssText = `
            width: 10px; height: 10px; border-radius: 50%;
            background: #58a6ff; border: 2px solid #1a3a5c;
            box-shadow: 0 0 8px rgba(88,166,255,0.5);
          `;
          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([off.current_lng, off.current_lat])
            .addTo(map);
          officerMarkersRef.current.set(event.event_id, marker);
        }

        // Dispatch line
        const lineId = `line-${event.event_id}`;
        if (!linesRef.current.has(event.event_id) && map.isStyleLoaded()) {
          try {
            map.addSource(lineId, {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [off.current_lng, off.current_lat],
                    [event.coordinates.lng, event.coordinates.lat],
                  ],
                },
              },
            });
            map.addLayer({
              id: lineId,
              type: "line",
              source: lineId,
              paint: {
                "line-color": "#58a6ff",
                "line-width": 1.5,
                "line-opacity": 0.4,
                "line-dasharray": [2, 4],
              },
            });
            linesRef.current.set(event.event_id, lineId);
          } catch {
            // style not ready yet
          }
        }
      }
    });
  }, [events]);

  return (
    <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--border)" }} />
  );
}
