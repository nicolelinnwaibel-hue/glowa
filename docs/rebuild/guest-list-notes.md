# Guest list: the bench, delete with a whoosh, back from the bench, undo, counts

Branch `glowa-rebuild-guest-arrival`, staging only.

Built from Coda's written briefs (19 Nov, 22 Nov, 23 Nov). The approved design artifact (b458ac9e…, revision 2,
and the motion frames v3) is on Nicole's MacBook and could not be opened from this build session, so wording and
motion follow the briefs; the visual details need checking against that design.

## What a player can do

- **Bench a guest** with one tap on "Bench" beside them in the guest list, or "Move to the bench" on their card.
  They sashay to the velvet-rope lounge just below the plot ("The maybe list"). Toast: "On the maybe list,
  darling." with Undo.
- **Bring them back** with one tap on "Back". They do a "Make room!" hop back to their own spot on the plot.
- **Delete** from the card: the guest spins and whooshes away. Toast: "Off you go, Cleo!" with Undo.
- **Undo**: every toast has Undo for 8 seconds. The last change also stays in the guest list ("Last change: …
  Undo") until the next change, and it is saved, so Undo still works after a reload.
- **Counts**: "144 guests · 142 on the plot · 2 on the bench", and filters Everyone / On the plot / On the bench.

## Rules

- A host takes the plus-one they brought to the bench and back. A plus-one can be benched on their own.
- A benched guest keeps everything else: look, links, code, plus-one. Benching is not deleting and not a "no".
- Benched guests do not walk in, wander, speak, or count towards the mood.
- New guests from an import go to the plot; re-importing an export does not move anyone off the bench.
- Reduce Motion: every move is a quick fade, and the toast is the label change.
- Not in this build, as agreed: RSVP "no", the plus-one switch, contact details.

## Checks

- `node guests.test.js`: bench and back (host with plus-one, plus-one alone, linked companions stay), counts,
  a round trip changes nothing else, undo of bench and of delete, undo after a reload, damaged undo saves,
  bench surviving reload, import and re-import.
- `node world.test.js`: a seat for every benched guest (1 to 144), all off the plot and on the bench island, in
  view without panning at three screen sizes.
- `node game.test.js` unchanged.
- Browser at 1280x800, 390x844, and 390x844 with Reduce Motion: see the commit report.
