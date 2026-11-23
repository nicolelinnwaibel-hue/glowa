# Venue step

Branch `glowa-rebuild-guest-arrival`, staging only. Built from Coda's briefs (22 Nov). The approved design
(b8c195d4…, revision 4) is on Nicole's MacBook and could not be opened from this build session, so the look
needs checking against it.

- A "Pick your venue" button in the top bar opens the venue panel.
- Five venue types: beach, winery, castle, forest, desert. The plot changes to match; castle draws the castle at
  the back of the plot and turns the paths to stone.
- Date or season is one choice: an exact date shows as `2027-06-12`, a season as `Castle · Autumn 2027`.
- "Finalise venue" completes the planner's Book venue quest once (+100 XP). Undo (or "Reopen to make a change")
  reopens it and takes the XP back. Finalising again gives the 100 XP back, never a second 100.
- While finalised, the type and date are locked. Reopening is refused, with the reason, if a later quest that
  needs the venue (for example Book caterer) is already done.
- Every change can be undone; the last change is saved and survives a reload.
- Nothing contacts a venue, prices anything, books anything or sends anything. The panel says so.
- The venue has its own save (`glowa-venue-v1`). The quest and XP live in the planner's save, so the classic
  planner shows the same result.
- `game.js` now runs its classic-page code only on the classic page, so the world screen can use its quest rules.

Checks: `node venue.test.js` (new), plus the existing suites. Browser results are in the commit report.
