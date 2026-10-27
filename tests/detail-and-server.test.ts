import { afterEach, describe, expect, it, vi } from 'vitest';
import { NEVER, of, throwError } from 'rxjs';
import { createNostrRuntime } from '../src/lib/nostr/runtime';
import { loadPack, AmbiguousPackError, observePack } from '../src/lib/features/packs/detail';
import { renderPreview } from '../src/lib/server/previews/render';
import { parseFollowListEvent } from '../src/lib/nostr/protocol/follow-pack';
import { bob, signedPack } from './fixtures';
const stops: (() => void)[] = [];
afterEach(() => stops.splice(0).forEach((stop) => stop()));
function setup() {
  const runtime = createNostrRuntime({ cache: { read: async () => [], write: async () => {} }, relays: ['wss://relay.example'] });
  vi.spyOn(runtime.pool, 'request').mockReturnValue(of(signedPack(), signedPack({ key: bob })));
  vi.spyOn(runtime.pool, 'subscription').mockReturnValue(NEVER);
  stops.push(() => runtime.dispose()); return runtime;
}
describe('pack detail identity', () => {
  it('rejects ambiguous authorless links rather than choosing an arbitrary author', async () => {
    const runtime = setup();
    await expect(loadPack(runtime, 'garden')).rejects.toBeInstanceOf(AmbiguousPackError);
    expect((await loadPack(runtime, 'garden', signedPack().pubkey))?.pubkey).toBe(signedPack().pubkey);
  });
  it('reacts to newer revisions of the addressed pack', async () => {
    const runtime = setup(); const pack = signedPack();
    runtime.eventStore.add(pack);
    const names: (string | undefined)[] = [];
    const subscription = observePack(runtime, 'garden', pack.pubkey).subscribe((state) => names.push(state.pack?.name));
    stops.push(() => subscription.unsubscribe());
    runtime.eventStore.add(signedPack({ timestamp: pack.created_at + 1, title: 'New revision' }));
    expect(names).toContain('Garden'); expect(names.at(-1)).toBe('New revision');
  });
});
it('renders an actual server PNG without requiring remote images', async () => {
  const pack = parseFollowListEvent(signedPack({ title: 'Preview Garden' }))!;
  const buffer = await renderPreview(pack, [], new AbortController().signal);
  expect(buffer.subarray(1, 4).toString()).toBe('PNG');
  expect(buffer.readUInt32BE(16)).toBe(1200);
  expect(buffer.readUInt32BE(20)).toBe(630);
});

it.each([false, true])('only reports detail failure without cached data: %s', async (cached) => {
  const runtime = setup(); const pack = signedPack();
  if (cached) runtime.eventStore.add(pack);
  vi.mocked(runtime.pool.request).mockReturnValue(throwError(() => new Error('offline')));
  vi.mocked(runtime.pool.subscription).mockReturnValue(throwError(() => new Error('live offline')));
  const states: { error?: string; loading: boolean }[] = [];
  const sub = observePack(runtime, 'garden', pack.pubkey).subscribe((state) => states.push(state));
  stops.push(() => sub.unsubscribe());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(states.at(-1)?.loading).toBe(false);
  expect(!!states.at(-1)?.error).toBe(!cached);
});
