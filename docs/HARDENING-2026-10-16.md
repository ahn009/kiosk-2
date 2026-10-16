# Hardening pass — 2026-10-16

What changed in this pass: the v1 demo's placeholders, production-readiness
gaps, and system-security gaps that are fixable in code. Items that need
hardware, vendors, or legal decisions are listed as residual risks at the end
(see also `docs/PRODUCTION_ROADMAP.md`, which remains the master plan).

## Secrets & crypto

- **Fail-closed configuration** (`src/lib/config.ts`, `src/instrumentation.ts`):
  typed, zod-validated env; the server refuses to boot in production without
  strong `ORG_SIGNING_KEY` and `WEBHOOK_ENCRYPTION_KEY` (min 32 chars,
  placeholder values rejected). In dev, an ephemeral per-process key is used
  with a loud warning — no more stable checked-in fallback key.
- **Removed the hard-coded dev signing key** from `src/lib/crypto.ts`.
- **Supervisor PINs** now use `crypto.randomInt` (was `Math.random`).
- **Webhook secrets encrypted at rest** (AES-256-GCM) in `db/webhook-state.json`;
  never returned by the API (`hasSecret` flag only); the admin UI no longer
  prefills them.

## Sessions & auth

- **Database-backed sessions** (new `AdminSession` / `MobileSession` Prisma
  models): 256-bit CSPRNG tokens, only SHA-256 hashes stored, 30-min admin /
  60-min mobile TTL, single-active-session, expiry pruning. Replaces the
  in-memory `Math.random()` token maps that were lost on restart.
- **Rate limiting** on `/auth/login`, `/mobile/login` (5/min/IP),
  `/kiosk/verify-token` (120/min/IP), `/kiosk/supervisor-override` (10/min/IP)
  with 429 + Retry-After. (Single-instance; use a gateway limiter for HA.)
- **Supervisor override is now server-verified**: the fixed client-side PIN
  `123456` is gone. A supervisor authenticates with their own admin
  credentials (security_officer/superadmin), states a reason, and the grant is
  written as an immutable `supervisor_override` audit event + admin action
  attributable to them.

## Demo / simulation containment

- New `DEMO_MODE` flag (default off). When off, demo-only routes return 404:
  `/kiosk/demo-cards`, `/kiosk/simulate-scan`, `/kiosks/simulate`,
  `/calibration`, `/enrollment/*/capture` (simulated embeddings).
- `/kiosk/verify-face` returns **503 fail-closed** when the biometric pipeline
  is simulated and demo mode is off — the browser can no longer grant access
  on its own assertions. Set `BIOMETRIC_MODE=external` once a trusted
  pipeline signs its verdicts.
- Kiosk UI hides the demo card picker and simulate buttons unless the server
  reports `demoMode: true` (`/public/status`).
- Demo seed data (known-password admins, simulated employees, fake scans)
  is refused in production; `bun run admin:create` bootstraps the first
  superadmin from env instead.
- **Absolute-path enforcement**: `DATA_DIR` (file-based state) must be an
  absolute path in production; `.env.example` documents that `DATABASE_URL`
  must also be absolute — a relative SQLite path silently resolves against
  the server's cwd, which differs under Next.js standalone (found live
  during verification).

## Data leaks closed

- **QR codes render locally** (`qrcode` package, error correction H) — card
  tokens are no longer sent to `api.qrserver.com` in the URL (single-card and
  bulk-print flows).
- **Webhook SSRF guard**: HTTPS-only in production, blocks private /
  loopback / link-local / metadata addresses (DNS-resolved), no credentialed
  URLs, no cross-origin redirects on delivery. Secrets are HMAC-signed as
  before, now decrypted only at dispatch time.
- **`.env` removed from git history tracking** (`git rm --cached`); `.env`
  was already in `.gitignore` but had been force-added.

## Production readiness

- `next.config.ts`: `typescript.ignoreBuildErrors` removed (type errors now
  fail the build), `reactStrictMode: true`, `instrumentationHook: true`.
- **Security-headers middleware**: nosniff, DENY framing, strict referrer
  policy, restrictive permissions policy (camera only for self — the kiosk
  needs it), HSTS in production.
- **Structured JSON logging** (`src/lib/logger.ts`) for server code; audit
  write failures now log instead of silently swallowing.
- **CI** (`.github/workflows/ci.yml`): install, Prisma validate, lint,
  typecheck, production build, gitleaks secret scan.
- `.env.example` documents every variable, including the new ones.

## Deliberately NOT done here (residual risks)

These need hardware, vendors, legal, or infra decisions — code alone cannot
fix them. Do not connect this build to a live door until they are addressed:

1. Real biometric pipeline (camera → detection → PAD → embedding) and a
   measured calibration study (roadmap Phase 5).
2. Kiosk device identity (mTLS / device certs) for `/kiosk/*` endpoints.
3. Durable platform: managed Postgres, Redis-backed rate limits/sessions
   for HA, Redis-backed pending-scan store (currently in-memory).
4. Signed offline bundles / idempotent sync protocol (roadmap Phase 6).
5. Append-only/tamper-evident audit storage.
6. OIDC/SAML + MFA for admins; magic-link/device auth for mobile.
7. OSDP Secure Channel to the door controller; life-safety sign-off.
8. Privacy/DPIA review, biometric consent flows, retention/deletion jobs.
