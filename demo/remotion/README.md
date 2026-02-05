# Remotion demo assets (scope3-execution)

This package generates vendor-outreach demo assets (MP4 + thumbnail) using Remotion.

## Prereqs

- Node.js 18+
- `yarn` or `npm`

## Install

```bash
cd demo/remotion
yarn install  # or: npm install
```

## Preview (studio)

```bash
cd demo/remotion
yarn start
```

## Render outputs

```bash
cd demo/remotion
yarn render
yarn still:thumbnail
```

Outputs are written to `demo/remotion/out/`:

- `out/highlight-reel.mp4`
- `out/thumbnail.png`

## Notes

- Animations are frame-driven (`useCurrentFrame()`); do not use CSS transitions/animations.
- The scenes are **simulated UI** (no live screen capture) so renders are deterministic and don’t require a running backend.

