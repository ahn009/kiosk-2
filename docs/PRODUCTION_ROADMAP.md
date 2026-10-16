# SentinelKiosk production roadmap

Status: planning baseline

Date: 2026-10-16

Scope: convert the current demonstration application into a production physical-access system and validate it with real credentials, cameras, people, kiosks, and door hardware.

## Executive decision

The repository is not ready to control a real door. It is a useful product prototype: the principal screens, database entities, audit views, revocation workflow, and API shape exist. However, the security-critical card, face, liveness, supervisor override, offline, alert, and session paths contain demonstration behavior or trust data supplied by the browser.

Do not connect the current build to a production lock. The first real-world exercise must be a lab or shadow-mode pilot in which the system records the decision but cannot actuate a door.

Production readiness means all of the following, not merely a successful build:

- a credential is issued, read, authenticated, revoked, and renewed securely;
- a real camera frame is captured and evaluated by a validated biometric pipeline;
- the kiosk, API, reader, controller, administrator, and employee are independently authenticated where appropriate;
- access policy is enforced on a trusted component and produces a durable, attributable decision;
- degraded and offline behavior is explicit, bounded, tested, and safe;
- privacy, employment, biometric, accessibility, fire, egress, and building requirements are approved for the deployment jurisdiction;
- operators can detect, contain, recover from, and explain failures.

## What exists today

### Useful foundations

- Next.js 16 application with admin, kiosk, and employee-mobile experiences.
- Prisma models for organizations, employees, kiosks, enrollments, credentials, scans, revocations, and audit events.
- Role-aware administration routes and screens.
- Lockdown, revocation, kiosk health, scan history, CSV import, alerts, and webhook concepts.
- Development database, seed data, deployment scripts, health endpoint, and architecture/API documentation.

### Production blockers found in the code

| Area | Current implementation | Required disposition |
|---|---|---|
| Card reading | `kiosk-app.tsx` opens `demo-scan-picker.tsx` or accepts a raw token; there is no reader integration | Introduce a reader adapter and supported hardware; remove the demo picker from production |
| Credential | `src/lib/crypto.ts` creates a long-lived shared-secret HMAC token with a development fallback key | Adopt a threat-modeled credential protocol, managed keys, rotation, replay resistance, issuance, and revocation |
| Demo credentials | `GET /api/v1/kiosk/demo-cards` mints/rotates credentials and is unauthenticated | Delete or compile out of production; never expose an equivalent endpoint |
| QR rendering | QR images are requested from `api.qrserver.com` with the credential in the URL | Render locally; never disclose access credentials to a third party |
| Face capture | Enrollment preview does not submit captured pixels; the server derives an embedding from employee code | Implement real frame capture, quality checks, protected transport, template generation, and deletion rules |
| Face matching | `src/lib/face-client.ts` produces a deterministic vector from employee code; the API trusts a client-supplied probe | Perform matching and policy decisions in a trusted service/device boundary |
| Liveness | Challenge completion and scores are simulated or client supplied | Integrate and independently evaluate presentation-attack detection (PAD) |
| Calibration | Calibration samples and quality figures are simulated; dashboard FAR is not measured | Run a documented validation study using representative, consented data |
| Supervisor override | The browser checks the visible fixed PIN `123456`; no trusted authorization occurs | Require named supervisor authentication, server-side policy, reason, expiry, and immutable audit |
| Kiosk identity | Kiosk verification/config/sync endpoints do not authenticate a managed device | Provision unique device identity and authenticate every kiosk request |
| Sessions | Admin and mobile sessions are process-local and use `Math.random`; mobile login is employee code only | Use a cryptographically secure, durable session/identity system with MFA and revocation |
| Offline mode | The server exposes a revocation list and sync endpoint, but the client has no durable encrypted cache/outbox | Build an offline policy and signed local data/sync protocol; test clock and network failures |
| Scan integrity | Kiosk sync accepts client assertions; pending scans live in memory for five minutes | Use signed/idempotent events and a durable transaction/state machine |
| Audit | Audit writes are best-effort and ordinary mutable database rows | Define append-only/tamper-evident storage, access control, export, retention, and alerting |
| Alerts | Separate Socket.IO service has permissive ingress/CORS and in-memory state | Authenticate producers/consumers and use a durable broker/queue |
| Webhooks | Configuration/secrets are stored in plaintext JSON; arbitrary destinations are accepted | Encrypt secrets, prevent SSRF, sign deliveries, retry durably, and audit changes |
| Database | SQLite and local JSON/process memory carry production state | Move shared state to managed durable services with migrations, backups, and restore tests |
| Build safety | TypeScript build errors are ignored in `next.config.ts`; there is no application test suite or CI workflow | Make type/lint/test/security checks mandatory and reproducible |
| Deployment | Scripts contain machine-specific paths; proxy rules and runtime assumptions are development oriented | Produce environment-neutral artifacts, hardened configuration, rollback, and fleet operations |
| Claims | UI/docs imply real liveness, encryption, immutable audit, and measured biometric performance | Remove unverified claims until evidence exists |

