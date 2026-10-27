import { createNostrRuntime } from '../../nostr/runtime';
import { requestEvents } from '../../nostr/requests';
import { parseFollowListEvent } from '../../nostr/protocol/follow-pack';
import { parseProfile } from '../../nostr/protocol/profile';

/** A separate read-only server runtime; every request closes its sockets and store. */
export async function readPreview(identifier: string, author: string | undefined, signal: AbortSignal) {
  if (!identifier || (author && !/^[0-9a-f]{64}$/i.test(author))) return null;
  const runtime = createNostrRuntime({ cache: { read: async () => [], write: async () => {} } });
  try {
    const filter = { kinds: [39089], '#d': [identifier], ...(author ? { authors: [author] } : {}) };
    await requestEvents(runtime, [filter, { kinds: [5], '#k': ['39089'], ...(author ? { authors: [author] } : {}) }], runtime.relays, signal, 4500);
    const events = runtime.eventStore.getTimeline(filter);
    if (events.length !== 1) return null;
    const pack = parseFollowListEvent(events[0]);
    if (!pack) return null;
    const members = pack.entries.slice(0, 6).map((entry) => entry.pubkey);
    if (members.length) {
      try { await requestEvents(runtime, { kinds: [0], authors: members }, runtime.relays, signal, 2500); } catch { /* Render without unavailable profiles. */ }
    }
    return { pack, pictures: members.flatMap((pubkey) => {
      const event = runtime.eventStore.getReplaceable(0, pubkey);
      const picture = parseProfile(event).picture;
      return picture ? [picture] : [];
    }) };
  } finally { runtime.dispose(); }
}
