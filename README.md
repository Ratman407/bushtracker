# BushTrack V0.3 — Field Test

BushTrack is a walking-powered hunting, fishing and exploration game prototype designed to run as a free iPhone Home Screen web app.

## V0.3 game loop

- Your real iPhone steps advance whichever trail/objective you mark active.
- Main hunts start from sign rather than guaranteeing a trophy animal.
- Reaching sign reveals a random group: does/hinds, young animals, average males, mature animals, occasional trophies, and sometimes another species mixed in.
- Pick an animal, then choose a short/risky, medium, or long/downwind approach. The approach itself costs real steps.
- Animals can bust you. Missed opportunities can become recurring known animals.
- Marginal shots create a 1,100–3,200 step recovery trail instead of an instant result.
- Calls can move your target closer, do nothing useful, or reveal another species.
- While following one objective you can bump fresh pig/goat/deer/rabbit sign and decide whether to chase it or stay on plan.

## Fishing V0.3

- Permanent fishing spots can be discovered and revisited.
- A fishing visit gives 10–20 usable casts before the next cast eventually buries in a snag and ends the session.
- Each cast can be empty or produce any species/size available at that water.
- The game strongly biases a session toward at least one fish before the snag.
- Trophy-class fish trigger a simple tension/fight mini-game.
- Lures can be lost when the final snag ends the session.
- Fishing pressure builds after a session and fades with time/rain.
- Weather, lure choice, rod upgrades and fieldcraft affect fishing.
- After a session, another visit requires a real walk back to the spot.

## Persistent country

Possible permanent discoveries include:

- shallow creek and deep timber hole
- farm dam
- game trail
- wallow
- rabbit warren
- old hut
- open ridge
- creek crossing
- campsite
- back-block access later in progression

Old huts can contain tackle or other useful finds. Creek exploration can also turn up bait or old tackle.

## Trail cameras and yabby nets

- Place a camera at suitable permanent locations.
- Leave it at least another claim/day, then walk back in to check it.
- Cameras can be blank, show ordinary animals, or relocate a known animal.
- Set yabby nets at suitable water.
- Leave them soaking, then physically walk back the next day to check them.
- Nets can be empty or produce yabbies, XP, game cash and some bait.

## Recurring animals and fieldcraft

- Mature/rare animals can become named individuals such as a split-tine buck or scarred boar.
- If they escape, they stay in the Known Animals list and can show up again on sign or trail cameras.
- Very rare fallow colour variants are possible.
- Fieldcraft knowledge builds by actually tracking/catching species and gradually improves clues/identification.
- Binocular upgrades also reveal more before you commit.

## Progression

- Quiet boots: reduce approach spook risk.
- Better binoculars: better pre-shot animal assessment.
- Better scope: larger timing window in the shot mini-game.
- Better rod/reel: easier trophy fish fights.
- Field pack: better odds of useful exploration finds.
- Game call: unlocks one call attempt per main hunt.
- Back-block ute access: later unlock that opens more remote country while keeping all hunting itself step-powered.
- Camps can be established as permanent remote bases.
- Remote/back-block hunts are longer and can include red deer.

## Seasons, weather and journal

- Australian seasons are used.
- Daily simulated weather and wind affect parts of hunting/fishing.
- Autumn improves the odds of better red stags in the back block.
- Every meaningful event is stored in the Field Journal.
- Standout animals/fish go into the Trophy Cabinet and personal bests are tracked.

## Existing V0.2 save

V0.3 looks for the old `bushtrack-v01`/`bushtrack-v02` browser save and migrates the important progress automatically, including XP, cash, current hunt distance, river progress, trophies and journal entries.

Do not clear Safari website data if you want to keep the existing prototype save.

## Updating the existing GitHub Pages site

The current site URL can stay exactly the same, so the iPhone Shortcut does **not** need to change.

Replace the old repository files with the contents of this folder, including the renamed `app-v03.js` and `style-v03.css` files.

After GitHub Pages deploys, open BushTrack. The header should say **V0.3 FIELD TEST**. The new service worker uses a new cache and network-first updates, but an already-installed Home Screen app may need to be fully closed and reopened once or twice before the new service worker takes control.

## Shortcut

The existing shortcut remains:

`https://ratman407.github.io/bushtracker/?steps=[Rounded Number]&claim=1`

No change required.
