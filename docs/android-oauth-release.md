# Android Twitter OAuth return (1.0.21)

## Diagnosis

- iPhone PWA completes OAuth in its own browser storage. Android must return the code to the original WebView, where Privy stores its PKCE verifier and state. Logging in a separate Chrome page does not log the WebView in.
- `Location.assign` is an own non-writable/non-configurable property in Chromium. The previous prototype patch did not open the intended Custom Tab.
- Production redirects `/native-oauth-redirect.html` to `/native-oauth-redirect`. The old service-worker denylist excluded only the former, so the latter could serve the SPA shell instead of the return page.
- At investigation time, `https://tagai.fun/.well-known/assetlinks.json` returned the SPA HTML, not an Android association. The manifest had only a custom-scheme handler.

## Changes

Android intercepts only the next trusted OAuth navigation, opens a browser Custom Tab (not the X app), and keeps SDK-generated PKCE state in the WebView. Verified HTTPS return links use the official release certificate; a package-bound, user-clicked intent link is available when automatic link opening is disabled. Both callback path variants bypass the service worker. Cold-start and running-app returns install only the three SDK OAuth parameters. Privy still validates state and exchanges the authorization code. No private key, session token or OAuth verifier is sent to the bridge page.

Website/PWA OAuth remains on its existing path. A slow callback no longer silently navigates home after 12 seconds. Native browser cancellation re-enables the login button.

## Deploy in this order

1. Keep the Android production config/icon/update work from PR #180, now merged into main. This fix must not revert it or the subsequent quote fixes.
2. Deploy the web build containing the callback page, worker denylist, and `public/.well-known/assetlinks.json`.
3. Verify `https://tagai.fun/.well-known/assetlinks.json` is HTTP 200 JSON **without redirects**, contains `fun.tagai.app`, and matches the signing certificate. Only the certificate fingerprint is public; never upload the keystore/password.
4. In the **production** Privy app (`cmdl0tzg601kyju0jdjolp9li`), confirm Allowed origins contains `https://tagai.fun`. Allowed OAuth redirect URLs must allow `https://tagai.fun/native-oauth-redirect` (retain the `.html` variant for installed 1.0.20 clients). This setting requires the dashboard owner; source edits alone cannot change it.
5. Install 1.0.21 signed with the **same** official release key over 1.0.20. Do not uninstall/clear app data to update. Debug-signed packages are not upgrade-compatible.
6. After device acceptance, upload the tested APK and enable/update the existing version manifest. Do not advertise an APK before its required web deployment.

## Acceptance on a connected Android device

```sh
adb shell pm verify-app-links --re-verify fun.tagai.app
adb shell pm get-app-links fun.tagai.app
```

`tagai.fun` should be `verified`; also enable “Open supported links” in the Android app settings. If the browser has an old TagAI service worker, open/refresh the deployed website so the updated worker activates before retesting. The callback must show “Open TagAI”, never the ordinary home page when it stays in Chrome.

- Existing X account `thefandotfun`: Twitter login in APK → Chrome Custom Tab → authorize → return to APK → account and original wallet present.
- Existing X account with an external bound wallet: do not replace that wallet.
- New X account: normal account completion and Privy wallet creation/binding.
- X installed/not installed; browser already signed in/not signed in; browser back/cancel and retry.
- App process cold-started on return; delayed network; missing/expired code; mismatched state rejected by Privy.
- BSC and Robinhood pages; email login in APK; existing iPhone PWA login.

No real account authorization or transaction is included in automated regression tests. A physical-device end-to-end test is still required.

## Local checks

```sh
node --test scripts/test-native-oauth.mjs scripts/test-native-oauth-runtime.mjs scripts/test-service-worker.mjs scripts/test-twitter-login-completion.mjs scripts/test-embedded-wallet.mjs
node scripts/test-android-updates.mjs
npm run type-check
npm run build-only
npx cap sync android
./android/gradlew -p android testDebugUnitTest assembleRelease
```

Sign using the existing local release workflow. Do not generate a new signing key for this update.

## Local verification (2026-09-13)

- 24 OAuth/worker/wallet regression tests passed; 18 update-policy checks passed.
- `npm run build` (including type check), Android `testDebugUnitTest`, and `assembleRelease` passed.
- Chromium confirmed that assigning `Location.prototype.assign` does not change `window.location.assign`.
- Built assets contain the production Privy app ID, not the development ID.
- `/Users/nought/Desktop/TagAI-1.0.21-release.apk`: package `fun.tagai.app`, versionCode 21; v2/v3 signatures verified against the existing official certificate above.
- APK SHA-256: `dd13d63d8bef73cf46132f0a98790643e300baeb1fe18b4e175e2aab5c83ab5e`.
- No Android device was connected. Website deployment, dashboard allowlist confirmation, and real-account acceptance remain pending. The release manifest has not been enabled or published.