## Decisions required before implementation

Record these as architecture decision records (ADRs). A product owner, security lead, privacy/legal owner, physical-security integrator, and engineering lead must sign the applicable decisions.

1. Deployment jurisdictions and applicable biometric, employment, surveillance, accessibility, fire, egress, and retention requirements.
2. Whether face verification is necessary and proportionate. Define an equally usable non-biometric alternative.
3. Credential type: locally rendered QR, mobile credential, NFC smart card, existing corporate badge, PIV/CAC, or another technology. Do not choose from UI convenience alone.
4. Verification topology: on-device, on-premises service, cloud service, or hybrid; document data residency and failure behavior.
5. Existing PACS/door-controller integration and responsibility boundary. Prefer a supervised secure protocol such as OSDP Secure Channel where compatible; avoid static identifier-only access for meaningful security.
6. Door behavior for power loss, network loss, fire alarm, emergency lockdown, request-to-exit, accessibility, and manual override. A qualified physical-security/life-safety professional owns this decision.
7. Maximum permitted offline duration, revocation propagation target, clock trust, and whether any door may unlock offline.
8. Identity provider, administrator MFA, employee identity proofing, and joiner/mover/leaver source of truth.
9. Biometric vendor/model, PAD approach, supported cameras, update policy, licensing, and measurable performance target.
10. Data controller/processor roles, lawful basis, consent or notice model, retention, employee appeal process, and incident notification procedure.
11. Availability, latency, recovery time (RTO), recovery point (RPO), support hours, and pilot success criteria.

## Target trust boundaries

The browser must not be the authority for identity, liveness, authorization, override, time, or door actuation.

1. A managed reader or kiosk obtains credential evidence and camera frames.
2. A device-bound agent authenticates the kiosk and protects local state using OS/TPM-backed keys where available.
3. A trusted verification service validates credential freshness, revocation, biometric/PAD evidence, policy, and rate limits.
4. An access-control unit performs the final hardware action through an authenticated, supervised channel.
5. A durable event pipeline records each input, policy version, decision, actuation result, and operator action without storing unnecessary biometric material.
6. Administration uses centralized identity, least privilege, MFA, approval controls, and attributable auditing.

## Phase plan

Durations are planning ranges, not commitments. Several workstreams can overlap, but a phase may not pass its exit gate on unfinished dependencies.

### Phase 0 — requirements, safety, privacy, and threat model (1–2 weeks)

Objective: decide what the system is allowed to do before expanding the prototype.

Work:

- Name accountable product, engineering, security, privacy/legal, facilities, and operations owners.
- Document sites, doors, populations, throughput, lighting, network, environmental, accessibility, and emergency constraints.
- Map data flows and trust boundaries from badge issuance through deletion.
- Threat-model copied credentials, replay, camera injection, presentation attacks, kiosk theft, reader tampering, insider abuse, API compromise, webhook SSRF, database loss, and denial of service.
- Complete the decisions above, DPIA/privacy review where applicable, and retention schedule.
- Select two candidate reader/camera/controller combinations for bench testing; obtain vendor security and lifecycle documentation.
- Define false-accept, false-reject, availability, latency, offline, and revocation objectives.
- Inventory every UI/security claim and mark it implemented, evidence pending, or prohibited.

