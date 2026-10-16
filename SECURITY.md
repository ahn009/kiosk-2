# Security Policy

## Supported version

Security updates are applied to the latest commit on `main`.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting feature for this repository and include:

- A clear description of the issue and its impact
- Reproduction steps or a minimal proof of concept
- Affected routes, roles, or deployment modes
- Any suggested mitigation

Avoid accessing data that is not yours, disrupting a deployed system, or retaining card tokens, credentials, face data, or audit records. Maintainers should acknowledge a complete report within seven days and coordinate disclosure after a fix is available.

## Production requirements

Before deployment, complete all of the following (see
`docs/HARDENING-2026-10-16.md` for what the 2026-10-16 hardening pass
implemented in code, and `docs/PRODUCTION_ROADMAP.md` for the full plan):

**Implemented in code (2026-10-16):**

- Typed, fail-closed configuration: production refuses to boot without strong
  `ORG_SIGNING_KEY` / `WEBHOOK_ENCRYPTION_KEY`; no stable fallback secrets.
- Database-backed admin/mobile sessions (256-bit tokens, hash-only storage,
  TTL, single-active, revocation).
- Server-verified supervisor override (named supervisor auth + reason +
  immutable audit); the fixed client-side PIN is removed.
- Demo containment: `DEMO_MODE` (default off) gates demo routes, simulators,
  simulated enrollment/calibration; `/kiosk/verify-face` fails closed (503)
  without a trusted biometric pipeline.
- QR codes rendered locally; webhook secrets encrypted at rest, never
  returned, SSRF-guarded destinations; rate limits on auth/kiosk endpoints;
  security-headers middleware; structured logging; CI with secret scanning.
- `.env` untracked; demo seed refused in production; `bun run admin:create`
  bootstraps the first superadmin.

**Still required (hardware / legal / infra — not fixable in code alone):**

- Real biometric pipeline + measured PAD/calibration study; kiosk device
  identity (mTLS); managed Postgres/Redis for HA; signed offline sync;
  tamper-evident audit storage; OIDC/SAML + MFA; OSDP door-controller
  integration with life-safety sign-off; DPIA/privacy review and
  retention/deletion jobs.

Do not connect this build to a live door until the roadmap's release-gate
checklist passes and the residual risks above are accepted in writing.
