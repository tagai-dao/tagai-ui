# Android update reminders

Android only: cold start and foreground resume check the hosted manifest at
`https://tagai.fun/app-updates/android.json` through Capacitor native HTTP.
Checks are throttled to one per hour in a running app; Later snoozes that version
for 24 hours across restarts. Network failures never block app use.

The first updater-enabled APK must be installed manually. Older 1.0.19 and earlier
builds cannot discover updates retroactively.

## Publish a version

1. Increase Android versionCode and versionName, build and verify the APK.
2. Use the SAME application ID and signing key as the installed app. Current test
   APKs use the local debug signing key. Do not switch these users to a differently
   signed release or tell wallet users to uninstall. Choose a production signing
   and migration plan before public distribution; keep keys outside git.
3. Upload the verified APK to an immutable HTTPS URL under
   `https://tagai.fun/downloads/` (filename ending in `.apk`). Serve as
   `application/vnd.android.package-archive` with attachment disposition. Do not
   redirect to another host. Verify download and signature before announcing it.
4. Update the manifest versionCode, versionName, plain-text notes and downloadUrl,
   then set enabled to true and deploy the website. Keep manifest caching short
   or disabled. Publish APK BEFORE the manifest; never replace a version's APK.
5. Test an older updater-enabled app: start/resume, Later, download, installation,
   preservation of login data. Test current version and offline cases too.

The shipped manifest is intentionally disabled until a real download exists.
This change does NOT upload APKs or deploy the manifest. There is no mandatory
upgrade, silent install or background binary download. Confirmation opens the
Android browser download flow; the user opens the downloaded APK and approves
installation (including permission to install from that browser if requested).
Android enforces APK integrity/signing compatibility at install time; this
reminder-only implementation does not claim an in-app SHA-256 verification.

Before release, test physical Android devices and OEM browser download handling.
