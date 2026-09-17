# CBC Journal Next-Phase Roadmap

Last updated: 2026-09-17

The database recovery, self-hosted backend, Cloudflare Tunnel, Google Play closed-testing release, login, and synchronization milestone is complete. The next phase should prioritize data safety and correctness before adding more clients and features.

## Current milestone status

- The backend is self-hosted on the Windows PC and published through the permanent Cloudflare Tunnel at `https://api.cbcjournal.cc`.
- MongoDB daily local backups are scheduled and tested.
- The passphrase-encrypted MEGA archive was downloaded, checksum-verified, decrypted, and restored into an isolated database. All 1,853 documents, collection digests, and indexes matched; the temporary restore data was removed afterward.
- Windows restart recovery, Android closed testing, Google sign-in, offline CRUD, synchronization, and the streak-hydration correction have been smoke-tested successfully.
- The Android package remains `com.anonymous.Journal`; iOS is deferred until CBC has Apple Developer access and Mac-based testing.

The next implementation phase is a read-only backend and security audit. Do not begin broad UI, web, or notification expansion until critical authentication, authorization, data-protection, and recovery findings are understood.

## Confirmed product direction

- Distribution: publicly available in the Philippines initially, with fewer than 100 users expected. Other countries may be added later after a policy and operational review.
- Ownership: City Bible Church should probably own the production system; this still needs a formal decision and account-transfer plan.
- Web: an authenticated journal web app, not a replacement for the existing public church website.
- Notifications: both private daily reminders and church announcements.
- Audience: primarily youth, with a minimum registration age of 13.
- iOS: deferred for now because there is no Mac or Apple Developer account.

The small initial audience makes the current architecture reasonable for testing and an early staged release, but it does not remove the need for monitoring, backups, privacy protections, or capacity limits.

## Priority 0: Stabilize the current system

These are release blockers because journal data is sensitive and the backend currently depends on one Windows PC.

1. Completed 2026-09-17: run the controlled Windows restart test. MongoDB, Cloudflared, and the backend recovered automatically; local/public health checks and phone synchronization passed after the expected temporary outage. See [self-hosting-setup.md](./self-hosting-setup.md).
2. Completed 2026-09-17: verify a fresh backup by restoring it into an isolated temporary database and comparing counts, IDs, canonical BSON digests, and indexes. See [backup-recovery.md](./backup-recovery.md).
3. Completed 2026-09-17: installed `age` 1.3.1, uploaded a passphrase-encrypted archive and checksum to MEGA, verified the checksum after download, decrypted it, restored it into an isolated database, and matched all collection digests and indexes. The passphrase remains outside MEGA and the host. The OneDrive public-key automation is deferred. See [backup-recovery.md](./backup-recovery.md).
4. Add external uptime monitoring for `https://api.cbcjournal.cc/` and an alert path.
5. Confirm Windows sleep, power, automatic update, and recovery behavior. Consider a UPS if the host will operate continuously.
6. Completed 2026-09-17 for the hydration defect: the observed 16-to-2 change was caused by capturing Zustand state before AsyncStorage hydration completed. The client now re-reads state after hydration, and a real-device smoke test preserved streak 3 across refresh, restart, offline use, reconnection, and synchronization. Multi-device last-write-wins behavior still needs a versioned or server-derived design. See [streak-sync-investigation.md](./streak-sync-investigation.md).
7. Test sync idempotency, duplicate prevention, deletions/restores, conflicts, interrupted requests, and multiple devices.

Exit gate: restart recovery is proven, a backup can be restored, monitoring works, and synchronization no longer changes correct user data.

## Priority 1: Backend and security hardening

