# Admin "Users" page — one-time setup (do this in EACH branch's Supabase)

The new **Users** tab lets a branch admin create / reset / promote / remove logins for
THEIR OWN branch. Creating logins needs Supabase's secret "service_role" key, which must
never be inside the website — so it lives in a small Supabase **Edge Function** instead.
You do NOT copy any key anywhere: Supabase gives the function its key automatically.

Do the steps below once for Cabuyao (in the Cabuyao Supabase account) and once for
Canlubang (in the Canlubang account). No SQL is needed.

## Deploy the function (no command line needed)
1. Open the branch's Supabase project -> **Edge Functions** (left menu).
2. Click **Deploy a new function** -> **Via Editor**.
3. Name it exactly:   admin-users
4. Delete the sample code and paste the WHOLE content of
   `supabase/functions/admin-users/index.ts` (from this zip).
5. Click **Deploy**.
6. Open the function's **Details / Settings** and turn **"Verify JWT"** OFF, then save.
   (Safe: the function checks the signed-in admin itself. Leaving it ON can reject logins on
   newer Supabase projects.)

## Use it
Sign in as a branch admin -> **Users** tab ->
- **Add a user**: email, Staff or Admin, password (Generate makes a strong one) -> Create account.
  Give the email + password to the person (use "Copy email + password").
- **Reset password**, **Make admin / Make staff**, **Remove** per user.
- You can't remove or demote your own account. Removed people can't sign in; their past
  entries stay in the records.
- An admin only ever sees and manages their own branch's users.

## If it says "User management is not set up…"
The function isn't deployed in THIS branch's Supabase (or its name isn't exactly `admin-users`).
If it says your login was rejected, turn "Verify JWT" OFF (step 6).

## Command-line alternative
    supabase login
    supabase link --project-ref <that branch's project ref>
    supabase functions deploy admin-users --no-verify-jwt
