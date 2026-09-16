# Android content links — 1.0.24

## Blinks publisher attribution (1.0.24)

Deploy the matching API change (`/commerce/resolve` returning commerceId,
chainId, token and publisher) before the frontend/APK. Old API metadata fails
closed; it must not silently redirect referral fees. This PR includes the signed
1.0.24 APK and manual-download manifest. Merge/deploy only after both chain API
instances serve the new metadata. Automatic upgrade reminders are enabled for
older updater-capable installs; downloading and installation require user approval.

Commerce links open an available original post with an opaque `blink` id. If
the post is missing, a verified publisher/token card offers trading or a
community link retaining that id. Publisher wallets are resolved from the
database and revalidated at confirmation, never trusted from URL parameters.
Attribution is scoped to the chain/token and does not persist globally.
An absent IPShare uses the existing chain default; RPC failures stop the trade.
Contract fee percentages and special launch-period fee rules are unchanged.

Run `node scripts/test-blink-attribution.mjs` and the API commerce-attribution
unit tests for chains 56 and 4663 in addition to the tests below. Browser mocks
do not substitute for final device/login and on-chain receipt verification.

The release adds verified HTTPS App Links for commerce (Blinks), tag-detail,
buy-sell, post-detail, space-detail and user routes, with BSC/RH prefixes and
legacy unprefixed variants. The existing OAuth return remains a separate path.

Content URLs preserve the chain, referral, query parameters and fragment. They
only navigate: they never sign messages, authorize a trade or submit a transaction.
Cold starts replace the initial route; warm deliveries push a route. Commerce
resolution watches subsequent route changes and ignores stale responses.

Android web pages show an explicit **Open TagAI App** intent link with the same
HTTPS page as fallback, plus the existing Download App button. No automatic
redirect timer is used. Unsupported URLs, hosts, OAuth credentials and encoded
path separators are rejected. App association already exists on tagai.fun with
the current release certificate. X may keep links in its own browser; in that
case use the explicit button or open the link in the external browser.

## Test / release boundaries

- Install the newly signed 1.0.24 APK over the existing app (do not uninstall or clear data).
- Existing live HTTPS links can use the new APK immediately once Android verifies
  the domain. The website fallback button needs this frontend change deployed.
- The live download manifest stays unchanged until the new release is approved.
- Test a real X post linking to `/bsc/commerce/<id>` and `/rh/commerce/<id>`,
  both with the app stopped and already running. Verify the intended content,
  chain and referral, not just whether the app opens.
- Test `/bsc/tag-detail/BUIDL?tab=trade` and `/rh/tag-detail/HBTC?tab=play&play=nft`.
- Verify Twitter login still returns to the app and no diagnostic signing prompt
  appears. Existing transaction confirmation must remain user-controlled.
- Test without the app installed: the web page remains usable. Test iPhone/PWA:
  no Android intent banner is displayed.

For an attached Android device:

```sh
adb shell pm verify-app-links --re-verify fun.tagai.app
adb shell pm get-app-links fun.tagai.app
adb shell am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d 'https://tagai.fun/bsc/tag-detail/BUIDL?tab=trade'
```

Run `node scripts/test-native-content-links.mjs`,
`node scripts/test-native-oauth-runtime.mjs`, `node scripts/test-native-oauth.mjs`,
and `npm run build` before packaging. Sign using the existing local release key;
never include signing material in the repository.
