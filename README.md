# ⚽ Golazo Skills

A soccer skills tracker for the whole family, built for an iPad. It's a web app (PWA): there's nothing to compile and no App Store, and it runs full screen once it's added to the Home Screen.

## What it does

- **Who's training?** Each family member has their own player profile with a custom shirt (name, number, kit colors). Scores, records, levels and streaks are tracked per player.
- **Two challenges:**
  - ⏱️ **Beat the Clock**: how many reps in 1:00? When time is up, type the number of reps on a big keypad.
  - 🏁 **Race to 50**: how fast can you do 50 reps? Tap the big button when you're done.
- **A full-screen start button with the clock inside it.** It's green (a soccer pitch) before the start and turns red while the clock runs. There's an optional 3-second get-ready countdown, a referee whistle and beeps.
- **🎤 Counts reps by sound:** for moves like Wall Passes, the iPad's microphone hears each time the ball hits the wall and counts it. In Beat the Clock the count is filled in for you to check, and Race to 50 stops by itself on the 50th hit. You can turn this on for any move, and there's a microphone test with a sensitivity setting in Parent Corner.
- **The screen stays awake** during a round (Screen Wake Lock, plus a silent video fallback for older iPadOS).
- **Records and celebrations:** confetti and "GOOOOL!" for a new personal best, plus levels from 🌱 Rookie to 🐐 G.O.A.T.
- **Progress:** a chart and history for every move, and a family 🏆 Trophy Room that compares records.
- **Add players** right from the "Who's training today?" screen with the ➕ tile, edit a player's name or shirt with ✏️, and use **👥 Switch player** to go back to the player list.
- **Parent Corner** (press and hold ⚙️ for 1.5 seconds): edit or delete players, add or edit moves, change the rules (clock length, race target, countdown, sound), and back up or restore data.

All data stays on the iPad (no accounts, no server). Use **Parent Corner → Save backup** now and then.

## Putting it on the iPad

1. Publish the repo with **GitHub Pages**: Settings → Pages → *Deploy from a branch* → pick the branch and `/ (root)`.
   (Pages on a free GitHub plan requires a public repo. Netlify or Cloudflare Pages also work: just drag in the folder.)
2. Open the Pages URL in **Safari** on the iPad.
3. Tap **Share → Add to Home Screen**.
4. Open it from the Home Screen icon. It runs full screen and works offline.

Tip: turn the iPad's silent switch off (or turn up the volume) to hear the whistle.

## Running it locally

Any static file server works, for example:

```sh
npx http-server . -p 8080
```

Then open http://localhost:8080.

## Files

| Path | What |
|---|---|
| `index.html` | App shell |
| `css/styles.css` | All styling (blaugrana theme) |
| `js/app.js` | All app logic: views, timer, storage, charts |
| `js/hit-worklet.js` | Microphone hit detector (runs on the audio thread) |
| `sw.js` | Service worker for offline use |
| `manifest.webmanifest` | Home-screen app settings |
| `assets/` | Icons and the tiny keep-awake video |

When you change files, bump `CACHE` in `sw.js` (e.g. `golazo-v2`) so installed copies pick up the update.
