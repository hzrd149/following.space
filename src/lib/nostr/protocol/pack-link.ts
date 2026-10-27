import { decodePointer, naddrEncode } from 'applesauce-core/helpers';
import { FOLLOW_LIST_KIND, type FollowList } from './follow-pack';
import { normalizeRelays } from '../relay-policy';

export interface PackLocation { identifier: string; pubkey?: string; relays: string[] }

/** Decode once at the URL boundary; legacy identifiers remain literal. */
export function resolvePackLink(value: string, author?: string): PackLocation {
  let decoded: ReturnType<typeof decodePointer> | undefined;
  try { decoded = decodePointer(value); } catch { /* Not NIP-19: a legacy d tag. */ }
  if (decoded) {
    if (decoded.type !== 'naddr' || decoded.data.kind !== FOLLOW_LIST_KIND) throw new Error('Invalid pack address');
    return { identifier: decoded.data.identifier, pubkey: decoded.data.pubkey, relays: normalizeRelays(decoded.data.relays ?? []) };
  }
  if (!value || (author && !/^[0-9a-f]{64}$/i.test(author))) throw new Error('Invalid pack address');
  return { identifier: value, pubkey: author?.toLowerCase(), relays: [] };
}

export function packNaddr(pack: Pick<FollowList, 'pubkey' | 'id'>, relays: string[] = []) {
  return naddrEncode({ kind: FOLLOW_LIST_KIND, pubkey: pack.pubkey, identifier: pack.id, relays: normalizeRelays(relays) });
}
export function packHref(pack: Pick<FollowList, 'pubkey' | 'id'>) {
  return `/d/${packNaddr(pack)}`;
}
