# JALTRON — AI Plan Manager

A free, installable web app that plans your day: smart tasks, a Pomodoro focus timer, streaks and habits, insights charts, a streak leaderboard, reviews, private saved links, a fake bank for shared pots, and a built-in offline AI assistant. Sign in with Google and everything syncs through Firestore.

## Features

- **Tasks** — quick add, due dates, repeating tasks with per-task streaks, images, search, filters, smart ordering
- **Calendar** — month grid with private, color-coded events; drag events between days, arrow-key navigation; tasks with a due date show on their day (Free: 20 events, Lite: unlimited)
- **AI assistant** — plain-language commands, planning, math and date skills; runs 100% locally, no model or network
- **Focus** — Pomodoro timer with presets, zen mode, mini dock and session stats
- **Insights** — category/priority charts, 7-day and 12-week heatmap, habit streaks (Lite)
- **Grow** — streak leaderboard, drawn pet that grows with your streak, shared fake-money banks
- **Accounts** — Google sign-in, custom username + avatar, Lite subscription managed by staff on Discord

## Project map

Everything lives at the root on purpose — one file per job, no build step:

| File | Job |
| --- | --- |
| `index.html` | The whole app UI + SEO/social/PWA head |
| `admin.html` | Staff-only panel to grant Lite (`noindex`) |
| `index.js` | Task logic: add, edit, complete, filter, sort, render |
| `ai.js` | The offline AI brain (parser, skills, chat) |
| `extras.js` | Page modules: hero, focus UX, palette, shortcuts, confetti, bank, links, calendar |
| `lib.js` | Shared library: habits, reviews, focus engine, misc UX |
| `db.js` | Firebase: Google auth + Firestore sync (ES module) |
| `style.css` | All styling, light/dark themes |
| `api/image.js` | Serverless image proxy (Vercel function) |
| `firestore.rules` | Database security rules |
| `manifest.webmanifest` | PWA manifest — makes the app installable |
| `robots.txt` | Crawler rules (admin page excluded) |
| `favicon.png` | App icon (192×192, also used for social cards) |
| `vercel.json` | Clean URLs, caching and security headers |

## How the pieces talk

Classic scripts load in order `lib.js → ai.js → extras.js → index.js` and share globals; `db.js` is an ES module that loads in parallel and reports sign-in state via events. The cloud layout is documented at the top of `db.js`.

## SEO & PWA

`index.html` ships meta description, Open Graph + Twitter cards, `WebApplication` JSON-LD, a `noscript` summary for non-JS crawlers, and the PWA manifest for install-to-home-screen. To finish the setup on your live domain:

1. Uncomment `rel="canonical"` and `og:url` in `index.html` and set your URL
2. Uncomment the `Sitemap:` line in `robots.txt` (and add a `sitemap.xml`)

## Deploying

Static hosting on Vercel: push, import the repo, done — `vercel.json` handles URLs, caching and security headers, and `api/` deploys the image proxy. Firebase config lives in `db.js`; Firestore access is locked down by `firestore.rules`.
