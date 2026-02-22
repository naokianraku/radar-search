# Project Rules: radar-search

## Overview
- Vite + React app.
- Data pipeline scripts generate JSON into /public.
- UI reads /public/radars_v2.json via fetch.
- Search uses FlexSearch (client-side).

## Source of truth
- UI code: /src/App.jsx, /src/main.jsx
- Data generation scripts: /tools/*.mjs, /tools/*.cjs
- Generated outputs: /public/*.json (DO NOT hand-edit)

## Editing policy
- Prefer minimal diffs.
- Keep compatibility with WRD-first merged schema.
- Avoid new dependencies unless necessary.

## Commands (Windows PowerShell)
- Install: npm i
- Dev: npm run dev
- Build: npm run build
- Lint: npm run lint

## Data constraints
- tags may be missing -> always fallback to "" when indexing.
- Map markers only when location.lat/lon exists (OPERA may not have it).