Deliverables:

- approved product/security requirements;
- system context and data-flow diagrams;
- threat model and risk register;
- ADRs for credential, biometric, controller, topology, and offline policy;
- pilot protocol, participant notice/consent material, and non-biometric path;
- initial bill of materials and lab plan.

Exit gate:

- no unresolved critical safety or legal question;
- every retained biometric use has a documented necessity, lawful basis, owner, retention period, and alternative;
- measurable acceptance criteria and pilot stop conditions are signed off.

### Phase 1 — engineering and release foundation (1–2 weeks)

Objective: make every later security change testable and deployable.

Work:

- Pin supported Node/Bun versions and choose one production package/install path.
- Add CI for clean install, formatting, lint, TypeScript, unit/integration tests, production build, migration checks, dependency/license scanning, secret scanning, and artifact provenance/SBOM.
- Remove `typescript.ignoreBuildErrors`; treat compilation failure as a release blocker.
- Create typed, schema-validated configuration with distinct development, test, staging, and production profiles.
- Introduce a production-safe feature system: `DEMO_MODE` must default off and fail closed in production.
- Delete or isolate demo routes, seed credentials, simulated statistics, fixed PINs, fallback secrets, and launcher shortcuts from production artifacts.
- Replace machine-specific deployment paths and document reproducible artifact creation and rollback.
- Establish coding review requirements and use OWASP ASVS 5.0 as the web-security verification baseline.

Required tests:

- a production build contains no demo route, demo account, fixed secret, or simulator;
- startup fails clearly when a required secret or service is absent;
- a clean checkout produces the same tested artifact;
- dependency and secret scans run on every change.

Exit gate: all CI checks pass and a tagged staging artifact can be deployed and rolled back automatically.

### Phase 2 — identity, authorization, secrets, and durable platform (2–4 weeks)

Objective: establish trustworthy users, devices, storage, and keys.

Work:

- Integrate an organizational identity provider using OIDC/SAML; require phishing-resistant MFA where practical for privileged roles.
- Replace process-local sessions and `Math.random` tokens with secure, durable, revocable sessions; harden cookies and CSRF/origin handling.
- Replace employee-code-only mobile login with an approved authentication and account-recovery flow.
- Define least-privilege roles and test an authorization matrix for every route and sensitive field.
- Add rate limits, lockouts/backoff, suspicious-login alerts, and session/device revocation.
- Provision each kiosk with a unique non-exportable identity; authenticate and authorize all configuration, verification, heartbeat, revocation, and sync calls.
- Move relational data to managed PostgreSQL (or an approved equivalent); use durable cache/queue services only where their failure semantics are explicit.
- Put signing, encryption, database, webhook, and integration secrets in a secrets/KMS service with rotation and separation by environment.
- Encrypt sensitive data at rest and define key rotation/re-encryption procedures.
- Add schema validation and consistent error contracts to all API boundaries.

Exit gate:

- anonymous or cross-organization calls cannot read configuration, verify a credential, submit a scan, or change state;
- role, tenant-isolation, rate-limit, session-revocation, key-rotation, backup, and restore tests pass;
- no production secret is stored in source, local JSON, logs, or browser storage.

### Phase 3 — managed kiosk and hardware laboratory (2–4 weeks)

Objective: turn the browser demo into a managed appliance and prove the physical interfaces.

Work:

- Define a reader abstraction with explicit connect, health, read, cancel, timeout, and tamper states.
- Integrate candidate card reader, camera, and access-control unit in an isolated bench environment.
- Build a native/local device agent if browser APIs cannot provide secure hardware access and device key protection.
- Apply OS kiosk lockdown, least-privilege service accounts, secure boot/disk encryption where supported, automatic security updates, signed application updates, watchdog/restart, and remote inventory.
- Remove the launcher and client-side hold-to-exit path from production; provide an authenticated maintenance procedure.
- Monitor device certificate, firmware, app version, camera/reader/controller status, disk, clock, network, temperature, and tamper signals.
- Bench-test OSDP Secure Channel negotiation and supervised failure reporting when that protocol is selected.

Hardware acceptance checks:

