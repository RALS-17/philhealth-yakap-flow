# Android app (Capacitor)

This wraps the same GCare PhilHealth Flow website as an Android app.

## On your Windows PC (one-time)

1. Install [Android Studio](https://developer.android.com/studio).
2. Open Android Studio once so the SDK installs.
3. Copy these project files into your repo (or pull from GitHub).

```powershell
cd "D:\VS CODE\PROJECTS GCMCC\philhealth-yakap-flow"
npm install
```

Create `.env` (same keys as Vercel):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_key
```

## First Android project (only if `android/` folder is missing)

```powershell
npm run build
npx cap add android
npx cap sync
npx cap open android
```

If `android/` is already in the project:

```powershell
npm run android:build
npm run android:open
```

Android Studio opens. Wait for Gradle, then press **Run** (green play).

## After every website change

```powershell
npm run android:build
```

Then Run again in Android Studio.

## Share an APK with staff

Android Studio → **Build → Build Bundle(s) / APK(s) → Build APK(s)**  
Send the generated `.apk`. Phones may need **Install unknown apps**.

## Notes

- App ID: `com.gcare.philhealthflow`
- App name: **GCare PhilHealth Flow**
- Dashboard: same as web (`#monitor`)
- Website on Vercel is unchanged. Android is an extra wrapper.
