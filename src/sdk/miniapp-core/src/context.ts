// tagai-ui/src/sdk/miniapp-core/src/context.ts
// Context types for TagAI Community Mini Tags - based on Farcaster mini apps

import type { MiniAppNotificationDetails } from './schemas/index.ts'

export type MiniAppPlatformType = 'web' | 'mobile'

/**
 * TagAI User information
 */
export type MiniAppUser = {
  twitterId: string
  twitterUsername?: string
  twitterName?: string
  profile?: string
  ethAddr?: string
  fid?: string
}

/**
 * TagAI Cast/Tweet information
 */
export interface MiniAppCast {
  author: MiniAppUser
  tweetId: string
  parentTweetId?: string
  timestamp?: number
  mentions?: MiniAppUser[]
  text: string
  embeds?: string[]
  tick?: string  // TagAI community ticker
}

/**
 * Location contexts - where the mini app was opened from
 */
export type CastEmbedLocationContext = {
  type: 'cast_embed'
  embed: string
  cast: MiniAppCast
}

export type CastShareLocationContext = {
  type: 'cast_share'
  cast: MiniAppCast
}

export type NotificationLocationContext = {
  type: 'notification'
  notification: {
    notificationId: string
    title: string
    body: string
  }
}

export type LauncherLocationContext = {
  type: 'launcher'
}

export type CommunityLocationContext = {
  type: 'community'
  community: {
    /**
     * Community ticker (e.g., 'BTC', 'ETH')
     */
    tick: string

    /**
     * Community name
     */
    name: string

    /**
     * Community logo URL
     */
    logoUrl?: string
  }
}

export type OpenMiniAppLocationContext = {
  type: 'open_miniapp'
  referrerDomain: string
}

export type LocationContext =
  | CastEmbedLocationContext
  | CastShareLocationContext
  | NotificationLocationContext
  | LauncherLocationContext
  | CommunityLocationContext
  | OpenMiniAppLocationContext

export type AccountLocation = {
  placeId: string
  /**
   * Human-readable string describing the location
   */
  description: string
}

export type UserContext = {
  twitterId: string
  twitterUsername?: string
  twitterName?: string
  /**
   * Profile image URL
   */
  profile?: string
  ethAddr?: string
  fid?: string
  location?: AccountLocation
}

export type SafeAreaInsets = {
  top: number
  bottom: number
  left: number
  right: number
}

export type ClientContext = {
  platformType?: MiniAppPlatformType
  clientTwitterId: string  // TagAI client's Twitter ID
  added: boolean
  notificationDetails?: MiniAppNotificationDetails
  safeAreaInsets?: SafeAreaInsets
}

export type ClientFeatures = {
  haptics: boolean
  cameraAndMicrophoneAccess?: boolean
  twitter: boolean
  wallet: boolean
}

export type MiniAppContext = {
  client: ClientContext
  user: UserContext
  location?: LocationContext
  features?: ClientFeatures
}

// ==========================================
// Context Management Functions
// ==========================================

import { transport } from './transport';

let cachedContext: MiniAppContext | null = null;
let contextPromise: Promise<MiniAppContext> | null = null;

/**
 * Get Mini App context
 */
export async function getContext(): Promise<MiniAppContext> {
  // Return cached context if available
  if (cachedContext) {
    return cachedContext;
  }

  // Return in-progress promise if exists
  if (contextPromise) {
    return contextPromise;
  }

  // Create new request
  contextPromise = (async () => {
    try {
      const context = await transport.sendMessage<MiniAppContext>('getContext');
      cachedContext = context;
      return context;
    } catch (error) {
      contextPromise = null; // Clear promise on error to allow retry
      throw error;
    }
  })();

  return contextPromise;
}

/**
 * Refresh context (clear cache)
 */
export async function refreshContext(): Promise<MiniAppContext> {
  cachedContext = null;
  contextPromise = null;
  return getContext();
}

/**
 * Check if running in Mini App environment
 */
export async function isInMiniApp(timeoutMs = 1000): Promise<boolean> {
  // SSR check
  if (typeof window === 'undefined') {
    return false;
  }

  // Quick check: definitely not in Mini App
  if (!window.parent || window.parent === window) {
    if (!(window as any).ReactNativeWebView) {
      return false;
    }
  }

  // Try to get context to verify
  try {
    const result = await Promise.race([
      getContext().then(() => true),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);

    return result;
  } catch {
    return false;
  }
}

/**
 * Clear context cache (for testing or logout)
 */
export function clearContextCache() {
  cachedContext = null;
  contextPromise = null;
}
