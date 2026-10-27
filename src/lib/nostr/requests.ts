import type { Filter, NostrEvent } from 'applesauce-core/helpers';
import type { NostrRuntime } from './runtime';

/** Finite, cancellable reads. Failure is never translated into a successful empty list. */
export function requestEvents(runtime: NostrRuntime, filters: Filter | Filter[], relays = runtime.relays, signal?: AbortSignal, timeout = 6000): Promise<NostrEvent[]> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
    const targets = runtime.pool.filterRelays(relays);
    if (!targets.length) return reject(new Error('No healthy relays are available. Please retry.'));
    const events: NostrEvent[] = [];
    const sub = runtime.pool.request(targets, filters, { timeout, firstResponseTimeout: timeout, waitForAuth: false }).subscribe({
      next: (event) => { runtime.eventStore.add(event); events.push(event); },
      error: (error) => { signal?.removeEventListener('abort', cancel); reject(error); },
      complete: () => { signal?.removeEventListener('abort', cancel); resolve(events); }
    });
    function cancel() { sub.unsubscribe(); reject(new DOMException('Cancelled', 'AbortError')); }
    if (!sub.closed) signal?.addEventListener('abort', cancel, { once: true });
  });
}
