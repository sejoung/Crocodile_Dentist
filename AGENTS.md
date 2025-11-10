# Repository Guidelines

Crocodile_Dentist is a lightweight JavaScript playground composed of static HTML, focused CSS, and vanilla scripts. Keep the footprint lean, bias toward readability, and use this guide whenever you wire new interactions or assets.

## Project Structure & Module Organization
Place the user-facing entry point in `public/index.html`, referencing scripts from `public/js/` and shared styles in `public/css/`. Any reusable helpers or game logic modules should live under `src/`, split by concern (e.g., `src/game/state.js`, `src/ui/controls.js`). Browser-ready bundles drop into `public/js/` while raw source stays in `src/` so linting and tests can target the originals. Store static media in `public/assets/` and keep documentation (README, this file) at the root.

## Build, Test, and Development Commands
Install dependencies once with `npm install`. During development run `npm run dev` to serve `public/` with live reload (uses Vite or a minimal `http-server` shim). Validate the bundle via `npm run build`, which lints, transpiles (if Babel is added), and places distributable files in `dist/`. Execute automated checks with `npm test`; by default this runs `vitest` headless, but feel free to stub the script with `echo "Add tests"` until suites exist.

## Coding Style & Naming Conventions
Use two-space indentation, trailing commas where valid, and single quotes for strings. Prefer modules (`type="module"` in HTML) and export named functions so tree-shaking works. Component-like utilities use UpperCamelCase (`ToothButton`), plain helpers use lowerCamelCase, and constants sit in `UPPER_SNAKE_CASE`. Run `npm run lint` (ESLint + Prettier) before pushing; configure `.eslintrc.cjs` to extend `eslint:recommended` plus `prettier` to avoid style drift.

## Testing Guidelines
Write unit tests in `tests/` mirroring the `src/` tree (`tests/game/state.test.js`). Use Vitest + @testing-library/dom for DOM-facing logic. Name suites after the module under test and prefer behavior-driven descriptions (`describe('bite logic', …)`). Keep tests deterministic by mocking timers and DOM mutations. Target 80% coverage on core gameplay files; if coverage dips, document the rationale in the PR.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat: add bite animation`, `fix: clamp tooth index`). Keep subjects ≤72 characters and wrap additional context in the body, including manual verification steps like `npm run dev` smoke checks in Chrome. Pull requests should describe the change, list testing evidence, and include GIFs or screenshots whenever UI behavior shifts. Always request a review, ensure CI (lint + test) passes, and rebase instead of merging when addressing feedback.