- exact model/firmware/serial inventory and vendor support lifetime recorded;
- disconnect, cable tamper, reboot, power loss, clock drift, bad firmware, and certificate-expiry behavior observed;
- no raw credential or biometric frame appears in URLs, analytics, console output, crash dumps, or ordinary logs;
- reader feedback and accessible alternatives work under representative lighting, height, noise, gloves, eyewear, and mobility conditions.

Exit gate: one lab kiosk remains managed and observable through a 72-hour soak test, without controlling a live door.

### Phase 4 — real credential lifecycle (3–5 weeks)

Objective: securely issue and verify a real card or mobile credential.

Work:

- Specify credential format, cryptography, issuer/verifier keys, validity, freshness/challenge, anti-replay, cloning risk, and privacy properties.
- Prefer asymmetric or hardware-backed credentials where the threat model warrants them; do not use a shared fallback signing secret.
- Implement issuance with identity proofing, inventory/custody, activation, receipt, renewal, lost/stolen reporting, revocation, replacement, and destruction.
- Render QR locally if QR remains in scope; ensure printed/static QR risk is explicitly accepted or add a dynamic factor.
- Bind verification to authenticated device, organization, policy version, nonce/challenge, trusted time, and a short transaction lifetime.
- Make revocation and reissue atomic; old credentials must stop working within the defined online/offline propagation target.
- Record key identifiers and verification result, not reusable secret material, in audit events.

Required tests:

- genuine, expired, revoked, wrong-tenant, malformed, altered, cloned/replayed, rapidly repeated, and old-key credentials;
- issue/revoke/reissue races and verifier key rotation;
- lost network and stale revocation state;
- throughput and read reliability on every supported card/reader/phone combination.

Exit gate: credential security review passes and at least 1,000 lab transactions meet the agreed success, latency, replay, and revocation targets.

### Phase 5 — real enrollment, face verification, and PAD (4–8 weeks)

Objective: replace deterministic and random biometric behavior with a measured system.

Work:

- Evaluate build-versus-buy and document model/vendor version, training/benchmark evidence, update policy, data use, sub-processors, and regional hosting.
- Capture real frames from the approved camera; perform face presence, pose, illumination, occlusion, sharpness, multiple-face, and injection checks.
- Generate protected templates in a trusted boundary. Encrypt templates separately from identity records and restrict template access/export.
- Store enrollment consent/notice version, operator, device, quality evidence, model version, timestamps, and reason for replacement.
- Implement PAD with a documented threat model and independent result. Do not accept liveness scores or embeddings asserted by the browser.
- Enforce retry limits, cooldown, escalation, and an accessible non-biometric recovery path.
- Implement deletion/export/retention jobs and prove deletion from primary storage, replicas, caches, and backups according to policy.
- Create a representative, consented validation dataset and test by relevant demographic and environmental cohorts. Keep evaluation data out of source control.
- Calibrate thresholds from measured false-match/false-non-match and PAD attack results; version and audit every threshold/policy change.

Validation baseline:

