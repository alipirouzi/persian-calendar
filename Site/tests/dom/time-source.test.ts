// Site/tests/dom/time-source.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../../src/settings/settings-model';
import { createTimeSource, type TimeSource } from '../../src/time/time-source';
import {
  OFFSET_TTL_MS, RESYNC_AFTER_HIDDEN_MS, RESYNC_INTERVAL_MS, SAMPLE_TIMEOUT_MS,
} from '../../src/time/time-sync-model';

const DEVICE_START = Date.UTC(2026, 9, 15, 12, 0, 0);

/** A settings store reduced to what the time source reads, with a switch for the source. */
const fakeStore = (source: Settings['time']['source'] = 'server') => {
  let settings: Settings = { ...DEFAULT_SETTINGS, time: { source } };
  const listeners = new Set<(s: Settings) => void>();
  return {
    get: () => settings,
    subscribe: (listener: (s: Settings) => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setSource(next: Settings['time']['source']) {
      settings = { ...settings, time: { source: next } };
      for (const listener of listeners) listener(settings);
    },
  };
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Answers as a server whose clock is `skewMs` ahead of the (fake) device clock. */
const serverAhead = (skewMs: number) =>
  vi.fn<typeof fetch>(async () => json({ epochSec: (Date.now() + skewMs) / 1000 }));

let hidden = false;
const setHidden = (value: boolean): void => {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
};

let time: TimeSource | undefined;
const make = (fetchImpl: typeof fetch, store = fakeStore()): TimeSource => {
  time = createTimeSource({ store, fetchImpl, perfNow: () => Date.now() });
  return time;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(DEVICE_START);
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});

afterEach(() => {
  time?.dispose();
  time = undefined;
  vi.useRealTimers();
});

describe('time source', () => {
  it('uses the device clock until a sync has succeeded', () => {
    const t = make(serverAhead(5_000));
    expect(t.now().getTime()).toBe(DEVICE_START);
    expect(t.status()).toEqual({ kind: 'unsynced' });
  });

  it('applies the server offset after a sync and reports when it synced', async () => {
    const fetchImpl = serverAhead(5_000);
    const t = make(fetchImpl);
    await t.sync();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl).toHaveBeenCalledWith('/api/time', expect.objectContaining({ cache: 'no-store' }));
    expect(t.now().getTime()).toBe(DEVICE_START + 5_000);
    expect(t.status()).toEqual({ kind: 'synced', atMs: DEVICE_START + 5_000, offsetMs: 5_000 });
  });

  it('ignores an offset inside the dead band', async () => {
    const t = make(serverAhead(200));
    await t.sync();
    expect(t.now().getTime()).toBe(DEVICE_START);
    expect(t.status()).toMatchObject({ kind: 'synced', offsetMs: 0 });
  });

  it('keeps the sample with the shortest round trip', async () => {
    let call = 0;
    // Each answer takes a different time; the 10 ms one says +2 s, the slow ones disagree.
    const plan = [{ delay: 400, skew: 9_000 }, { delay: 10, skew: 2_000 }, { delay: 200, skew: -3_000 }];
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      const { delay, skew } = plan[call++]!;
      await new Promise((resolve) => { setTimeout(resolve, delay); });
      return json({ epochSec: (Date.now() + skew - delay / 2) / 1000 });
    });
    const t = make(fetchImpl);
    const done = t.sync();
    await vi.advanceTimersByTimeAsync(1_000);
    await done;
    expect(t.status()).toMatchObject({ offsetMs: 2_000 });
  });

  it('skips failed samples and uses the rest', async () => {
    let call = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      call += 1;
      if (call === 1) throw new TypeError('offline');
      if (call === 2) return new Response('<!doctype html><title>Wi-Fi login</title>', { status: 200 });
      return json({ epochSec: (Date.now() + 4_000) / 1000 });
    });
    const t = make(fetchImpl);
    await t.sync();
    expect(t.status()).toMatchObject({ kind: 'synced', offsetMs: 4_000 });
  });

  it.each([
    ['a network error', async () => { throw new TypeError('offline'); }],
    ['a non-200 answer', async () => json({ epochSec: Date.now() / 1000 }, 503)],
    ['an HTML page', async () => new Response('<!doctype html>', { status: 200 })],
    ['JSON that is not ours', async () => json({ time: 'now' })],
  ])('falls back to the device clock on %s', async (_label, answer) => {
    const t = make(vi.fn<typeof fetch>(answer as () => Promise<Response>));
    await t.sync();
    expect(t.now().getTime()).toBe(DEVICE_START);
    expect(t.status()).toEqual({ kind: 'unsynced' });
  });

  it('gives up on a sample after the timeout', async () => {
    const hanging = vi.fn<typeof fetch>((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { reject(new DOMException('aborted', 'AbortError')); });
    }));
    const t = make(hanging);
    const done = t.sync();
    await vi.advanceTimersByTimeAsync(SAMPLE_TIMEOUT_MS * 4);
    await done;
    expect(hanging).toHaveBeenCalledTimes(3);
    expect(t.status()).toEqual({ kind: 'unsynced' });
  });

  it('keeps the last good offset through failures until it is a day old', async () => {
    let up = true;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      if (!up) throw new TypeError('offline');
      return json({ epochSec: (Date.now() + 5_000) / 1000 });
    });
    const t = make(fetchImpl);
    await t.sync();
    up = false;
    vi.advanceTimersByTime(OFFSET_TTL_MS - 1);
    await t.sync();
    expect(t.now().getTime() - Date.now()).toBe(5_000);
    vi.advanceTimersByTime(1);
    expect(t.now().getTime()).toBe(Date.now());
    expect(t.status()).toEqual({ kind: 'unsynced' });
  });

  it('says syncing to listeners while it runs, and the outcome when it ends', async () => {
    const t = make(vi.fn<typeof fetch>(async () => { throw new TypeError('offline'); }));
    const seen: string[] = [];
    t.subscribe(() => { seen.push(t.status().kind); });
    const done = t.sync();
    expect(t.status()).toEqual({ kind: 'syncing' });
    await done;
    expect(seen).toEqual(['syncing', 'unsynced']);
  });

  it('recovers from a listener that throws, so a later sync still runs and adopts', async () => {
    const fetchImpl = serverAhead(5_000);
    const t = make(fetchImpl);
    let calls = 0;
    t.subscribe(() => {
      calls += 1;
      if (calls === 1) throw new Error('listener failed');
    });
    await expect(t.sync()).rejects.toThrow('listener failed');
    expect(t.status()).toEqual({ kind: 'unsynced' });
    await t.sync();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(t.status()).toMatchObject({ kind: 'synced', offsetMs: 5_000 });
  });

  it('shares one run between overlapping sync calls', async () => {
    const fetchImpl = serverAhead(5_000);
    const t = make(fetchImpl);
    await Promise.all([t.sync(), t.sync()]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('never fetches when the source is the device', async () => {
    const fetchImpl = serverAhead(5_000);
    const t = make(fetchImpl, fakeStore('device'));
    t.start();
    await t.sync();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(t.status()).toEqual({ kind: 'device' });
    expect(t.now().getTime()).toBe(DEVICE_START);
  });

  it('drops the offset on a switch to the device and syncs on a switch back', async () => {
    const store = fakeStore();
    const fetchImpl = serverAhead(5_000);
    const t = make(fetchImpl, store);
    const listener = vi.fn();
    t.subscribe(listener);
    await t.sync();

    store.setSource('device');
    expect(t.now().getTime()).toBe(DEVICE_START);
    expect(t.status()).toEqual({ kind: 'device' });

    store.setSource('server');
    await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(6); });
    await vi.waitFor(() => { expect(t.status()).toMatchObject({ kind: 'synced' }); });
    expect(listener).toHaveBeenCalled();
  });

  it('ignores an unrelated settings change', async () => {
    const store = fakeStore();
    const fetchImpl = serverAhead(5_000);
    make(fetchImpl, store);
    store.setSource('server');
    await Promise.resolve();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('discards a result that arrives after the user switched to the device clock', async () => {
    const store = fakeStore();
    // Only the very first request answers (after 100 ms); every later one hangs until its timeout.
    const answersOnce = vi.fn<typeof fetch>(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 100); });
      return json({ epochSec: (Date.now() + 5_000) / 1000 });
    });
    const t = make(answersOnce, store);
    const stale = t.sync();                 // its first sample is now in flight
    answersOnce.mockImplementation((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { reject(new DOMException('aborted', 'AbortError')); });
    }));
    store.setSource('device');
    store.setSource('server');              // starts a fresh run, which only ever times out

    await vi.advanceTimersByTimeAsync(SAMPLE_TIMEOUT_MS * 4);
    await stale;

    // The stale run did get a good sample (+5 s), but it belongs to the old generation.
    expect(t.status()).toEqual({ kind: 'unsynced' });
    expect(t.now().getTime()).toBe(Date.now());
  });

  describe('probe', () => {
    it('reports the round trip and the offset, and adopts it for the server source', async () => {
      const t = make(serverAhead(5_000));
      const listener = vi.fn();
      t.subscribe(listener);
      await expect(t.probe()).resolves.toEqual({ ok: true, rttMs: 0, offsetMs: 5_000 });
      expect(t.status()).toMatchObject({ kind: 'synced', offsetMs: 5_000 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('reports without adopting when the source is the device', async () => {
      const t = make(serverAhead(5_000), fakeStore('device'));
      await expect(t.probe()).resolves.toMatchObject({ ok: true, offsetMs: 5_000 });
      expect(t.status()).toEqual({ kind: 'device' });
    });

    it('reports failure', async () => {
      const t = make(vi.fn<typeof fetch>(async () => { throw new TypeError('offline'); }));
      await expect(t.probe()).resolves.toEqual({ ok: false });
    });
  });

  describe('schedule', () => {
    it('syncs on start', async () => {
      const fetchImpl = serverAhead(5_000);
      make(fetchImpl).start();
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(3); });
    });

    it('resyncs on return after at least five minutes hidden, not sooner', async () => {
      const fetchImpl = serverAhead(5_000);
      const t = make(fetchImpl);
      t.start();
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(3); });

      setHidden(true);
      vi.setSystemTime(Date.now() + RESYNC_AFTER_HIDDEN_MS - 1);
      setHidden(false);
      await Promise.resolve();
      expect(fetchImpl).toHaveBeenCalledTimes(3);

      setHidden(true);
      vi.setSystemTime(Date.now() + RESYNC_AFTER_HIDDEN_MS);
      setHidden(false);
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(6); });
    });

    it('ignores a visible event that was not preceded by hiding', async () => {
      const fetchImpl = serverAhead(5_000);
      const t = make(fetchImpl);
      t.start();
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(3); });
      setHidden(false);
      await Promise.resolve();
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('resyncs every six hours while visible, and not while hidden', async () => {
      const fetchImpl = serverAhead(5_000);
      const t = make(fetchImpl);
      t.start();
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(3); });

      await vi.advanceTimersByTimeAsync(RESYNC_INTERVAL_MS - 60_000);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(60_000);
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(6); });

      hidden = true;
      await vi.advanceTimersByTimeAsync(RESYNC_INTERVAL_MS);
      expect(fetchImpl).toHaveBeenCalledTimes(6);
    });

    it('stops listening and polling after dispose', async () => {
      const fetchImpl = serverAhead(5_000);
      const t = make(fetchImpl);
      t.start();
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(3); });
      t.dispose();
      setHidden(true);
      vi.setSystemTime(Date.now() + RESYNC_INTERVAL_MS);
      setHidden(false);
      await vi.advanceTimersByTimeAsync(RESYNC_INTERVAL_MS);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('unsubscribes a listener', async () => {
      const t = make(serverAhead(5_000));
      const listener = vi.fn();
      t.subscribe(listener)();
      await t.sync();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  it('uses the real clocks and fetch when none are injected', async () => {
    const realFetch = vi.fn<typeof fetch>(async () => json({ epochSec: (Date.now() + 5_000) / 1000 }));
    vi.stubGlobal('fetch', realFetch);
    try {
      time = createTimeSource({ store: fakeStore() });
      await time.sync();
      expect(realFetch).toHaveBeenCalled();
      expect(time.status()).toMatchObject({ kind: 'synced' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
