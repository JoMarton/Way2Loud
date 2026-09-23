# Way2Loud — POC Plan

## Context

A parent wants to help their child learn to speak at a normal volume. The POC is a web app that listens through the mic. It shows how loud the voice is and warns the child, both on screen and with a sound, when the voice gets too loud.

Decisions so far:

- Mobile-first PWA for a tablet or phone
- Soft chime as the audio cue
- Calibration step plus a parent sensitivity slider (the "too loud" line itself is fixed)
- Hosted on GitHub Pages
- **No build step**: plain HTML, CSS and JS

## Stack

- **Plain HTML, CSS and JS modules**, loaded natively by the browser. There is no framework and no bundler. No backend and no stored data: all audio is processed on the device and never leaves it.
- **Types without a build step**: each JS file starts with `// @ts-check` and uses JSDoc type comments. `tsc --noEmit` checks the types in CI (TypeScript is a dev dependency only).
- **Web Audio API**:
  - `getUserMedia` → `AnalyserNode` gives the mic signal.
  - Per animation frame, compute the loudness as RMS and convert it to dBFS.
  - The browser's echo cancellation, noise suppression and auto gain are turned off (`echoCancellation/noiseSuppression/autoGainControl: false`), because auto gain would hide exactly the loudness we want to measure.
- **Meter rendering**: the code sets a CSS custom property, e.g. `--level`, and a zone class on the page. CSS handles the size and color transitions, so there's no framework re-render.
- **Chime**: made in code with an `OscillatorNode` and a volume envelope, so no audio files are needed.
- **PWA, written by hand**:
  - `manifest.webmanifest` + `sw.js`, a small cache-first service worker for offline use and "Add to Home Screen".
  - A Wake Lock keeps the screen on while listening.
- **Dev tooling (package.json has dev dependencies only)**:
  - Vitest, Playwright, TypeScript for checking, ESLint + Prettier.
  - Node 22 and pnpm (npm also works).

## Project structure

```
way2loud/
  index.html
  styles.css
  manifest.webmanifest
  sw.js                 # service worker (cache app shell)
  icons/
  js/
    main.js             # wires screens: Start → Calibrate → Listen
    audio/
      meter.js          # mic stream → dBFS readings (the only file that touches browser audio)
      levels.js         # pure: RMS→dB, smoothing, loud/ok decision with hysteresis + hold time
      calibration.js    # pure: baseline from samples → suggested sensitivity
      chime.js          # oscillator tone + cooldown
    ui/
      meter-view.js     # updates --level / zone class
      settings.js       # parent panel; persists to localStorage
  tests/
    unit/               # Vitest
    e2e/                # Playwright
    fixtures/           # quiet.wav, loud.wav
  .github/workflows/ci.yml, deploy.yml
  package.json, jsconfig.json, README.md
```

## Core logic (the part that matters)

- **Smoothing**: an exponential moving average of about 150–300 ms, so single spikes (a clap, a cough) don't trigger the alert.
- **Hysteresis**: the level has to stay above the threshold for about 400 ms before it counts as loud. It only goes back to normal once it drops a few dB below the threshold. This stops the display from flickering.
- **Chime cooldown**: at most one chime every 3 s, so it doesn't turn into nagging.
- **Sensitivity (per device)**: every reading is shifted by a gain in dB (±30), like an input gain knob, because each device's mic has a different sensitivity. It's set in a collapsed Settings panel and saved per device in localStorage. Calibration can later set it automatically so the child's normal voice lands at the same point on the bar on every device.
- **Calibration**: the child speaks normally for about 5 s. Take a high percentile (p90) of the voiced frames, ignoring frames below the noise floor. Set the sensitivity so that level lands a margin (about 6 dB, adjustable) below the "too loud" line.
- **Feedback loop**: the chime is quiet and short, and the meter ignores input while the chime plays. Otherwise the chime itself could register as loud.
- **Three zones**: quiet, good and too loud. The visual encourages the "good" zone instead of only punishing the "too loud" one.
- **Zone defaults** (in dB after sensitivity; tuned on the first phone, where a quiet room read about -40, normal talking -30 ± 5 and loud talking -20 ± 5): too loud above -23, reset below -26, quiet below -35. The bar shows -53 to -8 dB, so the "too loud" line always sits at two thirds of the bar. There is one control, Sensitivity; a separate threshold slider would do the same job.

## Local dev

- The laptop: any static server on localhost works, e.g. `npx serve .`. The mic is allowed on localhost without HTTPS.
- The tablet needs HTTPS for the mic. Use a `cloudflared` tunnel or a local server with a certificate from `mkcert`, or push and test on the Pages URL.

## Testing

- **Unit (Vitest)**: `levels.js` and `calibration.js` hold all the decision logic as pure functions. Their tests feed synthetic sample arrays through the logic and check the RMS/dB math, smoothing, the hysteresis timing (using explicit timestamps), the cooldown and the calibration.
- **E2E (Playwright, Chromium)**:
  - Chromium can feed a WAV file in place of a real mic, using `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=tests/fixtures/loud.wav` and `quiet.wav`.
  - The tests check that the UI turns red for the loud clip and stays green for the quiet one. They also cover the mic-permission flow and saving the settings.
  - Playwright's `webServer` option starts the static server for the tests.
- **Type check**: `tsc --noEmit` over the JSDoc-typed JS.
- **Manual**: test on a real iPad or phone for Safari quirks. On iOS, audio only starts after the user taps something, and the mic needs HTTPS.

## Deployment

- A GitHub repo named `way2loud`.
- `ci.yml` runs on every pull request: lint, type check, unit tests, then Playwright.
- `deploy.yml` runs on every push to `main`: upload the site files (excluding tests and config) with the official Pages actions. There is no build step, so the uploaded files are exactly the files in the repo. HTTPS comes with Pages, which the mic requires.
- `sw.js` has a cache version constant. Bump it on each deploy so the tablet picks up the new version.

## Milestones

1. Repo, CI, and deploying a "hello" page to Pages.
2. Mic meter with a live dB readout (confirms it works on the tablet).
3. Loud detection logic, the visual zones and the chime, all with unit tests.
4. Calibration flow and the parent settings.
5. PWA install, offline use, wake lock, and the E2E tests with audio fixtures.
6. Try it with your kid and tune the smoothing and zone defaults.

## Out of scope for the POC

Accounts, progress history or streaks, native apps, a backend, and a framework or bundler (add Vite later if the project outgrows plain files).

## Verification

- `pnpm test` (unit tests), `pnpm typecheck` and `pnpm e2e` (Playwright with fake-mic WAVs) pass locally and in CI.
- On the tablet, via the tunnel or the Pages URL, speaking normally should stay green and shouting should turn red and chime.
- The deployed Pages URL loads, can be installed to the home screen and works in airplane mode.

## Location

The project lives at `~/code/way2loud`.
