# ReLearn

Study-focused social app (React + Vite + Tailwind, Supabase backend, installable PWA).

## Run locally
```
pnpm install
pnpm dev
```
Optional `.env` (defaults are built in): see `.env.example`.

## Database
Run in Supabase SQL Editor, in order: `supabase/migrations/0001_relearn_schema.sql`, then `0002_reports_delete_account.sql`.
In Supabase -> Authentication -> URL Configuration set Site URL to your deployed address.

## Build / deploy
```
pnpm build        # outputs dist/
```
Host `dist/` on Vercel, Netlify or Cloudflare Pages (HTTPS required for PWA).

## Google Play
Wrap the deployed PWA as a Trusted Web Activity with Bubblewrap (`npx @bubblewrap/cli init --manifest https://YOUR_DOMAIN/manifest.webmanifest`).
Legal pages for the store listing: `/privacy.html`, `/terms.html`, `/delete-account.html`.
