# WatchShelf

WatchShelf is a personal movie and TV tracking application built with Vue. It combines TMDB-powered discovery with a local-first library that stays on the user's browser and device.

## Live Demo

[Open WatchShelf](https://watch-shelf-puce.vercel.app/)

## Features

- Browse weekly trending titles or dedicated Movies and Series catalogs.
- Search TMDB separately for movies and TV series.
- Filter catalog results by genre and year, then sort by popularity, rating, or release date.
- Continue browsing through infinite scrolling while stale requests are safely ignored when the active view changes.
- View title details, including artwork, overview, genres, release year, media type, and release status.
- Organize a personal library into Planned, Watching, and Completed sections. Movies use Planned and Completed; Watching and episode progress apply to TV series.
- Filter the library by media type, sort it by title or most recent update, and scan titles in a compact row layout.
- Track TV progress as a watched episode count, with increment, decrement, and direct-edit controls.
- Reconcile TV progress and library status when TMDB's current episode total changes.
- Show normalized TMDB release-status badges independently of the user's library status.
- Restore the active Discover tab, filters, sort order, and search state within the browser session.
- Switch between light and dark themes, with the saved preference taking priority over the system color scheme.
- Use a responsive interface across mobile and desktop layouts.

## Tech Stack

- Vue 3 with the Composition API and `<script setup>`
- TypeScript
- Vite
- Vue Router
- Tailwind CSS
- IndexedDB for local library persistence
- `sessionStorage` for Discover state and `localStorage` for theme preference
- TMDB API for catalog, search, genre, and title data
- Vercel Functions for the server-side TMDB integration
- Vercel for deployment and local full-stack development

## Architecture

### Local-first library

Library entries are stored directly in IndexedDB. WatchShelf requires no account or backend database, so saved titles, statuses, and TV progress remain local to the current browser and device.

### TMDB proxy

Production requests follow this path:

```text
Vue frontend
  -> WatchShelf /api/tmdb/...
  -> Vercel Function
  -> TMDB API
```

The frontend calls only WatchShelf's own API routes. `TMDB_ACCESS_TOKEN` is read server-side by the functions and is never included in the client bundle. The API exposes an intentional allowlist of operations—trending, discovery, search, genres, and details—instead of forwarding arbitrary TMDB paths. It also validates query parameters, normalizes error responses, applies route-specific CDN caching, and times out unavailable upstream requests.

### TV progress model

WatchShelf stores one sequential watched episode count per series. The total is derived from TMDB's season summaries, excluding Season 0 (Specials). Library status and episode progress are independent: changing either one does not modify the other. When the current total changes, only an out-of-range watched count is clamped; the user's chosen status remains unchanged.

## Getting Started

### Prerequisites

- Node.js `^22.18.0` or `>=24.12.0`
- npm
- A [TMDB API Read Access Token](https://developer.themoviedb.org/docs/authentication-application)
- A Vercel account and the Vercel CLI workflow included in this repository

### Installation

1. Clone the repository and enter the project directory:

   ```sh
   git clone https://github.com/Zinmus/watch-shelf.git
   cd watch-shelf
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Copy the example environment file to a local, ignored file:

   ```sh
   cp .env.example .env
   ```

   On PowerShell, use `Copy-Item .env.example .env` instead.

4. Add your TMDB API Read Access Token to `.env`:

   ```dotenv
   TMDB_ACCESS_TOKEN=your_token_here
   ```

5. Authenticate and link the project when prompted by Vercel, then start the full local environment:

   ```sh
   npm run dev:vercel
   ```

`npm run dev` starts only the Vite frontend. Because browser requests target the serverless `/api/tmdb/*` routes, use `npm run dev:vercel` for normal local development with live TMDB data.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite frontend development server only. |
| `npm run dev:vercel` | Start the frontend and Vercel Functions together. |
| `npm run build` | Type-check the project and create a production build. |
| `npm run preview` | Preview the production build locally. |
| `npm run type-check` | Run Vue and TypeScript type checking. |
| `npm run lint` | Run oxlint and ESLint with automatic fixes. |
| `npm run format` | Format files under `src/` with Prettier. |

## Environment Variables

| Variable | Scope | Description |
| --- | --- | --- |
| `TMDB_ACCESS_TOKEN` | Server only | TMDB API Read Access Token used by the Vercel Functions. |

The token must not use the `VITE_` prefix: Vite-prefixed values can be exposed to browser code. `.env.example` documents the variable without containing a secret, while `.env` and other real environment files are excluded from version control.

## Deployment

The Vite frontend and serverless API are designed to deploy together on Vercel. Configure `TMDB_ACCESS_TOKEN` in the Vercel project's environment variables before deploying. The rewrite in `vercel.json` serves `index.html` as the fallback for Vue Router's client-side routes.

## Project Decisions

- **Local-first persistence:** IndexedDB provides durable personal-library storage without authentication, a user service, or a database backend.
- **Separate status concepts:** Planned, Watching, and Completed describe the user's relationship with a title; release badges describe TMDB's current production or release state.
- **Sequential TV progress:** A single watched count keeps progress editing and reconciliation simple while avoiding a larger per-episode data model.
- **Server-side credentials:** A narrow Vercel API layer keeps the TMDB token out of the browser and centralizes validation, caching, timeouts, and safe error handling.
- **Scoped browser state:** Discover controls use `sessionStorage`, theme preference uses `localStorage`, and library records use IndexedDB—each matching the intended lifetime and data shape.
- **Composition over global state:** Focused composables, domain modules, and data-access functions provide shared behavior without an additional state-management dependency.

## TMDB Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
