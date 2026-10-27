import { afterEach, expect, it, vi } from 'vitest';
import { createNostrRuntime } from '../src/lib/nostr/runtime';
import { npubEncode } from 'applesauce-core/helpers';

const mocks = vi.hoisted(() => ({ runtime: vi.fn(), request: vi.fn(), ranked: vi.fn() }));
vi.mock('../src/lib/nostr/runtime.client', () => ({ getNostrRuntime: mocks.runtime }));
vi.mock('../src/lib/nostr/requests', () => ({ requestEvents: mocks.request }));
vi.mock('../src/lib/services/open-ranking', () => ({ searchRankedPubkeys: mocks.ranked }));
import { searchUsersByName } from '../src/lib/services/user-search';
const pubkey = 'a'.repeat(64);
afterEach(() => vi.resetAllMocks());

it('keeps ranked users selectable when profile relays fail', async () => {
  const runtime = createNostrRuntime({ cache: { read: async () => [], write: async () => {} } });
  mocks.runtime.mockResolvedValue(runtime);
  mocks.ranked.mockResolvedValue([{ pubkey, rank: 42 }]);
  mocks.request.mockRejectedValue(new Error('relay unavailable'));
  try {
    expect(await searchUsersByName('alice')).toEqual([{ pubkey, rank: 42, relays: [], name: undefined, picture: undefined }]);
  } finally { runtime.dispose(); }
});

it('looks up npubs directly without contacting the ranking provider', async () => {
  const runtime = createNostrRuntime({ cache: { read: async () => [], write: async () => {} } });
  mocks.runtime.mockResolvedValue(runtime);
  mocks.request.mockResolvedValue([]);
  try {
    expect((await searchUsersByName(npubEncode(pubkey)))[0].pubkey).toBe(pubkey);
    expect(mocks.ranked).not.toHaveBeenCalled();
  } finally { runtime.dispose(); }
});
