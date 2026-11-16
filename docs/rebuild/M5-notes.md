# Rebuild M5: speech bubbles, mood, pause and snacks; less crowding on a phone

Branch `glowa-rebuild-guest-arrival`. Nothing here is live.

## What a player sees

1. **Speech bubbles.** Once everyone is in, a guest now and then says something: "I'm hungry!", "When are we
   eating?", "Where's the bar?", "Is there an open bar?", "Let's party!", "I wanna get crunk!". At most three
   bubbles show at once, each for about four seconds. A guest stands still while their bubble is showing.
2. **Guest mood**, top of the screen: a bar, one or two words (Content, Getting peckish, Hungry, Happy, Paused)
   and the cause in a sentence, for example "Guests are getting peckish. Serve snacks to cheer them up."
3. **Serve snacks.** Puts the mood straight back to full, changes the cause to "Snacks are out. Everyone is
   happy.", clears any bubble asking for food, and keeps the mood full for three minutes. After snacks the
   bubbles say "Yum!", "Cheers!" and "Now this is a party."
4. **Pause and resume.** Pausing stops the mood, the bubbles and the wandering. The meter says "Paused. Nothing
   changes until you press play."

## Rules, as decided by Nicole

- **The mood falls only while a need is unmet**, and slowly: ten points a minute, about seven minutes from full
  to its lowest.
- **It never falls while paused or while the game is closed.** The mood runs on the game's own clock, which only
  moves while the game is open, visible and not paused. One tick never counts for more than a second, so a
  sleeping tab cannot drain it. The save holds that game clock and no date or time of day, so there is nothing
  to catch up from after a long absence.
- **There is no losing.** The mood stops at 30 and never reaches zero. Snacks always restore it.
- **Nothing shames a player.** Every message about an unmet need says how to fix it; a test checks the wording
  for blaming words.
- It is one shared, made-up party mood. It is not worked out from anything about a real guest.

## Crowding at the gate on a phone

- Guests now come through the gate in **three lanes in turn** and go **straight to their own spot** once through,
  where before they all walked one line to the same point on the plaza.
- Guests in a row are at least 24 plot pixels apart at the gate, for any list size. The shortest gap between
  guests is 160 ms (it was 90 ms), so a very long list takes longer to walk in; "Skip" is still there.
- **On a phone, guests are drawn smaller as the list grows**: the artboard's size up to 40 guests, then smaller
  up to 90, then smaller again. The tap area stays 44 px. Laptop size is unchanged.

## Bubbles and the plot's buttons

- A guest may speak only if a bubble above them would cover none of the plot's buttons (the gate, the guestbook
  and the three locked objects). Bubbles also never take taps.
- A bubble may sit over a lock badge, which is not a button.
- On a phone bubbles are a little smaller, and fewer guests are free to speak when the view is zoomed far out.

## Other details

- The mood box appears once an arrival has finished, so it never competes with the arrival count.
- The mood and the pause state are saved with the world's own save (`glowa-world-v1`), beside the camera. The
  guestbook's and the planner's saves are untouched.
- With Reduce Motion on, bubbles appear without the pop.

## Not done

- A real-phone check of speed and of how the crowd looks.
- Food, the bar, music and seating as real things to plan: the snack button is this version's one way to meet a
  need, as decided.

## Checks

- `node world.test.js`: gate lanes and spacing, avatar size on a phone; mood falling, the floor, snacks, pause,
  long gaps, saving without a date, damaged saves, wording; bubbles never more than three, one a guest, no
  repeated line, the right lines before and after snacks; bubbles off the buttons at four screen sizes and three
  zoom levels.
- `node guests.test.js` and `node game.test.js` unchanged and passing.
- Browser, 1280 x 800 and 390 x 844, real clicks and taps, 144-person sample: mood hidden with no guests and
  during arrival; over 40 seconds, at most three bubbles at once, all six lines seen, and no bubble overlapping a
  button (measured from the real rectangles each second); mood 92.7 after 44 game seconds; paused for 6 seconds
  with no change in level, clock or positions; still paused after a reload; snacks restored 100 and cleared the
  hungry lines; five seconds away on another page changed nothing. No page errors.

Screenshots: `m5-desktop-mood.png`, `m5-phone-mood.png`, `m5-phone-gate.png`, `m5-desktop-gate.png`.
