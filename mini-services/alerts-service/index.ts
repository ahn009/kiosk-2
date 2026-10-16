// SentinelKiosk real-time alerts WebSocket service.
// Broadcasts security events (denied scans, spoof attempts, lockdowns) to
// connected admin dashboards + a shared in-memory recent-alerts buffer.
//
// The Next.js app pushes alerts here via HTTP POST /emit (internal), and admin
// dashboards subscribe via socket.io at path "/" with ?XTransformPort=3003.
//
// DO NOT change the socket.io path "/"; Caddy uses it for forwarding.

import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server } from "socket.io";

const PORT = 3003;

export interface AlertEvent {
  id: string;
  type: "denied" | "lockdown" | "spoof" | "supervisor_override" | "granted" | "test" | "kiosk_status";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  kioskId?: string;
  employeeCode?: string | null;
  timestamp: string;
}

const recentAlerts: AlertEvent[] = [];
const MAX_RECENT = 50;
let connectedClients = 0;

function genId() {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// Plain HTTP request handler — runs BEFORE socket.io for non-socket requests.
async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  const url = req.url ?? "";

  // Health check
  if (url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        port: PORT,
        connectedClients,
        recentCount: recentAlerts.length,
        uptime: Math.round(process.uptime()),
      })
    );
    return true;
  }

  // Recent alerts (REST fallback)
  if (url === "/recent" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ alerts: recentAlerts, connectedClients }));
    return true;
  }

  // Emit an alert (called by the Next.js app backend via fetch)
  if (url === "/emit" && req.method === "POST") {
    const body = await new Promise<string>((resolve) => {
      let b = "";
      req.on("data", (c) => (b += c));
      req.on("end", () => resolve(b));
    });
    try {
      const data = JSON.parse(body);
      const evt: AlertEvent = {
        id: data.id || genId(),
        type: data.type || "info",
        severity: data.severity || "info",
        title: data.title || "Alert",
        message: data.message || "",
        kioskId: data.kioskId,
        employeeCode: data.employeeCode ?? null,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      recentAlerts.unshift(evt);
      if (recentAlerts.length > MAX_RECENT) recentAlerts.pop();
      io.emit("alert", evt);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, id: evt.id, broadcast: connectedClients }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
    return true;
  }

  return false; // not handled — let socket.io take it
}

const httpServer = createServer((req, res) => {
  handleHttp(req, res).then((handled) => {
    if (!handled) {
      // Not one of our HTTP routes. If socket.io's engine.io listener is
      // attached, it will handle the request (handshake/upgrade). If no
      // socket.io listener responds within a tick, return 404.
      // We must NOT respond here immediately or we race socket.io.
      setTimeout(() => {
        if (!res.writableEnded && !res.headersSent) {
          setCors(res);
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
        }
      }, 50);
    }
  });
});

const io = new Server(httpServer, {
  path: "/sk-alerts/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  connectedClients += 1;
  console.log(`[alerts] client connected: ${socket.id} (${connectedClients} total)`);

  // Send recent alerts on connect (backfill)
  socket.emit("recent", { alerts: recentAlerts });

  socket.on("ping", () => {
    socket.emit("pong", { connectedClients, recentCount: recentAlerts.length });
  });

  socket.on("disconnect", () => {
    connectedClients = Math.max(0, connectedClients - 1);
    console.log(`[alerts] client disconnected (${connectedClients} total)`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[alerts] SentinelKiosk alerts WebSocket service running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("[alerts] SIGTERM, shutting down...");
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[alerts] SIGINT, shutting down...");
  httpServer.close(() => process.exit(0));
});
