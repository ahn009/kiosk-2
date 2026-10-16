# API Overview

All application endpoints use the `/api/v1` prefix. JSON is used unless an export endpoint returns CSV.

## Public

- `GET /public/health` — application and database health
- `GET /public/status` — organization and lockdown status
- `GET /public/kiosks` — non-sensitive kiosk registry

## Authentication

- `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`
- Admin routes use a bearer token and enforce roles on the server.
- Mobile routes use a separate employee bearer session.

## Administration

- `/dashboard/stats`
- `/employees`, `/employees/:id`, `/employees/import`
- `/employees/:id/reissue-card`, `/employees/:id/revoke`
- `/enrollment/:employeeId/capture`, `/enrollment/:employeeId/status`
- `/departments`, `/kiosks`, `/kiosks/:id`
- `/audit/scans`, `/admin-actions`, `/revocations`
- `/admin/lockdown`, `/calibration`

## Kiosk

- `GET /kiosk/config/:kioskId`
- `POST /kiosk/verify-token`
- `POST /kiosk/verify-face`
- `POST /kiosk/sync`
- Demonstration routes provide simulated cards and scans.

## Mobile

- `POST /mobile/login`
- `GET /mobile/me`
- `GET /mobile/scans`
- `POST /mobile/report-lost`

## Integrations

- `/webhooks/config` manages alert destinations.
- `/webhooks/alerts/export` exports audit events as JSON or CSV.

Treat endpoint implementations and shared types in `src/lib/types.ts` as the source of truth. Never expose raw tokens, embeddings, passwords, PIN hashes, webhook secrets, or session values in clients or logs.
