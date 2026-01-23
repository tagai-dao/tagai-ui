/**
 * Actions Module
 * Handles application behaviors and UI interactions
 */

import type { MiniAppTransport } from '../../../miniapp-core/src/transport';
import type { ActionsModule, ComposeOptions, ComposeResult, SetPrimaryButtonOptions } from '../types';
import type { EventEmitter } from '../utils/event-emitter';
import type { MiniAppEventMap } from '../types';

export function createActionsModule(
  transport: MiniAppTransport,
  emitter: EventEmitter<MiniAppEventMap>
): ActionsModule {
  return {
    async ready(options = {}) {
      await transport.sendMessage('actions.ready', options);
    },

    async close() {
      await transport.sendMessage('actions.close');
    },

    async openUrl(url: string) {
      await transport.sendMessage('actions.openUrl', { url });
    },

    async compose(options: ComposeOptions = {}): Promise<ComposeResult> {
      return await transport.sendMessage<ComposeResult>('actions.compose', options);
    },

    async share(options) {
      await transport.sendMessage('actions.share', options);
    },

    async viewProfile(username: string) {
      await transport.sendMessage('actions.viewProfile', { username });
    },

    async viewPost(author: string, permlink: string) {
      await transport.sendMessage('actions.viewPost', { author, permlink });
    },

    async setPrimaryButton(options: SetPrimaryButtonOptions) {
      await transport.sendMessage('actions.setPrimaryButton', options);
    },

    async addMiniApp() {
      return await transport.sendMessage<{ added: boolean }>('actions.addMiniApp');
    },

    async requestCameraAndMicrophoneAccess() {
      return await transport.sendMessage<{ camera: boolean; microphone: boolean }>(
        'actions.requestCameraAndMicrophoneAccess'
      );
    },
  };
}
