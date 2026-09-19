# Android update reminders

Android only: cold start and foreground resume check the hosted manifest at
`https://tagai.fun/app-updates/android.json` through Capacitor native HTTP.
Checks are throttled to one per hour in a running app; Later snoozes that version
for 24 hours across restarts. Network failures never block app use.

The first updater-enabled APK must be installed manually. Older 1.0.19 and earlier
builds cannot discover updates retroactively.

## Publish a version

1. Increase Android versionCode and versionName, build and verify the APK.
2. Use the SAME application ID and signing key as the installed app. Current
   production APKs (including 1.0.22 and 1.0.24) use the production release key.
   Legacy debug-signed builds cannot upgrade in place to that identity; do not
   tell wallet users to uninstall. Keep keys outside git.
3. Upload the verified APK to an immutable HTTPS URL under
   `https://tagai.fun/downloads/` (filename ending in `.apk`). Serve as
   `application/vnd.android.package-archive` with attachment disposition. Do not
   redirect to another host. Verify download and signature before announcing it.
4. Update the manifest versionCode, versionName, plain-text notes and downloadUrl,
   then set enabled to true and deploy the website. Keep manifest caching short
   or disabled. Publish APK BEFORE the manifest; never replace a version's APK.
5. Test an older updater-enabled app: start/resume, Later, download, installation,
   preservation of login data. Test current version and offline cases too.

The manifest enables reminders for the already published, signed 1.0.24 APK.
It takes effect when the website deployment publishes the updated manifest;
no APK rebuild is required. Current/newer installs are not prompted. There is no mandatory
upgrade, silent install or background binary download. Confirmation opens the
Android browser download flow; the user opens the downloaded APK and approves
installation (including permission to install from that browser if requested).
Android enforces APK integrity/signing compatibility at install time; this
reminder-only implementation does not claim an in-app SHA-256 verification.

Before release, test physical Android devices and OEM browser download handling.

## 1.0.25 (versionCode 25)

- Includes PR #186: Blinks/post token-card trades verify the on-chain listing
  state before quoting and submitting. If a token graduates after quoting,
  refresh pool metadata and require another confirmation.
- Preserves Blinks publisher/IPShare attribution, native OAuth, and update reminders.
- Uses the existing production signing certificate and `fun.tagai.app` ID;
  install over the existing official app without uninstalling or clearing data.
- No physical Android device was connected during packaging. Real-account login,
  upgrade data preservation, and BUIDL buy/sell require device acceptance.

## 1.0.26 (versionCode 26)

- Fix actual-wallet chain mismatch after Blinks/deep-link navigation. Privy and
  external wallets verify `eth_chainId`, switch networks when required, and
  verify again before preparing the transaction client.
- Covers shared contract writes and direct BNB/RH V4 and V13 transaction paths.
  Rejected, pending, or unsuccessful switches stop before transaction submission.
- Retains the 1.0.25 listing fix and the existing production signing identity.
- APK SHA-256: `c74c46438b8b31ccf98f5b6f7bd8013afffdc4665e0a4620ce5bb34aabcaadd3`.
- Automated regressions, production build/type-check, Android unit tests and
  release assembly passed. No physical-device upgrade or live trade was executed.

## 1.0.27 (versionCode 27)

- Packages the latest main-branch Blinks and comment-buy updates, while retaining
  the 1.0.26 wallet-chain and 1.0.25 listed-token fixes.
- Uses the existing production signing identity and `fun.tagai.app` ID; install
  over the existing official app without uninstalling or clearing data.
- APK SHA-256: `8b3d750e84c17adcb0f759744a7a4313ff09206c7c10b02e31a305194644d8ca`.
- Automated build and signing verification passed. Physical-device login,
  upgrade data preservation, and live trading still require device acceptance.
