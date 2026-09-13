package fun.tagai.app;

import android.net.Uri;
import android.os.SystemClock;
import android.content.ActivityNotFoundException;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Keep Privy's PKCE state in the WebView, but authorize in a real browser. */
@CapacitorPlugin(name = "NativeOAuth")
public class NativeOAuthPlugin extends Plugin {
    private volatile long armedUntil = 0;

    @PluginMethod
    public void prepare(PluginCall call) {
        armedUntil = SystemClock.elapsedRealtime() + 120_000;
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        armedUntil = 0;
        call.resolve();
    }

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if (armedUntil <= SystemClock.elapsedRealtime() ||
            !OAuthNavigationPolicy.isAuthorizationUrl(url.toString())) return null;
        armedUntil = 0;
        try {
            CustomTabsIntent tab = new CustomTabsIntent.Builder().build();
            // Explicitly select a browser, not the installed X app's URL handler.
            String browser = CustomTabsClient.getPackageName(getContext(), null);
            if (browser == null) throw new ActivityNotFoundException();
            tab.intent.setPackage(browser);
            tab.launchUrl(getActivity(), url);
        } catch (ActivityNotFoundException error) {
            notifyListeners("openFailed", new JSObject());
        }
        return true;
    }
}
