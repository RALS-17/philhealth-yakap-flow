# Update 17 - Password reset signs everyone out

## 1. Supabase (once per branch project - Cabuyao, Canlubang, and later Talisay / Bay / Cancer Institute)
SQL Editor -> New query -> paste `supabase-update-logout-on-password-reset.sql` -> Run.
From then on, any password change/reset ends every saved login of that user on all devices (admins too).

## 2. Website (files)
- src/lib/benefitsAuth.ts
- src/main.tsx
The app now asks the server whether the login is still valid when it opens, every minute, and when the tab
is opened again. A revoked login is sent to the sign-in page with a short message. Being offline does NOT log anyone out.
The edge function does not need to be redeployed.

## Git (only these files)
git add src/lib/benefitsAuth.ts src/main.tsx supabase-update-logout-on-password-reset.sql UPDATE-17-SETUP.md
git commit -m "Sign out all logins when a password is reset"
git push origin main
