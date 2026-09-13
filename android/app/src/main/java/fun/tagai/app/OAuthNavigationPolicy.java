package fun.tagai.app;

import java.net.URI;
import java.util.List;
import java.util.Arrays;

final class OAuthNavigationPolicy {
    private static final List<String> HOSTS = Arrays.asList(
        "auth.privy.io", "privy.io", "twitter.com", "api.twitter.com", "x.com", "api.x.com"
    );

    static boolean isAuthorizationUrl(String value) {
        try {
            URI url = URI.create(value);
            return "https".equals(url.getScheme()) && url.getUserInfo() == null &&
                (url.getPort() == -1 || url.getPort() == 443) && HOSTS.contains(url.getHost());
        } catch (IllegalArgumentException | NullPointerException error) {
            return false;
        }
    }
}