- Use the current [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) biometric guidance as a baseline: biometrics should be paired with a physical authenticator, face systems require PAD, a non-biometric option is necessary, and performance must be assessed across demographic groups.
- Use [ISO/IEC 30107-3:2023](https://www.iso.org/standard/79520.html) to structure PAD testing and reporting.
- Treat legal thresholds as jurisdiction specific. For example, GDPR defines biometric data used for unique identification and generally treats it as specially protected data; see the official [GDPR text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679).

Exit gate:

- an independent report demonstrates agreed accuracy and PAD performance on representative hardware, people, attacks, and conditions;
- no cohort falls outside the approved performance/risk bounds;
- privacy/legal and security owners approve the enrollment, retention, deletion, and fallback processes;
- all existing simulated face, liveness, calibration, and spoof values are removed from the production artifact.

### Phase 6 — policy engine, door control, and offline operation (3–6 weeks)

Objective: make a trustworthy, explainable access decision and safely execute it.

Work:

- Model access schedules, zones, credential state, employee state, kiosk/door state, lockdown, anti-passback if required, retry limits, and explicit denial reasons.
- Put final authorization on a trusted service/controller boundary. The UI only displays the outcome.
- Represent each attempt as a durable state machine: presented, credential verified, biometric/PAD evaluated, policy decided, command requested, controller acknowledged, door state observed, completed/failed.
- Implement named supervisor override with strong authentication, allowed scope, reason, dual approval where required, short expiry, and alert/audit events.
- Integrate controller/reader using the selected supervised secure protocol. SIA describes [OSDP](https://www.securityindustry.org/industry-standards/open-supervised-device-protocol/) as supporting encrypted Secure Channel and supervised bidirectional reader/controller communication; use verified compatible products and test interoperability.
- Build encrypted local configuration/revocation cache and outbox with signed bundles, monotonic sequence, policy/version expiry, unique event IDs, idempotent sync, and conflict handling.
- Detect clock rollback, stale policy, full disk, corrupt cache, duplicate scans, partition, and certificate expiry.
- Enforce the approved maximum offline duration and fail behavior. Never silently broaden access because the network is unavailable.
- Test fire alarm, request-to-exit, emergency services, lockdown, power loss, UPS exhaustion, mechanical key, and safe maintenance with the responsible professionals.

Exit gate:

- hardware-in-the-loop tests cover every decision/failure transition;
- every unlock is attributable to a verified policy decision and controller acknowledgement;
- offline access never exceeds the approved policy window and revocation target;
- life-safety and facilities acceptance is written and complete.

### Phase 7 — audit, alerts, integrations, and data governance (2–4 weeks)

Objective: make security events reliable, actionable, and governable.

Work:

- Define a versioned event schema with event ID, correlation ID, organization, device, subject reference, factor results, policy/model versions, decision, actor, and timestamps.
- Write security events transactionally to append-only or tamper-evident storage; restrict correction to compensating events.
- Authenticate alert publishers and subscribers; replace in-memory buffering with a durable queue and bounded retry/dead-letter handling.
- Sign webhook deliveries, rotate secrets, enforce HTTPS, restrict destination networks/DNS, block cloud metadata and private-address SSRF, and implement replay-safe retries.
- Do not return stored webhook secrets after creation; provide rotate/revoke operations.
- Integrate SIEM/on-call alerts for repeated denials, replay/PAD attacks, override, lockdown, device tamper/offline, stale revocation, audit failure, and privileged administration.
- Automate retention, legal hold, access/export, correction where applicable, and deletion. Verify that logs do not contain credentials, templates, frames, passwords, tokens, or secrets.
- Document audit access review and evidence-export chain of custody.

Exit gate: simulated incidents produce one durable, deduplicated, attributable event and reach the assigned responder within the agreed target; retention/deletion and audit-tamper tests pass.

### Phase 8 — reliability, observability, and production operations (2–4 weeks)

Objective: prove the service can be operated and recovered.

Work:

- Define SLIs/SLOs for verification availability, p50/p95/p99 decision latency, credential read success, biometric retry/false-reject rates, revocation propagation, offline duration, sync lag, controller acknowledgement, and alert delivery.
- Add structured redacted logs, metrics, traces, correlation IDs, dashboards, synthetic transactions, and actionable alerts.
- Separate liveness/readiness/dependency health; remove sensitive operational detail from public endpoints.
- Test capacity and backpressure at expected peak throughput plus failure margin.
- Deploy high availability appropriate to the SLO; document migration, rolling update, compatibility, rollback, and key/model/policy rollout.
- Automate encrypted backups; conduct restore and regional/site disaster-recovery exercises against RTO/RPO.
- Produce incident response, lost device, compromised key, biometric breach, mass revocation, vendor outage, offline site, and emergency access runbooks.
- Establish patch, vulnerability response, certificate renewal, dependency update, and end-of-life processes.

Exit gate: staging survives load, dependency failure, restore, rollback, expired certificate, and network-partition exercises without an unexplained unlock or lost audit event.

### Phase 9 — real-world pilot in four gates (4–8 weeks)

Objective: obtain real evidence without exposing a production door or workforce to uncontrolled risk.

#### Gate A: bench validation

- Test employees use non-production identities and explicitly marked test credentials.
- Complete credential, camera, PAD, reader, controller, network, power, accessibility, and tamper cases.
- No connection to a live door.

#### Gate B: shadow mode at one site

- Enroll a small, voluntary, representative cohort using approved notice/consent and fallback.
- Install beside an existing access path; SentinelKiosk records allow/deny but cannot unlock.
- Compare decisions with the authoritative access system and investigate every disagreement.
- Provide staffed support and a fast biometric deletion/withdrawal process.

#### Gate C: controlled non-critical door

- Enable actuation only after Gate B targets pass and physical-security/life-safety approval is documented.
- Use a non-critical interior door during staffed hours with immediate fallback.
- Start with a small allowlist, daily review, and automatic rollback/disable triggers.

#### Gate D: limited production cohort

- Expand gradually by kiosk, cohort, and schedule—not all dimensions at once.
- Maintain the existing access route until stability and accessibility objectives are sustained.
- Hold formal go/no-go reviews after 1, 7, 30, and 90 days.

Pilot stop conditions include any unexplained unlock, credential replay success, cross-tenant disclosure, missing audit trail, unsafe egress behavior, material privacy violation, uncontrolled template/secret exposure, or performance outside approved cohort bounds.

Exit gate: the pilot report contains raw counts and confidence intervals where appropriate, incident/root-cause records, participant feedback, accessibility results, security test results, operational load, residual risks, and written approvals.

### Phase 10 — staged rollout and continuous assurance

Objective: scale only what the pilot proved.

Work:

- Roll out site by site with preflight, backout, training, spares, owner, and support coverage.
- Re-verify hardware firmware, device identity, policy, network, emergency paths, and monitoring before each site activation.
- Use change windows and progressive deployment for application, model, threshold, credential-key, and controller changes.
- Review access, privileged roles, devices, keys, retention, vendor posture, and vulnerability status on a fixed schedule.
- Revalidate biometrics after model/camera/environment/population changes and periodically against approved targets.
- Exercise incident response, backup/restore, mass revocation, offline recovery, and emergency operation at least annually or as risk requires.
- Track residual risks to explicit owners and expiry dates.

Exit gate: steady-state ownership, budget, support, compliance evidence, and continuous test cadence are accepted by the business and security owners.

## Test program

| Layer | Minimum scope |
|---|---|
| Unit | token/credential parser, crypto wrappers, policy rules, authorization, state machine, retention, redaction |
| API integration | authentication, tenant isolation, schemas, replay/idempotency, concurrency, transactions, rate limits, negative cases |
| UI end-to-end | admin, issuance, enrollment, scan, denial, fallback, override, revocation, deletion, accessibility |
| Hardware-in-loop | every supported reader/card/camera/controller and firmware combination; disconnect/tamper/power/network cases |
| Biometric/PAD | representative genuine attempts and defined presentation/injection attacks; cohort and environmental reporting |
| Offline/chaos | latency, partition, stale config/CRL, clock rollback, restart, disk full, corrupt cache, queue outage, duplicate delivery |
| Security | threat-model abuse cases, ASVS verification, SAST/DAST/dependency/secret/container scans, penetration test, device review |
| Operations | deployment, migration, rollback, backup restore, key rotation, certificate expiry, incident and mass-revocation exercises |

No test uses real employee biometric or access data outside the approved environment, purpose, retention, and participant agreement.

## Initial measurable targets to decide in Phase 0

Do not invent attractive numbers in the UI. Establish targets from risk, traffic, and validation evidence.

- verification availability and decision latency percentiles;
- credential read/verification success and replay detection;
- online and worst-case offline revocation propagation;
- false match rate, false non-match rate, and failure-to-acquire by relevant cohort and environment;
- PAD attack presentation classification and bona fide error rates;
- average retries, fallback usage, abandonment, and accessibility exceptions;
- controller command acknowledgement and observed door-state mismatch;
- event durability, sync lag, alert delivery time, and operator response time;
- RTO, RPO, backup restore time, patch SLA, and certificate/key rotation completion.

NIST's current guidance includes an FMR target of 1 in 10,000 or better for biometric verification and recommends FNMR below 5%, with demographic testing and PAD requirements. These are a useful baseline, not automatic proof that the system is lawful, safe, or adequate for this deployment.

## Release gate checklist

A production candidate is rejected if any item is false:

- [ ] Demo routes, generated identities, simulators, fixed credentials, fallback secrets, and fake metrics are absent from the production artifact.
- [ ] CI, clean build, migrations, automated tests, dependency/license/secret scans, and signed artifact checks pass.
- [ ] Administrator, employee, kiosk, service, and integration authentication meet the approved design.
- [ ] Tenant and role isolation are covered by negative automated tests.
- [ ] Credential replay, cloning, expiration, revocation, reissue, and key rotation behavior meet the target.
- [ ] Real face/PAD performance has independent evidence for supported hardware, people, attacks, and environments.
- [ ] A non-biometric accessible path works without punitive treatment.
- [ ] No browser assertion can independently cause an allow, override, liveness pass, or unlock.
- [ ] Offline duration, stale data, trusted time, reconciliation, and fail behavior are enforced and tested.
- [ ] Door, egress, fire, power, emergency, and manual procedures have written facilities/life-safety acceptance.
- [ ] Every unlock and privileged action has a durable attributable event; audit failure fails safely and alerts operators.
- [ ] Biometric/credential data is minimized, encrypted, access-controlled, retained, exported, and deleted as approved.
- [ ] Monitoring, on-call, runbooks, backup restore, rollback, key compromise, and incident exercises pass.
- [ ] Penetration test and high-severity remediation are complete; residual risks have named acceptance authority.
- [ ] Pilot evidence meets the predeclared targets and no stop condition remains unresolved.

## Suggested ownership

| Workstream | Accountable owner | Required collaborators |
|---|---|---|
| Product and pilot | Product owner | Site operations, employees, support |
| Application/platform | Engineering lead | QA, SRE, database owner |
| Security/identity/crypto | Security lead | Identity team, penetration tester, device vendor |
| Biometrics/privacy | Biometric lead and privacy/legal owner | HR/employee representatives, accessibility, vendor |
| Door/hardware/life safety | Physical-security integrator/facilities | Fire/egress authority, electrical, IT/network |
| Production operation | SRE/operations owner | Security operations, support, vendors |

## First two-week working backlog

- [ ] P0-001 Assign accountable owners and approve the no-live-door rule.
- [ ] P0-002 Inventory target sites, doors, existing PACS/controller, cards, readers, cameras, networks, and operating conditions.
- [ ] P0-003 Decide jurisdictions and begin privacy/legal/DPIA review; define the non-biometric alternative.
- [ ] P0-004 Run the multidisciplinary threat-model workshop and create the risk register.
- [ ] P0-005 Write ADRs for credential technology, biometric topology, controller interface, offline policy, and identity provider.
- [ ] P0-006 Define pilot metrics, cohorts, stop conditions, data rules, and support plan.
- [ ] P0-007 Obtain candidate lab hardware and security/lifecycle documentation.
- [ ] P1-001 Add CI and make TypeScript/build/test checks blocking.
- [ ] P1-002 Define `DEMO_MODE` and enumerate production-excluded routes/components/data.
- [ ] P1-003 Create an endpoint authorization and data-classification matrix.
- [ ] P1-004 Choose durable database, session, queue, object storage, KMS/secrets, and observability services.
- [ ] P1-005 Create a test skeleton and convert the highest-risk findings above into failing tests.

## Reference baselines

- [NIST SP 800-63B, Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [NIST SP 800-63A, Identity Proofing and Enrollment](https://pages.nist.gov/800-63-4/sp800-63a.html)
- [ISO/IEC 30107-3:2023, biometric presentation attack detection testing and reporting](https://www.iso.org/standard/79520.html)
- [OWASP Application Security Verification Standard 5.0](https://owasp.org/projects/asvs)
- [SIA Open Supervised Device Protocol](https://www.securityindustry.org/industry-standards/open-supervised-device-protocol/)
- [EU General Data Protection Regulation](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679)

These are engineering and assurance baselines, not a substitute for jurisdiction-specific legal, labor, accessibility, building, fire, or life-safety advice.
