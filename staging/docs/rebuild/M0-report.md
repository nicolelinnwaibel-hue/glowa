# Rebuild M0: artboard match and 120-character speed check

Branch `glowa-rebuild-guest-arrival`, cut from `main` at `2bfae96`. Nothing here is live.

## 1. Does the game match the artboard?

The world is built from the artboard's own values (the "Glowa: Guest Arrival" design, pages "1 The empty plot",
"2 Invite your guests" and their mobile versions): the same colours, plot geometry, object drawings, fonts
(Baloo 2 and Nunito), button shapes and panel layout. At 1280 x 800 the plot scale is 1.25 and at 390 x 844 it is
0.72, as on the artboard.

Screenshots from the game (not the artboard): `m1-desktop-plot.png`, `m1-desktop-guestbook.png`,
`m1-phone-plot.png`, `m1-phone-guestbook.png`.

Not done: a pixel side-by-side against the artboard PDF. I worked from the artboard's source, not the PDF, so
that comparison is still for Coda and Nicole to make.

Differences from the artboard, on purpose:

| Difference | Why |
|---|---|
| Zoom in, zoom out and centre buttons, bottom right | The artboard shows no zoom or pan control; the PRD requires them |
| "Classic planner" link, bottom left | Keeps the existing game and its saves reachable |
| Locked objects say "Quest coming later" only | The artboard's "Start quest" button has nothing to start yet |
| Guestbook controls are shown but switched off, with a note | Import is milestone M2; the overlay is M1 |
| Only about 12 standing characters sway at once | See the speed check below |

## 2. Do 120 characters run smoothly on a phone-sized screen?

Method: `index.html?bench=120` puts 120 wandering test characters on the plot and counts frames. Run in headless
Chromium **without a graphics card**, with the processor slowed to imitate a phone. These numbers are therefore
on the low side of what a real phone should do, but they are not a real-device test.

| Screen | Characters | Frames a second (average / lowest) | Slowest frame | Tap to next frame |
|---|---|---|---|---|
| Phone 390 x 844, processor slowed 4x | 120 | 57 / 53 | 67 ms | 26 ms |
| Phone 390 x 844, processor slowed 6x | 120 | 42 / 37 | 67 ms | 86 ms |
| Laptop 1280 x 800, no slowdown | 120 | 41 / 38 | 50 ms | 42 ms |
| Phone 390 x 844, processor slowed 4x | 300 | 17 / 13 | 117 ms | 109 ms |

Reading:

- **120 on a phone-sized screen: passes** at the 4x slowdown.
- **One fix was needed.** With every character swaying all the time the phone figure was 46 and the laptop 33.
  Limiting the sway to about 12 characters at a time brought the phone to 57.
- **Laptop at 41** is lower than I'd like. The test machine draws without a graphics card and the laptop screen
  has larger characters, so a real laptop should do better; this needs a real-device check.
- **300 characters do not run smoothly** with this renderer. If lists well above 120 matter, the characters
  should move to a single drawn canvas. The world rules are already separate from the renderer for that reason.

Characters are 39 x 50 px on the phone screen, close to the 44 px tap target. Tap handling for characters is
milestone M4.

Screenshots: `m0-phone-120.png`, `m0-desktop-120.png`.

## 3. Engine choice

No game engine was added. The world is plain HTML and CSS moved by the browser's own transitions, which matches
the artboard exactly, keeps every object a real button for keyboards and screen readers, and needs no build step
on GitHub Pages. Phaser or PixiJS were not benchmarked; the 300-character result is the point at which that
becomes worth doing.

## 4. Design gaps noticed (not fixed here)

- 120 characters crowd the plot on a phone at the artboard's character size; finding one person will lean on
  search and zoom (M4).
- The fonts load from Google Fonts, which is a request to an outside service on every visit.
