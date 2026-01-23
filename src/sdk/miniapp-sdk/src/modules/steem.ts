/**
 * Steem Social Module
 * Handles Steem blockchain interactions
 */

import type { MiniAppTransport } from '../../../miniapp-core/src/transport';
import type { SteemModule, SteemPostOptions, SteemPostResult, SteemCommentOptions } from '../types';

export function createSteemModule(transport: MiniAppTransport): SteemModule {
  return {
    async post(options: SteemPostOptions): Promise<SteemPostResult> {
      return await transport.sendMessage<SteemPostResult>('steem.post', options);
    },

    async vote(author: string, permlink: string, weight: number): Promise<void> {
      await transport.sendMessage('steem.vote', {
        author,
        permlink,
        weight,
      });
    },

    async comment(options: SteemCommentOptions): Promise<SteemPostResult> {
      return await transport.sendMessage<SteemPostResult>('steem.comment', options);
    },

    async reblog(author: string, permlink: string): Promise<void> {
      await transport.sendMessage('steem.reblog', {
        author,
        permlink,
      });
    },
  };
}
