# Deployment

## Configuration

Start from `.env.example` and provide deployment-specific values through the platform's secret manager. At minimum, configure:

- `DATABASE_URL`
- `ORG_SIGNING_KEY`
- `KEY_ID`
- `ALERTS_SERVICE_URL`

Never commit the production environment file or reuse demonstration secrets.

## Build

The platform entry point is `.zscripts/build.sh`. It installs dependencies, creates a standalone Next.js build, packages mini-services, prepares the SQLite database, includes an optional Python runtime, copies Caddy configuration, and produces a compressed deployment artifact.

The `.zscripts` directory is required by this deployment workflow and must remain tracked.

## Runtime

`.zscripts/start.sh` starts the standalone Next.js server and packaged mini-services, then runs Caddy in the foreground. Caddy listens on port 81 and proxies the application to port 3000. The alert service uses port 3003.

## Database

The default package includes `db/custom.db`. For durable production data, mount persistent storage or provide an external database strategy before scaling to multiple instances. SQLite is not suitable for every concurrent or multi-instance deployment.

## Pre-deployment checklist

- Run lint, TypeScript, the production build, and repository tests.
- Rotate all signing keys, passwords, PINs, and integration secrets.
- Replace in-memory sessions with durable, revocable storage.
- Protect internal alert endpoints and restrict outbound webhook URLs.
- Confirm backups, retention, recovery, monitoring, and audit export.
- Review biometric consent and privacy obligations for the deployment jurisdiction.
- Test lockdown, revocation, degraded-network, and recovery procedures.
