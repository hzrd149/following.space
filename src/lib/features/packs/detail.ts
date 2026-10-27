import { Observable, Subscription, shareReplay } from 'rxjs';
import { type FollowList, FOLLOW_LIST_KIND, parseFollowListEvent } from '../../nostr/protocol/follow-pack';
import type { NostrRuntime } from '../../nostr/runtime';
import { requestEvents } from '../../nostr/requests';
import type { Filter, NostrEvent } from 'applesauce-core/helpers';

export interface PackDetailState { pack: FollowList | null; candidates: FollowList[]; loading: boolean; error?: string }
export class AmbiguousPackError extends Error {
  constructor(public candidates: FollowList[]) { super('Several authors use this pack identifier. Choose an author.'); }
}
export function observePack(runtime: NostrRuntime, identifier: string, pubkey?: string) {
  return new Observable<PackDetailState>((observer) => {
    if (!identifier || (pubkey && !/^[0-9a-f]{64}$/i.test(pubkey))) {
      observer.next({ pack: null, candidates: [], loading: false, error: 'Invalid pack address' }); return;
    }
    const scope = new Subscription();
    const controller = new AbortController();
    const filter: Filter = { kinds: [FOLLOW_LIST_KIND], '#d': [identifier], ...(pubkey ? { authors: [pubkey] } : {}) };
    const deletes: Filter = { kinds: [5], '#k': [String(FOLLOW_LIST_KIND)], ...(pubkey ? { authors: [pubkey] } : {}) };
    let settled = false;
    let warning: string | undefined;
    let current: NostrEvent[] = [];
    const emit = () => {
      if (scope.closed) return;
      const candidates = current.flatMap((event) => {
        const pack = parseFollowListEvent(event); return pack ? [pack] : [];
      });
      observer.next({ pack: (pubkey || settled) && candidates.length === 1 ? candidates[0] : null,
        candidates: !pubkey && settled && candidates.length > 1 ? candidates : [],
        loading: !settled && (!pubkey || !candidates.length), error: settled && !candidates.length ? warning : undefined });
    };
    // Consume the model's atomic revision view. During insert notifications the
    // underlying database can briefly contain both revisions before old cleanup.
    scope.add(runtime.eventStore.timeline(filter).subscribe((events) => { current = events; emit(); }));
    const boundary = Math.floor(Date.now() / 1000) - 60;
    scope.add(runtime.pool.subscription(runtime.relayPolicy.readRelays$, [filter, deletes].map((f) => ({ ...f, since: boundary }))).subscribe({
      next: (event) => runtime.eventStore.add(event), error: () => {}
    }));
    void runtime.hydrate([filter, deletes]).catch(() => {}).then(async () => {
      if (scope.closed) return;
      try {
        await requestEvents(runtime, [filter, deletes], runtime.relays, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) return;
        warning = error instanceof Error ? error.message : 'Pack could not be refreshed';
      }
      settled = true; emit();
    });
    return () => { scope.unsubscribe(); controller.abort(); };
  }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
}

export async function loadPack(runtime: NostrRuntime, identifier: string, pubkey?: string, signal?: AbortSignal) {
  const filter: Filter = { kinds: [FOLLOW_LIST_KIND], '#d': [identifier], ...(pubkey ? { authors: [pubkey] } : {}) };
  await runtime.hydrate([filter]);
  await requestEvents(runtime, filter, runtime.relays, signal);
  const packs = runtime.eventStore.getTimeline(filter).flatMap((event) => {
    const pack = parseFollowListEvent(event); return pack ? [pack] : [];
  });
  if (!pubkey && packs.length > 1) throw new AmbiguousPackError(packs);
  return packs[0] ?? null;
}
