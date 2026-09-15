# Website App download

Both website menu entries read `/app-updates/android.json` afresh on click.
`downloadEnabled` controls manual website downloads; `enabled` independently
controls installed Android app update prompts and remains unchanged/disabled.

To publish a new version:

1. Build and verify an APK signed with the existing release key. Never commit keys.
2. Add it to `public/downloads/` with a **new versioned filename** (do not overwrite
   immutable cached files). Pages currently accepts files up to 25 MiB; larger
   APKs require separate hosting under the same first-party download route.
3. Update the manifest version, URL, notes and SHA-256 together with the APK.
4. Run `node scripts/test-android-updates.mjs`, `node scripts/test-app-download.mjs`,
   `node scripts/test-app-download-runtime.mjs`, and `npm run build`.
5. Deploy the website. Verify the manifest and APK return JSON/APK, not the SPA
   HTML fallback. Test both menus on the deployed site.

The current APK is the existing officially signed 1.0.22 release, not a rebuild
of this menu change. iOS users receive Add to Home Screen guidance instead of an
unusable APK. PWA precaching excludes downloads; the Capacitor copy-after hook
removes distribution APKs from generated native web assets.
