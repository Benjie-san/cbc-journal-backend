# CBC Journal Practical Hardening Plan

Last updated: 2026-09-17

This plan is intentionally sized for a home-hosted journal service with fewer
than 100 expected users. The goal is to protect private journal data and keep
operations recoverable without introducing enterprise infrastructure.

## Constraints

- Keep MongoDB and Express off router-forwarded ports.
- Keep the manual passphrase-encrypted MEGA workflow unchanged.
- Preserve the Android package `com.anonymous.Journal`.
- Do not add Redis, containers, centralized logging, automated secret rotation,
  or a custom OAuth/RBAC platform unless scale or product requirements change.
- Keep web, iOS, and notification expansion behind the security and privacy
  gates in the roadmap.

## Phase 0: Restore availability

1. Diagnose why the backend process and runner stopped while MongoDB and
   Cloudflared remained running.
2. Restore the backend through the documented task only after its action,
   principal, working directory, and last result are verified.
3. Verify local `/health`, local `/ready`, public `/health`, authentication, and
   one phone synchronization.
4. Add a simple external uptime check and alert path.

Do not mix recovery with dependency or database-authentication changes.

## Phase 1: Small HTTP safety slice

Status: implemented in the worktree; production restart/smoke test remains
pending.

- Return JSON for unknown routes and malformed, oversized, and unexpected
  errors without exposing stack traces or filesystem paths.
- Apply an explicit 100 KB JSON request limit, matching the prior Express
  default rather than increasing accepted payload size.
- Apply `Cache-Control: no-store` to private, authentication, and health
  responses.
- Keep `/` for compatibility, add `/health` for liveness, and add a rate-limited
  `/ready` MongoDB ping.
- Validate required startup configuration without logging values.
- Handle SIGINT/SIGTERM with bounded HTTP and MongoDB shutdown.
- Cover the boundary with focused tests that use no live Firebase or MongoDB.

Exit check: automated tests pass, syntax and diff checks pass, and the local and
public smoke checks pass after an authorized restart.

## Phase 2: Host and credential boundary

1. Copy the deployed application to a non-OneDrive directory.
2. Run it as a non-administrator identity instead of executing editable project
   files as `SYSTEM`.
3. Store `.env` and Firebase Admin credentials outside OneDrive with restricted
   ACLs.
4. Update the startup task, test rollback, then rotate the JWT secret and
   Firebase Admin key once.

No secrets-management platform or automated rotation service is required.

## Phase 3: Focused validation and authorization tests

Add small schemas for authentication exchange, journal create/update, streak
writes, object IDs, and reading-plan completion. Add integration tests proving
that one user cannot read or mutate another user's data, including version
history, deletion, restoration, and reading completion.

## Phase 4: Data correctness

Make journal version checks atomic, handle concurrent duplicate `clientId`
creates idempotently, and replace last-write-wins streak updates with a
versioned or server-derived design. Test interruptions and multiple devices.

## Phase 5: Conservative maintenance

1. Apply compatible Mongoose, Morgan, and transitive security patches.
2. Test Firebase Admin upgrades separately; do not force a major upgrade.
3. Keep Expo dependencies aligned with the installed Expo SDK and plan SDK
   upgrades independently.
4. Enable MongoDB authentication with one application identity and an
   appropriate backup identity while retaining localhost-only binding.

## Phase 6: Privacy release gate

Before public release, implement account export/deletion across Firebase,
users, journals, versions, completions, logs, and documented backup retention.
Complete the privacy notice, terms, youth/privacy review, and store disclosures
from actual behavior.

