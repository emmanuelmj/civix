"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PulseEvent } from "@/lib/types";

const HYDERABAD: [number, number] = [78.4867, 17.385]; // [lng, lat] for MapLibre

// CartoDB Positron via raster source in a MapLibre style — free, no API key
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "carto-positron": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "carto-positron-layer",
      type: "raster",
      source: "carto-positron",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
  // Ensure type-compatibility
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
};

type MapLibreType = typeof import("maplibre-gl");

interface MapLayerProps {
  events: PulseEvent[];
  onEventClick?: (event: PulseEvent) => void;
}

export function MapLayer({ events, onEventClick }: MapLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mlRef = useRef<MapLibreType | null>(null);
  const readyRef = useRef(false);
  const eventsRef = useRef<PulseEvent[]>(events);
  eventsRef.current = events;
  const onEventClickRef = useRef(onEventClick);
  onEventClickRef.current = onEventClick;
  const pulseRef = useRef<number | null>(null);

  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml || !readyRef.current) return;

    const currentEvents = eventsRef.current;

    // Build GeoJSON for event dots
    const eventFeatures: GeoJSON.Feature[] = currentEvents.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.coordinates.lng, e.coordinates.lat] },
      properties: {
        id: e.event_id,
        severity: e.severity,
        color: e.severity_color,
        summary: e.summary,
        domain: e.domain,
        status: e.status,
        officer: e.assigned_officer?.officer_id ?? "",
        cluster_found: e.cluster_found ?? false,
        cluster_size: e.cluster_size ?? 0,
        citizen_name: e.citizen_name ?? "",
        panic_flag: e.panic_flag ?? false,
        sentiment_score: e.sentiment_score ?? null,
      },
    }));

    // Build GeoJSON for officer blips
    const officerFeatures: GeoJSON.Feature[] = currentEvents
      .filter((e) => e.assigned_officer)
      .map((e) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [e.assigned_officer!.current_lng, e.assigned_officer!.current_lat],
        },
        properties: { id: e.event_id, officer_id: e.assigned_officer!.officer_id },
      }));

    // Build GeoJSON for dispatch lines
    const lineFeatures: GeoJSON.Feature[] = currentEvents
      .filter((e) => e.assigned_officer)
      .map((e) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [e.assigned_officer!.current_lng, e.assigned_officer!.current_lat],
            [e.coordinates.lng, e.coordinates.lat],
          ],
        },
        properties: { id: e.event_id },
      }));

    // Build GeoJSON for cluster ring overlay
    const clusterFeatures: GeoJSON.Feature[] = currentEvents
      .filter((e) => e.cluster_found)
      .map((e) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [e.coordinates.lng, e.coordinates.lat] },
        properties: {
          id: e.event_id,
          cluster_id: e.cluster_id ?? "",
          cluster_size: e.cluster_size ?? 1,
        },
      }));

    // Build GeoJSON for heatmap (all events, weighted by severity)
    const heatFeatures: GeoJSON.Feature[] = currentEvents.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.coordinates.lng, e.coordinates.lat] },
      properties: {
        weight: e.severity === "critical" ? 1.0 : e.severity === "high" ? 0.6 : 0.3,
      },
    }));

    const eventGeoJSON: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: eventFeatures };
    const officerGeoJSON: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: officerFeatures };
    const lineGeoJSON: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: lineFeatures };
    const clusterGeoJSON: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: clusterFeatures };
    const heatGeoJSON: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: heatFeatures };

    // ── Heatmap source & layer (below everything) ──
    const heatSrc = map.getSource("heatmap") as maplibregl.GeoJSONSource | undefined;
    if (heatSrc) {
      heatSrc.setData(heatGeoJSON);
    } else {
      map.addSource("heatmap", { type: "geojson", data: heatGeoJSON });
      map.addLayer({
        id: "heatmap-layer",
        type: "heatmap",
        source: "heatmap",
        paint: {
          "heatmap-weight": ["get", "weight"],
          "heatmap-intensity": 1,
          "heatmap-radius": 28,
          "heatmap-opacity": 0.3,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0,   "rgba(0,0,0,0)",
            0.2, "rgba(34,197,94,0.4)",
            0.4, "rgba(234,179,8,0.5)",
            0.6, "rgba(249,115,22,0.6)",
            1,   "rgba(239,68,68,0.8)",
          ],
        },
      });
    }

    // ── Event source & layers ──
    const eventSrc = map.getSource("events") as maplibregl.GeoJSONSource | undefined;
    if (eventSrc) {
      eventSrc.setData(eventGeoJSON);
    } else {
      map.addSource("events", { type: "geojson", data: eventGeoJSON });
      map.addLayer({
        id: "events-circle",
        type: "circle",
        source: "events",
        paint: {
          "circle-radius": ["match", ["get", "severity"], "critical", 9, "high", 7, 5],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.7,
          "circle-stroke-width": 2,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-opacity": 0.4,
        },
      });
      // Pulsing halo for critical events
      map.addLayer({
        id: "events-critical-halo",
        type: "circle",
        source: "events",
        filter: ["==", ["get", "severity"], "critical"],
        paint: {
          "circle-radius": 16,
          "circle-color": "#dc2626",
          "circle-opacity": 0.12,
        },
      });
    }

    // ── Cluster ring source & layer ──
    const clusterSrc = map.getSource("cluster-rings") as maplibregl.GeoJSONSource | undefined;
    if (clusterSrc) {
      clusterSrc.setData(clusterGeoJSON);
    } else {
      map.addSource("cluster-rings", { type: "geojson", data: clusterGeoJSON });
      map.addLayer(
        {
          id: "cluster-ring-layer",
          type: "circle",
          source: "cluster-rings",
          paint: {
            "circle-radius": 22,
            "circle-color": "transparent",
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#a855f7",
            "circle-stroke-opacity": 0.6,
          },
        },
        "events-circle" // render below event dots
      );
      map.addLayer(
        {
          id: "cluster-ring-fill",
          type: "circle",
          source: "cluster-rings",
          paint: {
            "circle-radius": 22,
            "circle-color": "#a855f7",
            "circle-opacity": 0.08,
          },
        },
        "cluster-ring-layer" // below the ring stroke
      );

      // Pulse animation for cluster rings
      let opacity = 0.08;
      let rising = true;
      const animate = () => {
        if (!mapRef.current || !readyRef.current) return;
        opacity += rising ? 0.004 : -0.004;
        if (opacity >= 0.18) rising = false;
        if (opacity <= 0.04) rising = true;
        try {
          map.setPaintProperty("cluster-ring-fill", "circle-opacity", opacity);
          map.setPaintProperty("cluster-ring-layer", "circle-stroke-opacity", 0.3 + opacity * 2);
        } catch { /* layer may be removed */ }
        pulseRef.current = requestAnimationFrame(animate);
      };
      if (pulseRef.current) cancelAnimationFrame(pulseRef.current);
      pulseRef.current = requestAnimationFrame(animate);
    }

    const officerSrc = map.getSource("officers") as maplibregl.GeoJSONSource | undefined;
    if (officerSrc) {
      officerSrc.setData(officerGeoJSON);
    } else {
      map.addSource("officers", { type: "geojson", data: officerGeoJSON });
      map.addLayer({
        id: "officers-circle",
        type: "circle",
        source: "officers",
        paint: {
          "circle-radius": 5,
          "circle-color": "#2563eb",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#dbeafe",
          "circle-opacity": 0.9,
        },
      });
    }

    const lineSrc = map.getSource("dispatch-lines") as maplibregl.GeoJSONSource | undefined;
    if (lineSrc) {
      lineSrc.setData(lineGeoJSON);
    } else {
      map.addSource("dispatch-lines", { type: "geojson", data: lineGeoJSON });
      map.addLayer(
        {
          id: "dispatch-lines-layer",
          type: "line",
          source: "dispatch-lines",
          paint: {
            "line-color": "#2563eb",
            "line-width": 1.5,
            "line-opacity": 0.35,
            "line-dasharray": [4, 6],
          },
        },
        "events-circle" // below event dots
      );
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      mlRef.current = ml;

      const map = new ml.Map({
        container: containerRef.current,
        style: MAP_STYLE as maplibregl.StyleSpecification,
        center: HYDERABAD,
        zoom: 12,
        attributionControl: false,
        fadeDuration: 0,
      });

      map.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new ml.AttributionControl({ compact: true }), "bottom-left");

      map.on("load", () => {
        if (cancelled) return;
        readyRef.current = true;
        syncMarkers();
      });

      // Enhanced click popup for events
      map.on("click", "events-circle", (e) => {
        if (!e.features?.[0]) return;
        const props = e.features[0].properties;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];

        // Fire onEventClick callback
        const matchedEvent = eventsRef.current.find((ev) => ev.event_id === props.id);
        if (matchedEvent) onEventClickRef.current?.(matchedEvent);

        const severityColors: Record<string, string> = {
          critical: "#dc2626", high: "#f59e0b", standard: "#22c55e",
        };
        const sevColor = severityColors[props.severity] ?? "#6b7280";
        const clusterBadge = props.cluster_found === true || props.cluster_found === "true"
          ? `<span style="background:#ede9fe;color:#7c3aed;padding:1px 6px;border-radius:9999px;font-size:9px;font-weight:600;">🔗 Cluster of ${props.cluster_size ?? "N"}</span> `
          : "";
        const panicBadge = props.panic_flag === true || props.panic_flag === "true"
          ? `<span style="background:#fef2f2;color:#dc2626;padding:1px 6px;border-radius:9999px;font-size:9px;font-weight:600;">🚨 PANIC</span> `
          : "";
        const impactLine = props.sentiment_score != null
          ? `<div style="color:#71717a;font-size:9px;margin-top:3px;">Impact score: ${Number(props.sentiment_score).toFixed(2)}</div>`
          : "";

        new ml.Popup({ offset: 14, closeButton: false, maxWidth: "260px" })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family:system-ui;font-size:12px;line-height:1.5;">
              <div style="font-weight:600;margin-bottom:4px;color:#1c1c1e;">${props.summary}</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:4px;">
                <span style="background:#f4f4f5;color:#3f3f46;padding:1px 6px;border-radius:9999px;font-size:9px;font-weight:500;">${props.domain}</span>
                <span style="background:${sevColor}15;color:${sevColor};padding:1px 6px;border-radius:9999px;font-size:9px;font-weight:600;text-transform:uppercase;">${props.severity}</span>
                ${clusterBadge}${panicBadge}
              </div>
              ${props.citizen_name ? `<div style="color:#52525b;font-size:10px;">👤 ${props.citizen_name}</div>` : ""}
              ${impactLine}
              ${props.officer ? `<div style="color:#2563eb;font-size:10px;margin-top:3px;">→ ${props.officer}</div>` : ""}
              <div style="margin-top:6px;text-align:right;">
                <span style="color:#a855f7;font-size:10px;font-weight:500;cursor:pointer;">View Details →</span>
              </div>
            </div>`
          )
          .addTo(map);
      });

      map.on("mouseenter", "events-circle", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "events-circle", () => { map.getCanvas().style.cursor = ""; });

      mapRef.current = map;

      const ro = new ResizeObserver(() => map.resize());
      ro.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      if (pulseRef.current) cancelAnimationFrame(pulseRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        readyRef.current = false;
      }
    };
  }, [syncMarkers]);

  // Sync markers on events change
  useEffect(() => {
    syncMarkers();
  }, [events, syncMarkers]);

  return (
    <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--border)" }} />
  );
}
