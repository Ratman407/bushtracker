# BushTrack V0.2

A cheap proof-of-concept iPhone web app for the walking-powered hunting/fishing idea.

## What is in V0.2

- Starts with a fallow buck about 10,000 steps away.
- Enter the steps shown by the iPhone at the end of the day.
- Partial progress carries over. If you do not catch the animal, its overnight movement shifts the next intercept slightly in your favour.
- After enough hunting progress you discover a shallow creek as a side trail.
- You can make either the deer trail or creek your active objective before the next day's step claim.
- Following the creek far enough discovers a permanent deep fishing hole.
- Reaching the deer unlocks a simple shot mini-game. Extra steps beyond the intercept can give a closer shot.
- Deep hole has a simple once-per-day fishing encounter.
- XP, cash and trophies are stored locally on the phone/browser.
- No login, ads, server or tracking.

## Fastest way to put it on an iPhone

This is a static web app, so it only needs simple HTTPS hosting. A free static host such as Netlify Drop, Cloudflare Pages or GitHub Pages will work.

1. Upload the contents of this folder to a static web host.
2. Open the resulting HTTPS address in Safari on the iPhone.
3. Safari Share button -> Add to Home Screen.
4. Open BushTrack from the new Home Screen icon.

Once it has loaded successfully, the service worker caches the prototype for basic offline use.

## Step entry and iPhone Shortcut

Manual entry still works, but V0.2 can also accept today's total from an iPhone Shortcut.

- `?steps=5820` prefills 5,820 steps and waits for you to tap **Claim steps**.
- `?steps=5820&claim=1` imports 5,820 and claims it automatically.
- The app still only allows one claim per calendar day, so re-running the Shortcut cannot double-spend the same day's steps.

### Build the Shortcut on the iPhone

After GitHub Pages is live, make a Shortcut called **BushTrack Steps**:

1. **Find Health Samples**
   - Type: **Steps**
   - Filter: **Start Date is Today**
2. **Calculate Statistics**
   - Operation: **Sum**
3. **Round Number**
   - Round to: **Ones**
4. **Text**
   - Put your GitHub Pages address followed by `?steps=`
   - Insert the **Rounded Number** magic variable
   - Add `&claim=1` after it
   - Example: `https://YOURNAME.github.io/bushtrack/?steps=[Rounded Number]&claim=1`
5. **Open URLs** using the Text from step 4.

The first time it runs, iOS may ask permission for Shortcuts to read Health data.

This lets the phone do all step counting in the background. At the end of the day you run one Shortcut and BushTrack receives the total.

## Data

Progress is stored in browser localStorage. Clearing Safari website data, changing browsers, or deleting site data will wipe the prototype progress.
