# Way2Loud

A web app that helps a child learn to speak at a normal volume. It listens through the mic, shows how loud the voice is, and chimes softly when it gets too loud. All audio is processed on the device and never leaves it.

Plain HTML, CSS and JS modules. There is no build step. See [PLAN.md](PLAN.md) for the design and milestones.

## Develop

```sh
npm install
npm run dev        # static server on localhost (the mic works on localhost without HTTPS)
npm test           # unit tests (Vitest)
npm run typecheck  # tsc over JSDoc-typed JS
npm run lint
npm run format
```

To test on a tablet, the mic needs HTTPS. Use a `cloudflared` tunnel, or push to `main` and use the GitHub Pages URL.

## Deploy

Every push to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`). In the repo settings, set Pages → Source to **GitHub Actions**.
