/**
 * Simple Event Emitter
 */

export class EventEmitter<EventMap extends Record<string, (...args: any[]) => void>> {
  private listeners = new Map<keyof EventMap, Set<Function>>();

  on<K extends keyof EventMap>(event: K, handler: EventMap[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off<K extends keyof EventMap>(event: K, handler: EventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit<K extends keyof EventMap>(
    event: K,
    ...args: Parameters<EventMap[K]>
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for "${String(event)}":`, error);
        }
      });
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
