"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface AlertEvent {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  kioskId?: string;
  employeeCode?: string | null;
  timestamp: string;
}

/**
 * Subscribe to the SentinelKiosk real-time alerts WebSocket service.
 * Connects via the gateway with ?XTransformPort=3003. Falls back to REST
 * polling of /recent if the socket can't connect.
 */
export function useAlertsSocket() {
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const pushAlert = useCallback((evt: AlertEvent) => {
    setAlerts((prev) => {
      // dedupe by id
      if (prev.some((a) => a.id === evt.id)) return prev;
      return [evt, ...prev].slice(0, 50);
    });
  }, []);

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // Try WebSocket first
    const socket = io("/?XTransformPort=3003", {
      path: "/sk-alerts/",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("reconnect_attempt", () => setConnected(false));

    // Backfill recent alerts on connect
    socket.on("recent", (data: { alerts: AlertEvent[] }) => {
      if (data?.alerts?.length) {
        setAlerts((prev) => {
          const existing = new Set(prev.map((a) => a.id));
          const fresh = data.alerts.filter((a) => !existing.has(a.id));
          return [...fresh, ...prev].slice(0, 50);
        });
      }
    });

    // Live alert
    socket.on("alert", (evt: AlertEvent) => {
      pushAlert(evt);
    });

    // Fallback REST polling (in case socket fails behind strict networks)
    const poll = async () => {
      try {
        const res = await fetch("/recent?XTransformPort=3003", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data?.alerts?.length) {
            setAlerts((prev) => {
              const existing = new Set(prev.map((a) => a.id));
              const fresh = data.alerts.filter((a: AlertEvent) => !existing.has(a.id));
              return [...fresh, ...prev].slice(0, 50);
            });
          }
          setConnected(true);
        }
      } catch {
        // ignore
      }
    };
    poll();
    pollTimer = setInterval(poll, 15000);

    return () => {
      socket.disconnect();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [pushAlert]);

  const clear = useCallback(() => setAlerts([]), []);

  return { connected, alerts, clear };
}
