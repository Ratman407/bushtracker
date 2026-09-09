# BushTrack V0.6 — Field Loadout Test

V0.6 keeps the V0.5 persistent-world/save backend and adds the first realistic hunting logistics layer: rifle/loadout choice, persistent ammunition, fatigue, glassing, recovery quality, remote-camp food, hide/meat economy and pressure-based yabby trapping.

## Main hunting changes

- Field outings now have a persistent **base, rifle, loaded ammo, spare ammo, binocular choice, fatigue, route-back distance and carried haul**.
- Prototype rifles:
  - `.22 LR` — light small-game setup.
  - `.44 lever action` — 10-round capacity, short practical game range; designed to force close stalks.
  - `.30-06 bolt rifle` — heavier, 5-round capacity, longer practical game range.
  - `.223 bolt rifle` — purchasable later through the game economy.
- Rifle weight does **not delete real Health steps**. Instead it increases field fatigue. Fatigue and shooting support make the shot mini-game harder/easier.
- If the animal is beyond the chosen rifle's practical game range, BushTrack makes you **stalk closer** rather than pretending every rifle is identical.
- Ammunition is persistent. A shot removes a round. You can reload from carried spare rounds, continue following other sign while ammo remains, or walk back to camp when you run dry.
- Returning to camp unloads the field haul, returns unused ammo to that camp's stores and resets fatigue.

## Recovery & economy

- Animal recovery now produces **usable meat, bait scraps and a hide condition/value** instead of paying cash automatically.
- Weapon choice affects recovery. A rabbit hit with the `.44` or `.30-06` is treated as severe overkill and can leave almost no usable carcass/hide.
- Hides are stored when you return to camp and can be traded for cash.
- Stored meat can be sold in small batches, kept as camp food, or used when packing remote camps.
- Recovered meat scraps (or usable meat if necessary) can bait yabby nets.

## Glassing

- Open ridges now have **Glass the country**.
- You must have binoculars in the current field loadout.
- Glassing gives imperfect species/sex/quality/distance information based on binocular level rather than guaranteed exact animals.
- You can leave the ridge and create a real walking stalk toward an animal you spotted.
- Glassing can occasionally reveal useful permanent landmarks too.

## Remote camps

- Camps are permanent map locations once established.
- A remote camp gets its own stores and can become your active base.
- Remote camps consume about **1.2 kg of food value per occupied game day** in this prototype.
- Yabbies can also be consumed as food if the camp is short on meat.
- If a remote camp runs out of food it becomes inactive and BushTrack returns operations to Main Camp until the camp is resupplied.
- Gear/ammunition stored at a remote camp does not magically become available at Main Camp.

## Yabby traps

- Setting a net now consumes meat/scraps as bait.
- Catch quantity is random and **can be zero**.
- Fresh, lightly trapped water has better odds and potentially bigger catches.
- Repeatedly trapping the same spot increases trap pressure; leaving it alone lets pressure recover over time.
- Checked yabbies go into the field haul. They can later be eaten or used as **Yabby bait** in fishing sessions.
- Yabby bait is consumed per cast and improves catch odds at current prototype fisheries.

## Existing V0.5 systems retained

- Incremental Health step claiming.
- Rotating backups, export/import, checksums, atomic saves and last-known-good recovery.
- Persistent animals and known-animal wariness.
- Weekly Trail Conditioning and weekly Momentum.
- Event queue, diagnostics, update handling and self-tests.
- 10–20 cast fishing sessions with random catches and a session-ending snag.
- Persistent locations, cameras, side encounters and branching trails.

## Migration / safety

V0.6 uses a new Safari save key: `bushtrack-v06`.

On first launch it migrates the existing V0.5 save while leaving `bushtrack-v05` untouched as a fallback. Existing XP, step ledger, weekly baseline, hunt progress, map, trophies and persistent animals are preserved.

An in-progress V0.5 hunt migrates into V0.6 with a temporary `.30-06` field-test loadout (5 loaded + 5 spare) so the current hunt can continue without throwing away today's progress. Return to camp before choosing a different loadout.

The package also keeps the V0.5 and V0.4 code fallbacks:

- `fallback-v05.html`
- `fallback-v04.html`

## iPhone Shortcut

**No change required.** Keep using:

`https://ratman407.github.io/bushtracker/?steps=[Rounded Number]&claim=1`

Incremental claiming still only credits the increase above the highest Health total already seen that day.

## Uploading to GitHub Pages

Upload **all files** in this package to the existing `bushtracker` repo. Keep the V0.5/V0.4 fallback files included in the zip. You can delete obsolete V0.5 main-shell duplicates only if they are not part of this package; the included `app-v05.js` and `style-v05.css` are intentionally retained for `fallback-v05.html`.

After deployment the header should read **V0.6 FIELD LOADOUT TEST**.
