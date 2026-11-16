# Rebuild M2: real guest list (import, roster, export, saving)

Branch `glowa-rebuild-guest-arrival`. Nothing here is live.

## What a player can do

1. Open the Guestbook from the gate, the guestbook, the "Invite your guests" point or the guest chip.
2. Bring a CSV or Excel (.xlsx) file, use the 120-guest sample list, or type names by hand.
3. Match columns: Guest name, Last name if separate, Companion, Group. Any column names work; Glowa guesses, the
   player can change it. An Excel file with several sheets asks which sheet.
4. See a preview, the rows that will be skipped and why, and names that appear twice, with "Merge them" or
   "Keep both".
5. "Open the gates" puts the guests in the guestbook. (They do not walk in yet: arrivals are M3.)
6. In the list: search by name, group or code; add; edit name, group and companion; remove with Undo; export CSV;
   import more; remove everyone (asks first, with Undo).

## Rules worth knowing

- **Ids.** Every guest gets a permanent id (a UUID) and a short code (G-001). Nothing depends on row order or name.
- **Plus-ones are guests** (Nicole's decision). "Yes" or "+1" in the companion column gives the guest a plus-one
  who is a guest in their own right: own id and code, own place in the list straight after their host, counted in
  the total, and a distinct mint outfit colour so they are easy to spot. A companion named in the file who has no
  row of their own also becomes that guest's plus-one, under that name. A name that matches another guest on the
  list links the two instead, and adds nobody.
- **A plus-one stays with their host.** They can be renamed, edited, removed and brought back with Undo like any
  guest. Removing the host removes the plus-one they brought (Undo restores both). Removing the plus-one leaves
  the host. One guest cannot take another guest's plus-one.
- **Duplicates** are matched ignoring capitals, accents and extra spaces. Merging only fills gaps; it never
  overwrites what a guest already has.
- **Export and back.** The exported file includes the guest id, so bringing it back updates the same guests
  (edits made in the spreadsheet come in, looks and ids are kept) instead of doubling them. A plus-one's line
  says whose plus-one they are, so the list also comes back correctly on a new device.
- **Saving.** The guestbook has its own save (`glowa-guests-v1`), apart from the planner's and the world's. The
  spreadsheet itself is not stored, only the guests made from it. Nothing is sent over the network.
- **Limits.** 1,000 guests including plus-ones, 5,000 rows, 20 MB. Old `.xls` files are not read; the player is told to save as
  .xlsx or CSV.
- **Safety.** Guest text is always shown as text, never as markup. A cell that starts like a formula is exported
  with a leading apostrophe.

## Not in this step

- Guests walking in and wandering (M3), tapping a character and changing hair or outfit (M4), speech bubbles and
  mood (M5).
- Excel reading uses the browser's built-in decompression. A browser without it gets a message to use CSV.

## Checks

- `node guests.test.js`: CSV and Excel reading, column guessing, companions, duplicates, add, edit, search,
  remove and undo, export and re-import, saving and damaged saves, limits.
- Browser, 1280 x 800 and 390 x 844, real clicks and taps: a 122-row CSV (120 guests, one blank row, one repeat),
  search, edit, add, remove and undo, export, reload, re-import of the export, a two-sheet Excel file, an `.xls`
  and an empty file, remove everyone and undo. No page errors, no network requests other than loading the page.

Screenshots: `m2-desktop-match.png`, `m2-desktop-roster.png`, `m2-phone-match.png`, `m2-phone-roster.png`.
