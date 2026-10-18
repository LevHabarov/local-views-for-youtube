import { describe, expect, it } from 'vitest';
import { isAlive, onShutdown } from '../src/content/lifecycle';

describe('lifecycle', () => {
  it('runs the shutdown handlers once, when the extension goes away', () => {
    const runtime: { id?: string } = { id: 'extension-id' };
    (globalThis as { chrome?: unknown }).chrome = { runtime };
    let calls = 0;
    onShutdown(() => calls++);
    onShutdown(() => {
      throw new Error('a failing handler must not stop the others');
    });
    onShutdown(() => calls++);

    expect(isAlive()).toBe(true);
    expect(calls).toBe(0);

    // What Chrome does to an orphaned content script.
    delete runtime.id;
    expect(isAlive()).toBe(false);
    expect(calls).toBe(2);

    runtime.id = 'extension-id';
    expect(isAlive()).toBe(false);
    expect(calls).toBe(2);
  });
});
