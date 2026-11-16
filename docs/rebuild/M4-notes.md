# Rebuild M4: tap a guest, change their look, find them from the list

Branch `glowa-rebuild-guest-arrival`. Nothing here is live.

## What a player can do

1. **Tap a guest on the plot.** A ring appears under them, their name appears above them, the camera slides over,
   and their card opens. They stand still while their card is open (their host or plus-one waits with them).
2. **Change them on the card.** Name, hair (Short, Bob, Long, Bun, Top hat), hair colour, outfit colour, skin
   tone, a playful label "just for fun", group and companion. Looks change on the avatar at once.
3. **Reach their plus-one.** A host's card has a "Their plus-one" button that opens the plus-one's card and
   highlights them; a plus-one's card has a button back to their host. A plus-one can be given any outfit colour
   and can always go back to plus-one mint.
4. **Find someone from the list.** Tapping a name in the guest list slides the camera to that guest, highlights
   them and opens their card. On a laptop they are shown left of the panel; on a phone, above the bottom sheet.
5. **Leave whenever.** Looks save as they are tapped. A name, group or companion that was typed is kept when the
   field is left, when Enter is pressed, when "Done" or "Back" is tapped, and when the panel is closed with the X
   or Escape.

## Rules worth knowing

- **A look belongs to the guest's id.** It survives renames, search, reloads, and export followed by re-import.
- **Only the offered choices are accepted** for hair, colours and the label. Anything else is refused and changes
  nothing. Colours never come from free text.
- **Tap size.** Each guest's tap area is at least 44 px, measured in the browser at both sizes, however far the
  view is zoomed out.
- **Overlapping guests.** A tap goes to the guest in front. Someone hidden behind others is reached from the
  list, which is also the route for keyboard and screen-reader users: guests on the plot are left out of the Tab
  order so 144 stops do not bury the other controls.
- **A guest still walking in** who is picked is brought straight to their spot and counted.
- **The playful label** is a made-up game label, said so on the card. It is not exported.

## Changed from M3

- The plot can now be dragged a little further, far enough to bring any corner to the middle of the screen. Part
  of the plot always stays on screen.
- "Save changes" on the card is now "Done": nothing waits for a save button any more.

## Fixed on the way

- **A tap could be lost.** Typing a name and then tapping a button redrew the card under the player's finger, so
  the button did nothing. Leaving a field no longer redraws the card.

## Known gaps

- With the Guestbook open on a laptop, the panel covers the zoom buttons. The wheel, pinch and + / - keys still
  zoom.
- 144 guests crowd the plot on a phone, so tapping one particular person there is hit and miss; the list is the
  reliable way to find someone.

## Checks

- `node guests.test.js`: look choices and their names, changing one part of a look, refusing anything not
  offered, plus-one outfits, the playful label, looks surviving rename, reload and re-import.
- `node world.test.js`: the camera bringing a guest clear of the panel at three screen sizes, and a selected guest
  (with their host or plus-one) standing still while everyone else wanders.
- `node game.test.js` unchanged and passing.
- Browser, 1280 x 800 and 390 x 844, real clicks and taps, 144-person sample: 144 tappable guests, smallest tap
  area 44 px; finding "Omar Dubois" from the list showed him on screen, clear of the panel, with ring and name;
  hair, outfit and label changed on the avatar at once; a name typed and then closed with Escape was kept; a tap
  on the plot opened the card of the guest in front; a plus-one was added, opened, renamed and restyled; after a
  reload everything was as left, with no arrival replay; a drag did not open a card. No page errors.

Screenshots: `m4-desktop-card.png`, `m4-phone-card.png`.
