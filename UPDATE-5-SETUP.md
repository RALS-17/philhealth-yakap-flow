# Update 5 — Split-screen login

No Supabase changes. Copy the files (keep the same folders), then restart `npm run dev`:
- `src/main.tsx`, `src/index.css`, `src/lib/branchConfig.ts`
- `public/login-canlubang.jpg`  (goes in the `public` folder)

## Photos per branch
Each branch uses its own photo, set in `branchConfig.ts` (`heroImage`).
- Canlubang: `public/login-canlubang.jpg` (included).
- Cabuyao: put a photo named `public/login-cabuyao.jpg`. Until then Cabuyao shows a blue panel.
- Later branches: add `heroImage: 'login-talisay.jpg'` to the branch entry and drop the file into `public`.
Use a wide photo (about 1600x900, under 500 KB).
