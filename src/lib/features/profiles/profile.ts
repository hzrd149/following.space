import { catchError, map, of } from 'rxjs';
import type { NostrRuntime } from '../../nostr/runtime';
import { parseProfile, type ProfileView } from '../../nostr/protocol/profile';
export type { ProfileView } from '../../nostr/protocol/profile';
export function observeProfile(runtime: NostrRuntime, pubkey: string) {
  return runtime.eventStore.replaceable({ kind: 0, pubkey }).pipe(
    map((event) => parseProfile(event)), catchError(() => of<ProfileView>({}))
  );
}
