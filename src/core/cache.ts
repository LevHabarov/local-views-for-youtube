/**
 * Sets a value in a map used as a size-bounded cache: the entry moves to the
 * end, and the oldest entries are dropped while the map is over `maxSize`.
 */
export function setBounded<K, V>(map: Map<K, V>, key: K, value: V, maxSize: number): void {
  // Re-inserting moves the entry to the end, so the oldest one comes first.
  map.delete(key);
  map.set(key, value);
  for (const oldest of map.keys()) {
    if (map.size <= maxSize) break;
    map.delete(oldest);
  }
}
