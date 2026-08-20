# Vercel Deployment Guide

This document explains how to deploy the Personal Business Dashboard to Vercel.

## Prerequisites

1. A [Vercel](https://vercel.com) account
2. The project pushed to a GitHub repository
3. Environment variables ready (see below)

## Quick Deploy

1. Push the project to GitHub (see "Push to GitHub" below)
2. Go to https://vercel.com/new
3. Import the GitHub repository
4. Vercel auto-detects Next.js — keep the defaults:
   - **Framework Preset**: Next.js
   - **Build Command**: `next build` (override the default if Vercel suggests otherwise)
   - **Install Command**: `bun install` (or `npm install`)
5. Open **Environment Variables** and add ALL the variables listed below
6. Click **Deploy**

## Environment Variables (REQUIRED for Vercel)

Set these in the Vercel dashboard: Project Settings → Environment Variables.

| Variable | Value | Environment | Notes |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://neondb_owner:npg_6lUWzBARI2Dc@ep-ancient-recipe-ay7yrtuf-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15` | Production + Preview | **Pooled** Neon connection (PgBouncer) |
| `DIRECT_URL` | `postgresql://neondb_owner:npg_6lUWzBARI2Dc@ep-ancient-recipe-ay7yrtuf.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require` | Production + Preview | Direct connection for Prisma migrations |
| `CLOUDINARY_CLOUD_NAME` | `kohprqgv` | Production + Preview | Public cloud name |
| `CLOUDINARY_API_KEY` | `149563372977638` | Production + Preview | Used for signed uploads |
| `CLOUDINARY_API_SECRET` | `F-gYZ-cQrT3D6bmvoGur8vPgQWA` | Production + Preview | **Server-only — never expose to client** |
| `GOOGLE_CLIENT_ID` | `945302170757-ivi7932tg9m72cr68u4re689ghoetvve.apps.googleusercontent.com` | Production + Preview | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | `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` | Production + Preview | **Server-only** |
| `AUTH_SECRET` | `Js4lZlNPnZPKUC5/AWjC9uLbQQW4AgDzHC3KOXGhoH0=` | Production + Preview | JWT signing secret |

### Optional Vercel Environment Variables

| Variable | Value | Notes |
|---|---|---|
| `NEXTAUTH_URL` | *(leave unset on Vercel)* | NextAuth auto-detects from request on Vercel. Set only for custom domains. |
| `NEXT_PUBLIC_APK_MODE` | `false` | Only `true` for APK builds (not Vercel) |

## Google OAuth Redirect URIs

In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs, add:

1. `http://localhost:3000/api/auth/callback/google` — local development
2. `https://YOUR-PROJECT.vercel.app/api/auth/callback/google` — Vercel production
3. `https://YOUR-PROJECT-*.vercel.app/api/auth/callback/google` — Vercel preview (use a wildcard pattern)

Also add these to **Authorized JavaScript origins**:
- `http://localhost:3000`
- `https://YOUR-PROJECT.vercel.app`

## Build Configuration

The project is configured for Vercel out of the box:

- **`next.config.ts`** — uses `output: undefined` (Vercel's default) unless `BUILD_TARGET=standalone` or `NEXT_PUBLIC_APK_MODE=true` is set. Vercel builds natively without the standalone output.
- **`package.json`** — `build` script is `next build` (no post-build copy step, which is only needed for self-hosted Electron).
- **`postinstall`** script runs `prisma generate` automatically after `bun install` — this generates the Prisma Client so the build can import `@prisma/client`.
- **`vercel.json`** — explicit framework preset + security headers.

## Push to GitHub

```bash
cd /home/z/my-project

# Add your GitHub repo as origin (if not already set)
git remote add origin https://github.com/YOUR_USERNAME/personal-dashboard.git

# Push
git push -u origin main
```

For HTTPS auth, use `gh auth login` or Git Credential Manager.

## Verifying the Deployment

After deployment, verify:

1. Visit `https://YOUR-PROJECT.vercel.app/` — the dashboard should render
2. Click **"تسجيل الدخول"** (Login) → Google sign-in should appear
3. Sign in with a Google account → redirect back, authenticated
4. Create a contact → it should persist in the Neon database
5. Reload → data should persist (cloud-synced)

## Troubleshooting

### Build fails with "Cannot find module '@prisma/client'"

The `postinstall` script should generate the client. If it fails:
- Verify `prisma` and `@prisma/client` are in `dependencies` (not `devDependencies`)
- Run `bun run db:generate` locally and commit — but the generated client is in `node_modules` (gitignored), so the `postinstall` is the real fix

### Google OAuth "redirect_uri_mismatch"

Check that the redirect URI in the browser matches EXACTLY what's in Google Console. The Vercel URL must include `https://` and the full path `/api/auth/callback/google`.

### "Database connection error" on Vercel

- Verify `DATABASE_URL` uses the **pooler** hostname (with `-pooler` in the URL and `pgbouncer=true`)
- Neon serverless connections require the pooler for serverless platforms like Vercel
- The `DIRECT_URL` (without pooler) is only for Prisma migrations

### Large build artifact / slow build

The `android/` and `electron/` folders are not needed for Vercel. They're gitignored where appropriate. If the build is slow, ensure you're not installing `devDependencies` on Vercel (Vercel does this automatically in production).

## Architecture Notes

- **Database**: Neon PostgreSQL (serverless Postgres) — 32 tables, multi-tenant
- **Auth**: NextAuth v4 with Google OAuth + JWT session strategy
- **Storage**: Cloudinary (signed uploads from client, secret stays server-side)
- **Offline-first**: Guests use localStorage via a fetch interceptor; authenticated users query the cloud directly with a client-side sync queue for offline writes
- **Multi-tenant isolation**: Every API route filters by `userId` from the session; cross-tenant access returns 403
