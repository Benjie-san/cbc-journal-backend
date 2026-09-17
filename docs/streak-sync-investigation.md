# Streak synchronization investigation

## Reproduction evidence

The streak is calculated and persisted by the Expo client, not by the journal
API. In `journal/src/store/streakStore.ts`, `bootstrapFromServer` currently
does this:

```ts
const state = get();
if (!state.hydrated) {
  await get().hydrate();
}
```

The `state` object is captured before the asynchronous hydration completes. If
AsyncStorage contains a valid local streak of 16 days, the captured state can
still contain the initial values (`currentStreak: 0`, `longestStreak: 0`, and
`lastJournalDate: null`). When `/me` returns the older server value (for
example, current streak 2), the comparison sees no local date and selects the
server value. The local 16-day streak is therefore overwritten and then
persisted as 2.

This reproduces deterministically with the observed ordering:

1. Initial Zustand state: `0 / 0 / null`, `hydrated: false`.
2. AsyncStorage hydration completes: `16 / 16 / 2026-09-16`.
3. The in-flight bootstrap continues using the pre-hydration snapshot.
4. Server returns `2 / 16 / 2026-09-16`.
5. The stale comparison chooses the server state and persists current streak 2.

The initial investigation was performed from the backend workspace. During the
parent audit, the narrowly scoped client correction was applied directly to
`journal/src/store/streakStore.ts` without changing the backend or live data.

## Applied client correction

After awaiting `hydrate`, re-read the store before comparing values:

```ts
if (!get().hydrated) {
  await get().hydrate();
}
const state = get();
```

The stale `const state = get()` was moved below the await. No backend streak
workaround was added: the API currently stores client-derived stats, and
changing that contract without the app would risk discarding offline entries.

## Verification

- `node scripts/reproduceStreakBootstrapRace.js` reproduced the old `16 -> 2`
  path and verified that reading state after hydration preserves 16.
- `npx eslint src/store/streakStore.ts` passed with no findings.
- `git diff --check` passed for the focused change.
- The project-wide `npx tsc --noEmit` remains red because of pre-existing
  errors in unrelated authentication, routing, editor, Firebase, database, and
  journal-store code. It reported no error in `streakStore.ts`.
- Real-device verification passed on 2026-09-17. The development build retained
  a streak of 3 through repeated refreshes, a full app close/reopen, offline
  launch, reconnection, synchronization, and another online restart.

## Regression coverage to add in the Expo project

- A hydrated local 16-consecutive-day streak survives bootstrap against an
  older server current streak of 2.
- Multiple entries on one local calendar day count once.
- Deleted entries do not count; restoring one makes that day count again.
- ISO timestamps around local midnight use the device's local calendar day.
- Merging server entries in either order and repeating the merge is
  idempotent, with no duplicate local rows or streak changes.

The future client test suite should also assert that the corrected bootstrap
sets `source` to `local` when the local state is newer/better and attempts the
normal deferred server sync only after backend readiness. The client currently
has no automated test runner configured, so adding that suite is tracked
separately rather than expanding this two-line correction with a new framework.

## Additional audit observations

- `POST /me/streak` accepts client-derived counters and uses last-write-wins.
  This is not the cause of the 16-to-2 hydration race, but two devices can
  still overwrite one another if deferred `syncToServer` calls complete out of
  order. The client fix should be followed by serialized/versioned streak
  writes or server-side derivation from journal dates.
- `computeStreaks` correctly de-duplicates entries by local `YYYY-MM-DD` key
  and ignores soft-deleted entries. The Philippines has no daylight-saving
  transition, but the date-key and `diffDays` behavior should still be covered
  with a fixed timezone in tests.
- The journal API returns all active and deleted entries during sync, and the
  local database upsert preserves `passageRef`; no live database changes were
  made during this investigation.
