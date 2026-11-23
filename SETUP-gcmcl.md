# Global Care Cabuyao — Benefits Programs copy (gcmcl)

This copy is LOCKED to **Global Care Cabuyao**: only accounts for `gcmcl` can sign in, and (for the 4 separate
branches) it talks to its own Supabase project and its own website.

## PART 1 — Create this branch's own Supabase project
1. Go to https://supabase.com/dashboard → **New project**.
   - Name: `gcare-benefits-cabuyao`
   - Database password: create a strong one and save it in your password manager.
   - Region: the closest one to the Philippines (e.g. Singapore).
2. Wait until the project says it is ready (1–2 minutes).
3. Left menu → **SQL Editor** → **New query** → open `supabase-setup-gcmcl.sql` from this zip, paste the WHOLE file → **Run**.
   You should see "Success. No rows returned".
4. Left menu → **Authentication → Users → Add user → Create new user**. Create exactly two users
   (tick **Auto Confirm User**, and give each a NEW strong, different password):
   - `benefitsstaff@gcmcl.com`  (front-desk staff)
   - `benefitsadmin@gcmcl.com`  (admin / monitor)
5. Go back to **SQL Editor**, and run ONLY the last `insert into public.benefits_profiles ...` block of
   the same file again. (It links the two logins to Global Care Cabuyao. It must run AFTER the users exist.)
   Check: **Table Editor → benefits_profiles** shows 2 rows.
6. **Authentication → Sign In / Providers → Email**: turn **OFF** "Allow new users to sign up",
   so nobody can create their own account. Save.
7. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
   (Never use the `service_role` key anywhere in this app.)

## PART 2 — Prepare the project folder
1. Make a copy of your whole working project folder (the one that has `package.json`, `vite.config`,
   `public/`, `index.html`). Rename it, e.g. `gcare-benefits-gcmcl`.
2. Inside that copy, **delete the `src` folder** and put the `src` folder from this zip in its place.
3. Create a file called `.env` in the project root (next to `package.json`), copy from `.env.example`
   in this zip, and fill in the two values from Part 1:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. In a terminal inside that folder run:
   ```
   npm install
   npm run dev
   ```
   Open the address it prints and test (Part 4). Then stop it with Ctrl+C.

## PART 3 — Put it online as its OWN site
(Shown for Vercel/Netlify/Cloudflare Pages — any host that builds a Vite app works.)
1. Create a **new** project/site on your host for this folder (do NOT reuse another branch's site).
   Use its own address, for example `benefits-gcmcl.yourdomain.com`.
   Build command: `npm run build`  ·  Output folder: `dist`
2. In the host's **Environment Variables**, add the same two values:
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — **before** the first deploy
   (Vite bakes them in at build time; if you add them later, redeploy).
3. Deploy. Then in Supabase → Authentication → URL Configuration, set **Site URL** to your new site address.

## PART 4 — Test checklist (do it once before staff use it)
- [ ] Wrong password is refused. `benefitsstaff@gcmcl.com` opens the staff screen.
- [ ] Add a test patient → pick a program → go through the steps → **Finish**.
- [ ] The badge in the header says **Synced**.
- [ ] Sign in as `benefitsadmin@gcmcl.com`: the Dashboard shows the test record; Patient List and Insights open.
- [ ] Supabase → Table Editor → `benefits_completions` contains the record.
- [ ] Delete your test rows (Table Editor) before go-live.

## Rules to keep it separate and safe
- Never put another branch's URL/keys in this copy, and never reuse passwords between branches.
- One branch = one Supabase project = one website = one `.env`. Do not mix them up when copying folders.
- Use strong passwords for the staff and admin logins; change them if a person leaves.
- If you change the code later, change it in all copies (the only file that differs between copies is `src/lib/branchConfig.ts`).
