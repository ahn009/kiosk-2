# SentinelKiosk

SentinelKiosk is a multi-kiosk employee access-control system. It combines signed card tokens, liveness-assisted face verification, role-based administration, revocation handling, real-time security alerts, and an append-only scan audit trail.

## Features

- Admin dashboard for employees, enrollments, kiosks, audits, calibration, and security controls
- Kiosk workflow for card scanning, face verification, liveness challenges, and supervisor overrides
- Employee mobile companion for card status, scan history, and lost-card reporting
- Emergency lockdown and card revocation propagation
- Real-time Socket.IO alert feed and configurable SIEM webhooks
- Prisma-backed SQLite data model with seeded demonstration data

## Technology

- Next.js 16, React 19, and TypeScript
- Tailwind CSS and Radix UI
- Prisma with SQLite
- Zustand and TanStack Query
- Bun-based Socket.IO alert service
- Caddy reverse proxy for packaged deployments

## Quick start

Requirements: Node.js 20+ or Bun, with Bun recommended for the complete development stack.

```bash
cp .env.example .env
bun install
bun run db:generate
bun run db:push
bun prisma/seed.ts
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The repository includes demonstration users and data in `prisma/seed.ts`; do not use those credentials in production.

To run the alert service separately:

```bash
cd mini-services/alerts-service
bun install
bun run dev
```

## Quality checks

```bash
bun run lint
bunx tsc --noEmit
bun run build
bash tests/database-runtime-build.sh
bash tests/python-runtime-build.sh
```

The container-level Python runtime test additionally requires Docker.

## Documentation

- [Production roadmap](docs/PRODUCTION_ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API overview](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

## Security notice

The included biometric matching, liveness flow, supervisor PIN, sessions, and seed credentials contain demonstration behavior. Review and replace them before any production or physical-access deployment. See [SECURITY.md](SECURITY.md).

## License

Licensed under the [MIT License](LICENSE).
