# Contributing

Thank you for improving SentinelKiosk.

## Development workflow

1. Create a focused branch from `main`.
2. Copy `.env.example` to `.env` and use local-only secrets.
3. Install dependencies and initialize the database as described in the README.
4. Keep changes scoped and include tests when behavior changes.
5. Run lint, TypeScript, build, and relevant shell tests before opening a pull request.

## Pull requests

Describe the problem, the chosen solution, security implications, and verification performed. Include screenshots for visible interface changes. Avoid committing runtime databases, logs, secrets, generated output, or production biometric data.

## Coding guidelines

- Preserve strict TypeScript types and existing API response shapes.
- Enforce authorization in server routes, not only in the interface.
- Record security-sensitive mutations in the admin audit trail.
- Never log raw card tokens, face embeddings, passwords, PINs, or session tokens.
- Keep kiosk behavior usable during expected network interruptions.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
