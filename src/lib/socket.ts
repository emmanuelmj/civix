"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { PulseEvent, SwarmLogEntry, IntakeFeedItem } from "./types";
import { generatePulseEvent, generateSwarmLog, generateIntakeItem } from "./mock-data";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/dashboard";
const MAX_ITEMS = 50;
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 8000;
const RECONNECT_MAX_ATTEMPTS = 5;
const CONNECT_TIMEOUT = 3000;

// ── Backend payload mappers ────────────────────────────────────────

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

// ── Types ──────────────────────────────────────────────────────────

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "mock";

interface UsePulseStreamReturn {
  events: PulseEvent[];
  logs: SwarmLogEntry[];
  intake: IntakeFeedItem[];
  status: ConnectionStatus;
}

// ── WebSocket message protocol ─────────────────────────────────────
// Backend sends JSON with { type: "pulse_update" | "intake_update" | "swarm_log" | "event_status", data: {...} }

interface WSMessage {
  type: "pulse_update" | "intake_update" | "swarm_log" | "event_status";
  data: Record<string, unknown>;
}

// ── Hook ───────────────────────────────────────────────────────────

export function usePulseStream(): UsePulseStreamReturn {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [logs, setLogs] = useState<SwarmLogEntry[]>([]);
  const [intake, setIntake] = useState<IntakeFeedItem[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  const wsRef = useRef<WebSocket | null>(null);
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // ── Mock data fallback ─────────────────────────────────────────

  const startMockMode = useCallback(() => {
    if (mockIntervalRef.current) return;
    setStatus("mock");

    const seed = Array.from({ length: 6 }, () => generatePulseEvent());
    const seedLogs = seed.flatMap((e) => [generateSwarmLog(e), generateSwarmLog(e)]);
    const seedIntake = Array.from({ length: 4 }, () => generateIntakeItem());
    setEvents(seed);
    setLogs(seedLogs);
    setIntake(seedIntake);

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

  // ── Message handler ────────────────────────────────────────────

  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case "pulse_update": {
        const evt = mapBackendEvent(msg.data);
        setEvents((prev) => [evt, ...prev].slice(0, MAX_ITEMS));
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
        break;
      }
      case "intake_update":
        setIntake((prev) => [mapBackendIntake(msg.data), ...prev].slice(0, MAX_ITEMS));
        break;
      case "swarm_log":
        setLogs((prev) => [mapBackendLog(msg.data), ...prev].slice(0, MAX_ITEMS));
        break;
      case "event_status": {
        const { event_id, status: newStatus } = msg.data as { event_id: string; status: PulseEvent["status"] };
        setEvents((prev) =>
          prev.map((e) => (e.event_id === event_id ? { ...e, status: newStatus } : e))
        );
        break;
      }
    }
  }, []);

  // ── WebSocket connect with exponential backoff ─────────────────

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    const isReconnect = reconnectAttemptRef.current > 0;
    setStatus(isReconnect ? "reconnecting" : "connecting");

    let didOpen = false;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    const connectTimeout = setTimeout(() => {
      if (!didOpen) {
        ws.close();
      }
    }, CONNECT_TIMEOUT);

    ws.onopen = () => {
      didOpen = true;
      clearTimeout(connectTimeout);
      if (!mountedRef.current) { ws.close(); return; }
      reconnectAttemptRef.current = 0;
      stopMock();
      setStatus("connected");
      // Clear old data when switching from mock to live
      setEvents([]);
      setLogs([]);
      setIntake([]);
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WSMessage;
        if (parsed.type && parsed.data) {
          handleMessage(parsed);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      clearTimeout(connectTimeout);
      wsRef.current = null;
      if (!mountedRef.current) return;

      if (reconnectAttemptRef.current < RECONNECT_MAX_ATTEMPTS) {
        const delay = Math.min(
          RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptRef.current),
          RECONNECT_MAX_DELAY
        );
        reconnectAttemptRef.current++;
        setStatus("reconnecting");
        reconnectTimerRef.current = setTimeout(connect, delay);
      } else {
        startMockMode();
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror — reconnect logic handled there
    };
  }, [handleMessage, startMockMode, stopMock]);

  // ── Lifecycle ──────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    connect();

    // Fallback: if still not connected after timeout, start mock
    const fallback = setTimeout(() => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        startMockMode();
      }
    }, CONNECT_TIMEOUT + 500);

    return () => {
      mountedRef.current = false;
      clearTimeout(fallback);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      stopMock();
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, startMockMode, stopMock]);

  return { events, logs, intake, status };
}
