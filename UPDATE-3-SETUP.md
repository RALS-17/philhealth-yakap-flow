# Update 3 — Duplicate warning, Cancel reason, Audit trail

## What's new
1. **Same-day duplicate warning** – when staff start a patient who was already started or completed today, a warning appears ("Same patient already today") with *Start anyway* / go back. Names match even if typed differently ("Santos, Maria" = "MARIA SANTOS").
2. **Cancel reason** – cancelling a paused patient now asks for a reason (dropdown; a short note is required for "Other"). Insights has two new cards: **Why cases are cancelled** and **Recent cancellations**.
3. **Audit trail** – the system records who completed, renamed, deleted, paused, cancelled or reopened each entry.
   - **Patient List → Done** has a new *Completed by* column (with "edited by" when someone renamed it).
   - New **Activity** tab (admin): a log grouped by day, with filters and search. It also shows user-management actions (user added/removed, role changed, password reset).

The "who" is taken from the login by the database itself, so it cannot be faked from the browser. Only admins can read the Activity log.

## Steps (do this for EACH branch: Cabuyao and Canlubang)
### 1. Run the SQL
Supabase (that branch's project) → **SQL Editor** → New query → paste the whole of `supabase-update-audit.sql` → **Run**.
It is safe to run twice. Do this **before or at the same time** as step 2. (If you forget, the app still works; it just won't show names until the SQL is run, and the Activity tab will tell you so.)

### 2. Update the app
Copy the files from this zip over your project (same folders), then:
- local: `npm run dev` (restart it)
- hosted: commit/push or redeploy as you normally do.

### 3. Update the Users function (optional, for user actions in the Activity log)
Supabase → **Edge Functions → admin-users** → paste the new `supabase/functions/admin-users/index.ts` → **Deploy**. Keep "Verify JWT" OFF. Do it in each branch's Supabase.

## Good to know
- Only **new** activity is recorded. Entries completed before this update show "—" under *Completed by*.
- Staff do not see the Activity tab or the audit data.
- Cancelled cases from before the update show "No reason recorded".
