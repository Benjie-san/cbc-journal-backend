/*
 * Deterministic regression fixture for the client-side streak bootstrap race.
 *
 * Run with:
 *   node scripts/reproduceStreakBootstrapRace.js
 *
 * This intentionally models only the state ordering in the Expo store. The
 * executable fix and full regression suite belong beside the Expo store,
 * which is outside this workspace's writable root.
 */
const assert = require("node:assert/strict");

const localAfterHydrate = {
  currentStreak: 16,
  longestStreak: 16,
  lastJournalDate: "2026-09-16",
};
const initialState = {
  currentStreak: 0,
  longestStreak: 0,
  lastJournalDate: null,
};
const serverState = {
  currentStreak: 2,
  longestStreak: 16,
  lastJournalDate: "2026-09-16",
};

function chooseBootstrapState(state, server) {
  const localDate = state.lastJournalDate;
  const serverDate = server.lastJournalDate;
  const useLocal =
    (localDate && (!serverDate || localDate > serverDate)) ||
    (localDate &&
      serverDate &&
      localDate === serverDate &&
      (state.currentStreak > server.currentStreak ||
        state.longestStreak > server.longestStreak));
  return useLocal ? state : server;
}

// This is the pre-fix ordering: the state snapshot is captured before the
// asynchronous hydration completes, and proves the reported 16 -> 2 loss.
const staleResult = chooseBootstrapState(initialState, serverState);
assert.equal(staleResult.currentStreak, 2);

// This is the required post-fix ordering: state is read after hydration.
const hydratedResult = chooseBootstrapState(localAfterHydrate, serverState);
assert.deepEqual(hydratedResult, localAfterHydrate);

console.log("Reproduced stale bootstrap result: current streak 16 -> 2");
console.log("Verified post-hydration comparison preserves current streak 16");
