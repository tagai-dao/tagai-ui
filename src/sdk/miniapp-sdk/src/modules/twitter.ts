/**
 * Twitter Module
 * TagAI-specific module for Twitter integration
 * Content posted through TagAI is cross-posted to Twitter
 */

import type { MiniAppTransport } from '../../../miniapp-core/src/transport';

/**
 * Twitter post options
 */
export interface TwitterPostOptions {
  /** Tweet text content (max 280 chars) */
  text: string;
  /** Media URLs to attach (max 4 images) */
  mediaUrls?: string[];
  /** Quote tweet ID */
  quoteTweetId?: string;
  /** Reply to tweet ID */
  replyToTweetId?: string;
}

/**
 * Twitter post result
 */
export interface TwitterPostResult {
  /** Tweet ID */
  tweetId: string;
  /** Tweet URL */
  url: string;
  /** Whether post was successful */
  success: boolean;
}

/**
 * Twitter share options
 */
export interface TwitterShareOptions {
  /** URL to share */
  url: string;
  /** Pre-filled tweet text */
  text?: string;
  /** Hashtags to include */
  hashtags?: string[];
  /** Via account */
  via?: string;
}

/**
 * Twitter module interface
 */
export interface TwitterModule {
  /**
   * Post a tweet through TagAI
   * The tweet will be posted using the user's connected Twitter account
   */
  post(options: TwitterPostOptions): Promise<TwitterPostResult>;

  /**
   * Like a tweet
   * @param tweetId - ID of the tweet to like
   * @param community - Community/tick to associate with (for curation rewards)
   */
  like(tweetId: string, community?: string): Promise<void>;

  /**
   * Retweet a tweet
   * @param tweetId - ID of the tweet to retweet
   * @param community - Community/tick to associate with
   */
  retweet(tweetId: string, community?: string): Promise<void>;

  /**
   * Reply to a tweet
   * @param tweetId - ID of the tweet to reply to
   * @param text - Reply text
   * @param community - Community/tick to associate with
   */
  reply(tweetId: string, text: string, community?: string): Promise<TwitterPostResult>;

  /**
   * Quote tweet with additional comment
   * @param tweetId - ID of the tweet to quote
   * @param text - Quote comment text
   * @param community - Community/tick to associate with
   */
  quote(tweetId: string, text: string, community?: string): Promise<TwitterPostResult>;

  /**
   * Delete a tweet
   * @param tweetId - ID of the tweet to delete
   */
  deleteTweet(tweetId: string): Promise<void>;

  /**
   * Open Twitter share dialog
   * Opens the native Twitter share sheet or web intent
   */
  share(options: TwitterShareOptions): Promise<void>;

  /**
   * Check if user has Twitter connected
   */
  isConnected(): Promise<boolean>;

  /**
   * Get current user's Twitter info
   */
  getUser(): Promise<{
    twitterId: string;
    username: string;
    displayName: string;
    profileImageUrl?: string;
  } | null>;
}

/**
 * Create Twitter module
 */
export function createTwitterModule(transport: MiniAppTransport): TwitterModule {
  return {
    async post(options: TwitterPostOptions): Promise<TwitterPostResult> {
      // Validate text length
      if (options.text.length > 280) {
        throw new Error('Tweet text exceeds 280 character limit');
      }

      // Validate media count
      if (options.mediaUrls && options.mediaUrls.length > 4) {
        throw new Error('Maximum 4 media items allowed per tweet');
      }

      const result = await transport.sendMessage<TwitterPostResult>('twitter.post', options);
      return result;
    },

    async like(tweetId: string, community: string = 'default'): Promise<void> {
      await transport.sendMessage('twitter.like', {
        tweetId,
        community,
      });
    },

    async retweet(tweetId: string, community: string = 'default'): Promise<void> {
      await transport.sendMessage('twitter.retweet', {
        tweetId,
        community,
      });
    },

    async reply(tweetId: string, text: string, community: string = 'default'): Promise<TwitterPostResult> {
      // Validate text length
      if (text.length > 280) {
        throw new Error('Reply text exceeds 280 character limit');
      }

      const result = await transport.sendMessage<TwitterPostResult>('twitter.reply', {
        tweetId,
        text,
        community,
      });
      return result;
    },

    async quote(tweetId: string, text: string, community: string = 'default'): Promise<TwitterPostResult> {
      // Validate text length
      if (text.length > 280) {
        throw new Error('Quote text exceeds 280 character limit');
      }

      const result = await transport.sendMessage<TwitterPostResult>('twitter.quote', {
        tweetId,
        text,
        community,
      });
      return result;
    },

    async deleteTweet(tweetId: string): Promise<void> {
      await transport.sendMessage('twitter.delete', {
        tweetId,
      });
    },

    async share(options: TwitterShareOptions): Promise<void> {
      // Build Twitter intent URL
      const params = new URLSearchParams();

      if (options.url) {
        params.set('url', options.url);
      }

      if (options.text) {
        params.set('text', options.text);
      }

      if (options.hashtags && options.hashtags.length > 0) {
        params.set('hashtags', options.hashtags.join(','));
      }

      if (options.via) {
        params.set('via', options.via);
      }

      const intentUrl = `https://twitter.com/intent/tweet?${params.toString()}`;

      // Send to host to handle (native share or open URL)
      await transport.sendMessage('twitter.share', {
        ...options,
        intentUrl,
      });
    },

    async isConnected(): Promise<boolean> {
      try {
        const result = await transport.sendMessage<{ connected: boolean }>('twitter.isConnected');
        return result.connected;
      } catch {
        return false;
      }
    },

    async getUser(): Promise<{
      twitterId: string;
      username: string;
      displayName: string;
      profileImageUrl?: string;
    } | null> {
      try {
        const result = await transport.sendMessage<{
          twitterId: string;
          username: string;
          displayName: string;
          profileImageUrl?: string;
        } | null>('twitter.getUser');
        return result;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Build Twitter share URL (for direct use without SDK)
 */
export function buildTwitterShareUrl(options: TwitterShareOptions): string {
  const params = new URLSearchParams();

  if (options.url) {
    params.set('url', options.url);
  }

  if (options.text) {
    params.set('text', options.text);
  }

  if (options.hashtags && options.hashtags.length > 0) {
    params.set('hashtags', options.hashtags.join(','));
  }

  if (options.via) {
    params.set('via', options.via);
  }

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export type { TwitterPostOptions, TwitterPostResult, TwitterShareOptions };