1. Document the data model, trust boundaries, sensitive fields, and likely threats.
2. Audit authentication and per-user authorization on every protected route.
3. Add consistent schema validation, request-size limits, safe error responses, and rate limits.
4. Restrict CORS to the approved web origins once the web client exists.
5. Review backend JWT lifetime, storage, logout/revocation behavior, and secret rotation.
6. Replace broad credentials with least-privilege access where supported. Protect Firebase, Cloudflare, environment, and database credentials with strict file permissions.
7. Enable MongoDB authentication while retaining localhost-only binding.
8. Redact tokens and journal content from logs; add structured operational logging and useful metrics.
9. Audit dependencies and upgrades carefully, without using forced upgrades blindly.
10. Add automated API, authorization, synchronization, and database migration tests.
11. Add graceful shutdown, readiness checks, and a documented recovery/incident procedure.
12. Implement account export and deletion services needed by the clients and store policies.

Exit gate: security review findings are resolved or accepted explicitly, critical routes have automated tests, and account lifecycle operations work end to end.

## Priority 2: Privacy, policy, and ownership foundations

This work belongs before a broad launch rather than near the end.

1. Publish a Privacy Policy, Terms of Use, support contact, and account-deletion request page on `cbcjournal.cc`.
2. Add in-app account deletion, and define what happens to journals, backups, logs, and Firebase identities.
3. Define data retention, export, backup retention, and deletion timelines.
4. Complete Google Play Data safety declarations from the actual implementation, not assumptions.
5. Configure the initial store availability for the Philippines and a minimum registration age of 13. Users aged 13-17 are still minors, so child/youth privacy and platform requirements remain in scope.
6. Formally assign the production system to either the developer or City Bible Church. The current preference is CBC ownership. If approved, migrate or share control of the developer, Firebase, Cloudflare, domain, Apple, and recovery accounts and give at least two trusted administrators secure recovery access.
7. Record an incident-response and user-contact procedure.
8. Because the intended audience includes users aged 13-17, create age-appropriate privacy information and review every SDK, authentication method, analytics tool, and notification workflow for child-audience restrictions. Add a neutral date-of-birth or age screen if required by the final SDK and policy design; do not encourage users to misstate their age.
9. Define how consent and guardian involvement will work for minor users, with Philippine privacy/legal review before public production release.

### Signup and privacy experience

Before account creation, the app and web client will:

1. Show a short, age-appropriate summary explaining that CBC Journal stores account details, journal entries, reading progress, and synchronization data on CBC-operated systems and protected backups.
2. Link to the complete Privacy Notice and Terms of Use.
3. Require separate unchecked confirmations that the user is at least 13 and agrees to the Terms while acknowledging the Privacy Notice.
4. Treat Google or email sign-in only as authentication, not as privacy consent.
5. Keep optional consent separate from core-service acceptance. Daily reminders and CBC announcements will have independent controls and contextual permission requests.
6. Keep the Privacy Notice and Terms accessible later from Settings.
7. Record the accepted Privacy Notice and Terms versions, timestamp, user ID, and acceptance method in the backend.
8. Never pre-check acceptance, infer it from navigation, or use a single blanket statement to authorize unrelated processing.

The exact guardian-consent design for users aged 13-17 remains subject to CBC policy and Philippine privacy/legal review.

Cloudflare manages the TLS certificate for the public hostname. Google Play and Apple manage app-signing certificates through their respective release systems. There is normally no separate generic certificate document to publish.

Exit gate: policies match real data handling, account deletion works, store declarations are accurate, and ownership/recovery responsibilities are clear.

## Priority 3: Android reliability and UI/UX

1. Fix correctness and reliability issues before visual polish, starting with streak reconciliation and misleading generic login errors.
2. Review navigation, empty/loading/error/offline states, typography, touch targets, dark mode, and accessibility.
3. Test fresh install, upgrade, sign-in methods, session restoration, offline use, reconnection, background/foreground transitions, and multiple Android versions.
4. Add privacy-conscious crash reporting and release health monitoring.
5. Use closed testing for regression testing, then a staged production rollout with a rollback plan.

