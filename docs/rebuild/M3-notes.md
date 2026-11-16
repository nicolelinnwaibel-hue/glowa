# Rebuild M3: guests walk in through the gate, then wander

Branch `glowa-rebuild-guest-arrival`. Nothing here is live.

## What a player sees

1. "Open the gates" closes the Guestbook, so the plot is in view.
2. Guests walk in **one at a time**: from outside the plot, through the gate, across the plaza, then to their own
   spot. A banner counts them as they pass the gate: "Guests arriving · 52 of 144".
3. When the last one is through, the banner says "All 144 guests have arrived" and goes away.
4. Everyone then wanders: a few at a time pick a nearby spot and walk to it.
5. **Plus-ones** wear their mint outfit on the avatar, arrive beside their host, and move only when their host
   moves, staying close.
6. "Skip" in the banner puts everyone on the plot at once. With the device's Reduce Motion setting on, nobody
   walks: everyone is simply there.

## Rules worth knowing

- **Pace.** One guest sets off at a time. The gap shrinks for a long list (350 ms for a few guests, 208 ms for
  120, never under 90 ms), so 120 are through the gate in about 25 seconds.
- **The count is real.** It goes up when a guest passes the gate, not on a timer, and never passes the total.
- **A guest's spot comes from their id**, so a reload does not shuffle the plot.
- **Arrivals are remembered.** Each guest is marked as arrived when they pass the gate, and that is saved with the
  guestbook. A reload with everyone in shows no banner and replays nothing. A reload part-way through puts the
  guests who had arrived on the plot and carries on the count from there ("41 of 144").
- **Later changes.** A guest added by hand walks in alone ("1 of 1"). Removing a guest takes their avatar off the
  plot (a host's plus-one goes with them); Undo puts them back where they stood, with no second arrival.
- Whether a guest has arrived is game state. It is not in the exported CSV.

## Fixed on the way

- **The screen could slide sideways.** When the Guestbook closed, keyboard focus went back to an object on the
  plot and the browser scrolled the whole screen to show it, cutting off the top bar. The stage can no longer be
  scrolled; only the camera moves the world.
- The note that pops up after an import now goes away by itself, so it does not sit over the zoom buttons on a
  phone.

## Speed check

`index.html?bench=120` still works and uses the same wandering code as real guests.

The test machine was replaced during this step and is slower than the one used for M0, so today's numbers
cannot be compared with the M0 report. On today's machine, at phone size with the processor slowed 4x, the M2
version and this version measured the same within noise: 21 to 26 frames a second for M2, 21 to 30 for M3, where
M0 had measured 57 on the earlier machine. This is a test browser with no graphics card. **A real-phone check is
still needed** before anyone relies on these numbers.

## Not in this step

- Tapping a guest, the name tag, and changing hair or outfit (M4).
- Speech bubbles and mood (M5).
- 144 characters crowd the plot on a phone at the artboard's character size. Zoom and pan help; finding one
  person is M4's job.

## Checks

- `node world.test.js`: arrival counts (one at a time, 1 to 144, additions and removals part-way, resuming after
  a reload), pace, the walk-in route, plus-one colour, plus-ones beside and near their host for 200 wander steps,
  arrivals surviving a reload.
- `node guests.test.js` and `node game.test.js` unchanged and passing.
- Browser, 1280 x 800 and 390 x 844, real clicks and taps, with the 144-person sample: the count rose by one at a
  time; a reload part-way carried on at 41 of 144; all 144 arrived with 24 mint avatars; a reload afterwards
  replayed nothing; adding one guest gave "1 of 1"; removing a host took two avatars off and Undo put both back;
  Skip and Reduce Motion each put all 144 on the plot at once. No page errors.

Screenshots: `m3-desktop-arriving.png`, `m3-desktop-arrived.png`, `m3-phone-arriving.png`, `m3-phone-arrived.png`.
