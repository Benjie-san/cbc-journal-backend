# Next-session handoff prompt

Copy the prompt below into the next conversation.

```text
Continue the CBC Journal project from the existing workspace. Read these files before taking action:

- docs/next-phase-roadmap.md
- docs/backup-recovery.md
- docs/self-hosting-setup.md
- docs/self-hosting-runbook.md
- docs/streak-sync-investigation.md

Workspace:
- Backend: C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal-backend
- Expo mobile app: C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal
- Public API: https://api.cbcjournal.cc
- Android package: com.anonymous.Journal

Completed milestone:
- Local MongoDB is the production database on the Windows host.
- Cloudflare Tunnel publishes the API; MongoDB and Express ports are not router-forwarded.
- MongoDB has an automatic daily local compressed backup with a SHA-256 sidecar.
- A passphrase-encrypted archive was uploaded to MEGA. The downloaded copy passed checksum verification, age decryption, isolated mongorestore, exact collection counts, canonical document digests, and index restoration: 1,853 documents restored and 0 failed. The temporary restore database/files were removed.
- Controlled Windows restart recovery passed: MongoDB, Cloudflared, the backend scheduled task, health checks, and phone synchronization recovered after the expected short outage.
- Android closed testing, Google sign-in, offline CRUD/sync, and the streak-hydration fix have passed smoke tests.
- The MEGA workflow is manual and low-cost. Do not enable the deferred OneDrive encryption automation unless explicitly requested.

Next objective: Backend and security hardening.

Start with a read-only audit and diagnosis. Do not change production behavior before reporting findings, severity, evidence, and a proposed remediation order. Audit at least:

1. Authentication and authorization on every protected route, including user-ID/ownership checks and Firebase/JWT verification.
2. CORS, Helmet, rate limiting, request-size limits, schema validation, safe error responses, and HTTP security headers.
3. JWT lifetime, storage, logout/revocation assumptions, token refresh, and secret rotation.
4. Logging for tokens, journal content, email addresses, stack traces, and sensitive operational data.
5. MongoDB binding/authentication, least-privilege access, database indexes, and backup/restore exposure.
6. Environment files, service accounts, Cloudflare credentials, Firebase configuration, file permissions, and accidental secret exposure.
7. Dependency vulnerabilities and upgrade risk; do not use npm audit --force blindly.
8. Missing automated tests for authentication, authorization, validation, synchronization, account deletion, and failure paths.
9. Graceful shutdown, readiness/health checks, startup failure behavior, and incident recovery.

Also note the remaining Priority 0 items: external uptime monitoring, Windows sleep/power policy, and multi-device synchronization conflict/idempotency testing. Keep the Android/web/iOS/notification expansion behind the security and privacy gates unless a specific task changes that priority.

Use the existing repository conventions. Preserve unrelated user changes, use apply_patch for edits, avoid destructive commands, and never print or commit secrets. After the audit, provide a prioritized report and ask which remediation slice to implement first. If implementation is authorized, patch the smallest safe slice and run focused tests plus a relevant smoke check.
```
