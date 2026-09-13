package fun.tagai.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class OAuthNavigationPolicyTest {
    @Test public void authorizesOnlyTrustedHttpsDestinations() {
        for (String host : new String[]{"auth.privy.io", "privy.io", "twitter.com", "api.twitter.com", "x.com", "api.x.com"}) {
            assertTrue(OAuthNavigationPolicy.isAuthorizationUrl("https://" + host + "/oauth/authorize?state=test"));
        }
        for (String value : new String[]{"https://tagai.fun", "http://twitter.com/oauth", "https://twitter.com.evil.example/oauth",
                "https://user@twitter.com/oauth", "https://twitter.com:8443/oauth", "javascript:alert(1)",
                "intent://oauth", "https://evil.example", "not a URL", null}) {
            assertFalse(String.valueOf(value), OAuthNavigationPolicy.isAuthorizationUrl(value));
        }
    }
}