Keep the existing Android package name `com.anonymous.Journal` for upgrade continuity. A more polished identifier can be used for a new iOS bundle ID, but changing the published Android ID would create a different Play app.

Exit gate: the closed-test build is stable, accessible, sync-correct, and has acceptable crash-free usage.

## Priority 4: Web application

1. Build an authenticated journal companion; the existing church website remains the public church site.
2. Reuse the Expo/React Native business logic, API client, validation, and state where practical; design a responsive web-specific interface rather than forcing the phone layout onto desktop.
3. Start with a static Expo web build on Cloudflare Pages at `app.cbcjournal.cc`. This avoids making the frontend depend on the home PC.
4. Configure strict backend CORS, a Content Security Policy, secure authentication storage, and XSS/CSRF protections appropriate to the chosen session design.
5. Test keyboard navigation, screen readers, responsive layouts, browsers, offline/error behavior, and account lifecycle flows.

Exit gate: the web threat model is reviewed, authentication and account deletion work, and the site passes accessibility and cross-browser checks.

## Priority 5: Notifications

1. Implement private daily reminders as local on-device notifications so they continue during backend outages.
2. Implement church announcements as remote push notifications, with authorization restricted to approved CBC administrators.
3. For native apps, evaluate Expo Push Notifications as the initial abstraction over FCM and APNs.
4. Store device tokens separately from user accounts, and support token rotation, invalid-token cleanup, delivery receipts, preferences, time zones, and quiet hours.
5. Ask permission in context and make every nonessential notification opt-in and configurable.
6. Treat web push as a separate implementation using HTTPS and a service worker; do not assume the native Expo notification implementation covers web.

A custom domain is not required for Android or iOS push notifications. HTTPS is required for normal production web-push service workers, and the existing domain satisfies that foundation.

Exit gate: notification consent, preferences, delivery, invalid-token cleanup, and opt-out behavior are tested without exposing private journal content.

## Priority 6: iOS application

This phase is intentionally deferred until CBC has an Apple Developer account and a path to Mac-based testing. Android and web work can proceed independently.

1. Use an iOS `.ipa`/App Store build, not an APK.
2. Create an Apple bundle identifier, Firebase iOS app, and `GoogleService-Info.plist`.
3. Audit platform-specific UI, permissions, authentication, secure storage, notifications, and privacy declarations.
4. Plan for Apple's login-service rules because the app offers Google sign-in.
5. Use EAS Build for cloud builds. An iOS Simulator build still needs a Mac with Xcode to run; use TestFlight on real iPhones for broader testing.
6. Enroll in the Apple Developer Program or determine whether the church qualifies for a nonprofit fee waiver.

Exit gate: real-device TestFlight testing, Apple review requirements, authentication, deletion, sync, and notifications all pass.

## Priority 7: Launch and ongoing operations

Android may launch before iOS; simultaneous release is not required unless it is a product decision.

Before production:

- Meet every earlier exit gate.
- Freeze and verify the release candidate.
- Verify store listings, screenshots, privacy URLs, support contact, and reviewer access/instructions.
- Complete a final backup and restore check.
- Load-test realistic traffic and define capacity limits for the home PC and internet connection.
- Use a staged rollout, monitor errors and sync behavior, and keep a rollback path.
- Establish an update cadence, support workflow, incident owner, and future migration trigger for managed hosting.

## Remaining decisions

1. Will CBC formally own the production accounts and data, and which two people will hold administrative and recovery access?
2. What consent or guardian process will CBC use for registered users aged 13-17?
3. Who may send church announcements, and will they be global or targetable to specific groups?
4. When iOS becomes a priority, will CBC pursue an Apple nonprofit fee waiver and acquire access to a Mac for simulator and release testing?

## Next-session handoff

Start with the prompt in [next-session-prompt.md](./next-session-prompt.md). The first deliverable should be an evidence-based backend/security audit and prioritized remediation plan. Diagnose first; implement only after the findings and scope are clear.
