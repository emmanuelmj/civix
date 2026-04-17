"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { PulseEvent, SwarmLogEntry, IntakeFeedItem } from "./types";
import { generatePulseEvent, generateSwarmLog, generateIntakeItem } from "./mock-data";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const MAX_ITEMS = 50;

// Map backend pulse_update payload → our PulseEvent
function mapBackendEvent(raw: Record<string, unknown>): PulseEvent {
  const coords = raw.coordinates as { lat: number; lng: number } | undefined;
  const officer = raw.assigned_officer as {
    officer_id: string;
    current_lat: number;
    current_lng: number;
  } | undefined;

  const severityColor = (raw.severity_color as string) || "#ca8a04";
  let severity: PulseEvent["severity"] = "standard";
  if (severityColor.toLowerCase().includes("dc2626") || severityColor.toLowerCase() === "#ff0000") {
    severity = raw.severity === "high" ? "high" : "critical";
  } else if (raw.severity) {
    severity = raw.severity as PulseEvent["severity"];
  }

  return {
    event_id: (raw.event_id as string) || crypto.randomUUID(),
    status: (raw.status as PulseEvent["status"]) || "NEW",
    coordinates: coords || { lat: 17.385, lng: 78.4867 },
    severity_color: severityColor,
    severity,
    domain: (raw.domain as PulseEvent["domain"]) || "Municipal",
    summary: (raw.summary as string) || (raw.log_message as string) || "New event",
    assigned_officer: officer,
    log_message: (raw.log_message as string) || "",
    timestamp: (raw.timestamp as number) || Date.now(),
    thumbnail: raw.thumbnail as string | undefined,
    original_text: raw.original_text as string | undefined,
  };
}

function mapBackendIntake(raw: Record<string, unknown>): IntakeFeedItem {
  return {
    id: (raw.id as string) || crypto.randomUUID(),
    channel: (raw.channel as IntakeFeedItem["channel"]) || "portal",
    original_text: (raw.original_text as string) || "",
    translated_text: (raw.translated_text as string) || (raw.original_text as string) || "",
    thumbnail: raw.thumbnail as string | undefined,
    timestamp: (raw.timestamp as number) || Date.now(),
    coordinates: raw.coordinates as { lat: number; lng: number } | undefined,
  };
}

function mapBackendLog(raw: Record<string, unknown>): SwarmLogEntry {
  return {
    id: (raw.id as string) || crypto.randomUUID(),
    type: (raw.type as SwarmLogEntry["type"]) || "system",
    message: (raw.message as string) || (raw.log_message as string) || "",
    timestamp: (raw.timestamp as number) || Date.now(),
    event_id: raw.event_id as string | undefined,
  };
}

export type ConnectionStatus = "connecting" | "connected" | "mock";

interface UsePulseStreamReturn {
  events: PulseEvent[];
  logs: SwarmLogEntry[];
  intake: IntakeFeedItem[];
  status: ConnectionStatus;
}

export function usePulseStream(): UsePulseStreamReturn {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [logs, setLogs] = useState<SwarmLogEntry[]>([]);
  const [intake, setIntake] = useState<IntakeFeedItem[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const socketRef = useRef<Socket | null>(null);
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startMockMode = useCallback(() => {
    if (mockIntervalRef.current) return; // already running
    setStatus("mock");

    // Seed
    const seed = Array.from({ length: 6 }, () => generatePulseEvent());
    const seedLogs = seed.flatMap((e) => [generateSwarmLog(e), generateSwarmLog(e)]);
    const seedIntake = Array.from({ length: 4 }, () => generateIntakeItem());
    setEvents(seed);
    setLogs(seedLogs);
    setIntake(seedIntake);

    // Stream mock data
    mockIntervalRef.current = setInterval(() => {
      const roll = Math.random();
      if (roll < 0.4) {
        const evt = generatePulseEvent();
        setEvents((prev) => [evt, ...prev].slice(0, MAX_ITEMS));
        setLogs((prev) => [generateSwarmLog(evt), ...prev].slice(0, MAX_ITEMS));
      } else if (roll < 0.7) {
        setIntake((prev) => [generateIntakeItem(), ...prev].slice(0, MAX_ITEMS));
      } else {
        setLogs((prev) => [generateSwarmLog(), ...prev].slice(0, MAX_ITEMS));
      }

      // Occasional resolution
      if (Math.random() < 0.1) {
        setEvents((prev) => {
          const copy = [...prev];
          const idx = copy.findIndex((e) => e.status !== "RESOLVED");
          if (idx >= 0) {
            copy[idx] = { ...copy[idx], status: "RESOLVED" };
            setLogs((p) => [
              {
                id: `res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                type: "verification" as const,
                message: `Task closed. ${copy[idx].summary} — resolved.`,
                timestamp: Date.now(),
                event_id: copy[idx].event_id,
              },
              ...p,
            ].slice(0, MAX_ITEMS));
          }
          return copy;
        });
      }
    }, 2500);
  }, []);

  const stopMock = useCallback(() => {
    if (mockIntervalRef.current) {
      clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    setStatus("connecting");

    const socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      timeout: 4000,
      reconnectionAttempts: 2,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      stopMock();
      setStatus("connected");
    });

    // Primary event stream from backend
    socket.on("pulse_update", (data: Record<string, unknown>) => {
      const evt = mapBackendEvent(data);
      setEvents((prev) => [evt, ...prev].slice(0, MAX_ITEMS));

      // Auto-generate swarm log from backend event
      if (evt.log_message) {
        const logType: SwarmLogEntry["type"] =
          evt.status === "DISPATCHED" ? "dispatch" : evt.status === "RESOLVED" ? "verification" : "analysis";
        setLogs((prev) => [
          {
            id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            type: logType,
            message: evt.log_message,
            timestamp: evt.timestamp,
            event_id: evt.event_id,
          },
          ...prev,
        ].slice(0, MAX_ITEMS));
      }
    });

    // Optional: separate intake feed from backend
    socket.on("intake_update", (data: Record<string, unknown>) => {
      setIntake((prev) => [mapBackendIntake(data), ...prev].slice(0, MAX_ITEMS));
    });

    // Optional: separate swarm log from backend
    socket.on("swarm_log", (data: Record<string, unknown>) => {
      setLogs((prev) => [mapBackendLog(data), ...prev].slice(0, MAX_ITEMS));
    });

    // Optional: event status update (e.g., resolution)
    socket.on("event_status", (data: { event_id: string; status: PulseEvent["status"] }) => {
      setEvents((prev) =>
        prev.map((e) => (e.event_id === data.event_id ? { ...e, status: data.status } : e))
      );
    });

    socket.on("connect_error", () => {
      startMockMode();
    });

    socket.on("disconnect", () => {
      startMockMode();
    });

    // If no connection within 3s, fall back to mock
    const fallbackTimer = setTimeout(() => {
      if (!socket.connected) startMockMode();
    }, 3000);

    return () => {
      clearTimeout(fallbackTimer);
      stopMock();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [startMockMode, stopMock]);

  return { events, logs, intake, status };
}
