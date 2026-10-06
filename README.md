# VYBE

A short-video social app (TikTok-style) built with **Expo (React Native)** and **Supabase**.

## What works today (MVP)

| Area | Features |
|---|---|
| Feed | Full-screen vertical swipe, **For You** (ranked) + **Following**, autoplay/loop, tap to pause, **double-tap to like** with heart burst, progress bar, pull to refresh, infinite scroll, view counting |
| Engage | Like, save (bookmark), follow from the feed. Comments with **replies**, **comment likes** (most-liked first) and a creator badge. Long-press a comment to reply, report or delete |
| Messages | 1:1 **direct messages** with live delivery, unread counts, **share videos into chats** (send to several people at once with a note), and a Message button on profiles |
| Safety | **Report** videos, comments and accounts. **Block** removes follows both ways and hides that person's videos, comments and DMs. "Not interested" on any video. Blocked-accounts list in Settings |
| Create | In-app camera (flip, torch, 3s/10s timer, 15/60/180s length), upload from library, auto-generated cover image, caption with #hashtags/@mentions, **Everyone / Followers / Only me** visibility, comments on/off |
| Discover | Search videos, creators and sounds; trending hashtags; creators on the rise; hashtag pages |
| Profile | Stats, video grid, private **Saved** tab, follow/unfollow, edit name/username/bio/avatar, tap a tile to swipe through that set |
| Alerts | Likes, comments and new followers, grouped by day, with a **live unread badge** (Supabase Realtime) |
| Account | Email sign up / sign in, persisted sessions, settings, log out |

**Better than a plain clone:** the For You ranking weights saves and comments (deliberate engagement) above passive views, and new posts get a fair shot because of time decay. Visibility and comment controls are there from day one.

## Try it instantly (demo mode)

If no Supabase keys are set, the app runs on built-in sample data (creators, videos, comments, a chat), so you can click through every screen before any setup.

```bash
npx expo start --web
```

Open http://localhost:8081, then tap **Explore the demo**. Sample data resets on reload. Video autoplays muted in browsers.

## Setup (about 10 minutes)

1. **Create a Supabase project** at https://supabase.com (the free tier is fine).
2. **Create the database:** open *SQL Editor* and run [`0001_init.sql`](supabase/migrations/0001_init.sql), then [`0002_social.sql`](supabase/migrations/0002_social.sql), in that order.
3. **For quick testing:** go to *Authentication → Sign In / Providers → Email* and turn off **Confirm email**. (Leave it on for production.)
4. **Add your keys:** copy `.env.example` to `.env.local`, then fill in the values from *Project Settings → API Keys*.
5. **Optional demo content:**
   ```bash
   npm run seed
   ```
6. **Run it:**
   ```bash
   npx expo start
   ```
   Scan the QR code with **Expo Go** on your phone (iOS or Android).

## Project layout

```
src/app/            screens (Expo Router: each file is a route)
  (auth)/sign-in    sign in / sign up
  (tabs)/           Home feed, Discover, Alerts, Profile
  camera, post      record/upload → caption → publish
  comments/[id]     comments sheet (replies, likes)
  messages/, chat/  DM inbox, new chat, conversation
  share/[id]        send a video to friends
  blocked           blocked accounts
  watch             full-screen swiper for any video set
  user/[id], tag/[tag], edit-profile, settings
src/components/     Feed, VideoPost, VideoGrid, TabBar, ProfileView, ui
src/lib/            api (all data access), supabase client, theme, types
supabase/           database schema, security rules, triggers, storage
scripts/seed.mjs    demo creators + videos
```

## Roadmap

- ~~**Phase 2a:** direct messages, comment replies and likes, report and block.~~ Done.
- **Phase 2b (needs a development build, not Expo Go):** push notifications and a video editor (trim, music, text, filters). Also a moderation dashboard for reports.
- **Phase 3:** a personalised recommendation service using watch-time signals, HLS streaming and transcoding (for example Mux or Cloudflare Stream), moderation tools, creator analytics.
- **Store release:** `npx eas-cli@latest build` and then `eas submit`.

## Notes

- Uploads read the whole file into memory. That's fine for clips up to about 3 minutes; larger files will need resumable (TUS) uploads.
- Deleting a video removes its database row, but the file stays in Storage. A cleanup job is planned.
