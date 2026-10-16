# Architecture

SentinelKiosk is one Next.js application with three user-facing modes and one supporting real-time service.

## Application modes

- **Admin:** manages employees, enrollment, kiosks, access events, calibration, lockdown, revocations, and integrations.
- **Kiosk:** verifies a signed card token, runs face and liveness checks, and records the access decision.
- **Mobile:** gives an employee access to their card state, recent scans, alerts, and lost-card reporting.

The launcher selects a mode. Zustand stores local navigation and sessions, while TanStack Query manages server data.

## Server

Next.js route handlers under `src/app/api/v1` provide authentication, employee management, enrollment, kiosk verification, audit, dashboard, mobile, and webhook endpoints. Prisma accesses SQLite through a singleton client in `src/lib/db.ts`.

The data model includes departments, employees, scan events, revocations, admin users, enrollments, kiosks, admin actions, and system state. Security-sensitive administrative changes are recorded in `AdminAction`; scan decisions are appended to `ScanEvent`.

## Verification flow

1. The kiosk validates the signed card structure and expiration.
2. The server hashes the raw token and checks employee status and revocations.
3. Lockdown and enrollment requirements are evaluated.
4. The kiosk collects liveness and face-verification data.
5. The server compares the result against configured thresholds.
6. The decision is recorded and relevant alerts are dispatched.

Several biometric operations are simulated for demonstration and must be replaced or independently validated for production.

## Alerts

`mini-services/alerts-service` accepts internal events over HTTP and broadcasts them with Socket.IO. The Next.js app can also send security events to configured Slack, Teams, or generic webhook targets.

## Deployment

The production package contains the standalone Next.js server, static assets, SQLite database, optional Python runtime, alert service, startup scripts, and Caddy configuration. See [DEPLOYMENT.md](DEPLOYMENT.md).
