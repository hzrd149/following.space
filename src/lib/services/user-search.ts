import { decodeProfilePointer } from 'applesauce-core/helpers';
import { getNostrRuntime } from '../nostr/runtime.client';
import { requestEvents } from '../nostr/requests';
import { accounts } from '../nostr/accounts';
import { parseProfile } from '../nostr/protocol/profile';
export interface UserSearchResult { pubkey: string; relays: string[]; rank: number; name?: string; picture?: string }
const SEARCH_RELAYS = ['wss://search.nos.today', 'wss://relay.nostr.band', 'wss://relay.noswhere.com'];
export async function searchUsersByName(query: string, limit = 5, signal?: AbortSignal): Promise<UserSearchResult[]> {
  query = query.trim();
  if (!query) return [];
  const runtime = await getNostrRuntime();
  const pointer = /^[0-9a-f]{64}$/i.test(query) ? { pubkey: query } : decodeProfilePointer(query.replace(/^nostr:/, ''));
  const filter = pointer ? { kinds: [0], authors: [pointer.pubkey] } : { kinds: [0], search: query, limit: 100 };
  await runtime.hydrate([filter]);
  try { await requestEvents(runtime, filter, pointer ? [...runtime.relays, ...(pointer.relays ?? [])] : SEARCH_RELAYS, signal); }
  catch (error) { if (signal?.aborted || !pointer) throw error; }
  signal?.throwIfAborted();
  const following = new Set(runtime.eventStore.getReplaceable(3, accounts.active?.pubkey ?? '')?.tags.filter((tag) => tag[0] === 'p').map((tag) => tag[1]));
  const results = runtime.eventStore.getTimeline(filter).map((event) => {
    const profile = parseProfile(event);
    return { pubkey: event.pubkey, relays: pointer?.relays ?? [], rank: following.has(event.pubkey) ? 1 : 0,
      name: profile.name, picture: profile.picture };
  }).filter((profile) => pointer || profile.name?.toLowerCase().includes(query.toLowerCase()));
  if (pointer && !results.length) results.push({ pubkey: pointer.pubkey, relays: pointer.relays ?? [], rank: 0, name: undefined, picture: undefined });
  return results.sort((a, b) => b.rank - a.rank).slice(0, limit);
}
