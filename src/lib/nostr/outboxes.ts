import { castUser } from 'applesauce-common/casts';
import type { NostrRuntime } from './runtime';
import { eventRelays } from './relay-policy';

/** Bound metadata discovery; cached lists resolve immediately. */
export async function loadOutboxRelays(runtime: NostrRuntime, pubkey: string) {
  const cached = runtime.eventStore.getReplaceable(10002, pubkey);
  if (cached) return eventRelays(cached, 'write');
  const hints = await castUser(pubkey, runtime.eventStore).outboxes$.$first(1500, [] as string[]);
  // Use the signed list once discovered. Its URL parser also handles valid long TLDs rejected by SDK hint parsing.
  const discovered = runtime.eventStore.getReplaceable(10002, pubkey);
  return discovered ? eventRelays(discovered, 'write') : hints;
}
