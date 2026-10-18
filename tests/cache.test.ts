import { describe, expect, it } from 'vitest';
import { setBounded } from '../src/core/cache';

describe('setBounded', () => {
  it('keeps at most maxSize entries, dropping the oldest', () => {
    const map = new Map<string, number>();
    for (const [i, key] of ['a', 'b', 'c', 'd'].entries()) setBounded(map, key, i, 3);
    expect([...map.keys()]).toEqual(['b', 'c', 'd']);
  });

  it('treats an updated entry as the newest', () => {
    const map = new Map<string, number>();
    setBounded(map, 'a', 1, 2);
    setBounded(map, 'b', 2, 2);
    setBounded(map, 'a', 3, 2);
    setBounded(map, 'c', 4, 2);
    expect([...map.entries()]).toEqual([
      ['a', 3],
      ['c', 4],
    ]);
  });
});
