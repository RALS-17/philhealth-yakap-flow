# PBUP — one app, one Supabase per branch (Cabuyao + Canlubang)

/cabuyao   -> Global Care Cabuyao   -> Cabuyao's own Supabase account
/canlubang -> Global Care Canlubang -> Canlubang's own Supabase account
/          -> a "Select your branch" page

## 1. Replace the code (use ONE project folder)
1. Pick your existing project folder (e.g. the Cabuyao one). Make a backup copy first.
2. Delete its `src` folder and put the new `src` folder from this zip in its place.
3. Copy `.env.example`, `vercel.json` into the project root (next to package.json).
4. Copy `public/_redirects` into your `public` folder (keep your existing logo there).

## 2. Create your .env
1. Copy `.env.example` to a new file named `.env` (same place as package.json).
2. In EACH Supabase account: Project Settings -> API. Copy the Project URL and the
   anon (public / publishable) key into the matching lines. Never the service_role key.
3. Remove any old `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` lines (no longer used).

## 3. Run it
    npm run dev          (stop and restart it any time you edit .env)
Open  http://localhost:5173/cabuyao   and   http://localhost:5173/canlubang
and sign in with that branch's own users.

## 4. Databases — no new SQL for the app itself
- Cabuyao: already set up. Nothing to run.
- Canlubang: it must have had `supabase-upgrade-gcmcc.sql` run once (it creates
  benefits_profiles etc.). Check: you can sign in at /canlubang.
- A user from one branch can't sign in to the other (different Supabase accounts, and the
  app also refuses a profile whose site_code is another branch).

## 5. Put it online (one site for both)
1. Upload the project to GitHub and import it in Vercel (or Netlify / Cloudflare Pages).
2. In the host's Environment Variables, add the same 4 VITE_... values from your .env.
3. Deploy. Staff use  https://your-site/cabuyao  and  https://your-site/canlubang.
   (vercel.json / _redirects make the /cabuyao links work after a refresh.)
4. Before turning off the old separate sites: open each and make sure the sync badge shows
   nothing waiting ("unsynced"), because unsent items live in that old site's browser.

## Admin Users page (create staff / admin logins)
One-time per branch: deploy the `admin-users` function — see ADMIN-USERS-SETUP.md.

## Adding a branch later
Add one entry in src/lib/branchConfig.ts (BRANCHES) + its 2 lines in .env / host settings.

## Different processes per branch (coming)
Each branch has a `features` list in branchConfig.ts. Use hasFeature('name') in the code so
a process appears only for the branches that have it.
